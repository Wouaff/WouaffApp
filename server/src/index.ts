import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import pool from './config/database.js';
import { runMigrations } from './config/migrate.js';
import { errorHandler, setupProcessHandlers } from './middleware/errorHandler.js';
import { originCheck } from './middleware/originCheck.js';
import { rateLimit } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/security.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import captchaRoutes from './routes/captcha.js';
import notificationsRoutes from './routes/notifications.js';
import postsRoutes from './routes/posts.js';
import profilesRoutes from './routes/profiles.js';
import socialRoutes from './routes/social.js';
import trendsRoutes from './routes/trends.js';
import uploadRoutes from './routes/upload.js';
import { encryptLegacyTotpSecrets, purgeExpiredSessions } from './services/rtdb.js';
import { assertSecretsConfig } from './services/secrets.js';
import { sweepOrphanUploads, uploadsDir } from './services/uploads.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 7285;
const distPath = resolve(__dirname, '../../client/dist');
/* Lancé depuis src/ (tsx watch) = développement : on sert toujours Vite, même si un
   client/dist traîne. Sinon ce build obsolète prend le dessus et le navigateur charge
   d'anciens bundles dont les chunks n'existent plus (fallback SPA en text/html). */
const fromBuild = basename(__dirname) === 'dist';
const isProd = process.env.NODE_ENV === 'production' || (fromBuild && existsSync(distPath));
if (!isProd && existsSync(distPath)) {
  console.log('[SERVER] client/dist ignoré en dev : Vite sert les sources (HMR)');
}

/* Origine publique (schéma + hôte + port) tirée de APP_URL. Une valeur avec un « / » final ou un chemin
   ne correspondrait jamais à l'en-tête Origin des navigateurs : CORS refuserait tout. */
function publicOrigin(): string {
  const fallback = `http://localhost:${PORT}`;
  const raw = process.env.APP_URL || fallback;
  try {
    return new URL(raw).origin;
  } catch {
    console.warn(`[CONFIG] APP_URL invalide (« ${raw} »), repli sur ${fallback}`);
    return fallback;
  }
}
const appOrigin = publicOrigin();

/* Derrière un reverse proxy (nginx, Caddy…), définir TRUST_PROXY=1 pour que req.ip soit la vraie IP. */
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
app.disable('x-powered-by');

/* Sans TRUST_PROXY derrière un proxy, tous les visiteurs ont la même IP : le rate-limit les bloque ensemble
   et le HSTS n'est jamais envoyé. On le signale une fois plutôt que de laisser la panne silencieuse. */
if (!trustProxy) {
  let warned = false;
  app.use((req, _res, next) => {
    if (!warned && isProd && req.headers['x-forwarded-for']) {
      warned = true;
      console.warn(
        '[CONFIG] En-tête X-Forwarded-For reçu alors que TRUST_PROXY n’est pas défini : définis TRUST_PROXY=1 (rate-limit par IP, HSTS).',
      );
    }
    next();
  });
}

app.use(securityHeaders(isProd));
app.use(compression());
app.use(cors({ origin: appOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
/* Sans ce middleware, req.cookies est undefined : le cookie de session n'est jamais lu
   et toutes les routes authentifiées répondent 401 alors que le login a réussi. */
app.use(cookieParser());

/* Timeout de 30 s sur l'API. */
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/upload')) return next();
  req.setTimeout(30_000);
  res.setTimeout(30_000, () => {
    if (!res.headersSent) res.status(503).json({ error: 'Délai dépassé' });
  });
  next();
});
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 600, message: 'Trop de requêtes, ralentis un peu' }));
/* Une requête qui modifie des données doit venir de notre propre site (défense en profondeur anti-CSRF). */
app.use('/api', originCheck(appOrigin));

/* Santé : vérifie aussi la base (une supervision qui ne voit que « le process tourne » rate l'essentiel). */
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/captcha', captchaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api', socialRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/upload', uploadRoutes);

/* Uploads : même dossier que celui où écrit /api/upload. Un fichier d'upload ne doit jamais
   être interprété comme une page (nosniff + CSP vide), même si un type MIME était usurpé.
   Les noms sont uniques et le contenu ne change jamais : cache long et « immutable ». */
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  },
  express.static(uploadsDir, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }),
  (_req, res) => res.status(404).end(),
);

/* Une route /api inconnue répond en JSON, pas avec le fallback HTML de la SPA. */
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable' }));

/* Fichiers du build : les bundles hachés (/assets/index-AbCd1234.js) ne changent jamais → cache d'un an ;
   la page d'entrée, le service worker et le manifeste doivent toujours être revalidés. */
const HASHED_ASSET_RE = /[\\/]assets[\\/].+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/;
const ALWAYS_REVALIDATE_RE = /(?:index\.html|sw\.js|theme\.js|manifest\.webmanifest)$/;

async function start() {
  try {
    assertSecretsConfig();
    await pool.getConnection().then((c) => {
      c.release();
      console.log('[DB] Connecté');
    });
    await runMigrations();
    const encrypted = await encryptLegacyTotpSecrets();
    if (encrypted > 0) console.log(`[SECRETS] ${encrypted} secret(s) TOTP chiffré(s)`);

    if (isProd) {
      app.use(
        express.static(distPath, {
          setHeaders(res, filePath) {
            if (ALWAYS_REVALIDATE_RE.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
            else if (HASHED_ASSET_RE.test(filePath))
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            else res.setHeader('Cache-Control', 'public, max-age=3600');
          },
        }),
      );
      app.get('*', (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(resolve(distPath, 'index.html'));
      });
    } else {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: resolve(__dirname, '../../client'),
        configFile: resolve(__dirname, '../../client/vite.config.ts'),
      });
      app.use(vite.middlewares);
    }

    /* Doit rester après toutes les routes. */
    app.use(errorHandler);

    const server = app.listen(PORT, () =>
      console.log(isProd ? `[SERVER] Production sur port ${PORT}` : `[SERVER] Dev sur port ${PORT} (Vite middleware)`),
    );

    /* Entretien (au démarrage puis toutes les heures) : sessions et jetons expirés, et fichiers envoyés
       mais jamais rattachés à un post ou un profil (UPLOAD_SWEEP=off pour désactiver ce dernier). */
    const maintenance = async () => {
      try {
        await purgeExpiredSessions();
      } catch (err) {
        console.error('[PURGE]', (err as Error).message);
      }
      if (process.env.UPLOAD_SWEEP === 'off') return;
      try {
        const removed = await sweepOrphanUploads();
        if (removed > 0) console.log(`[UPLOADS] ${removed} fichier(s) orphelin(s) supprimé(s)`);
      } catch (err) {
        console.error('[UPLOADS]', (err as Error).message);
      }
    };
    void maintenance();
    setInterval(maintenance, 60 * 60 * 1000).unref();

    setupProcessHandlers(async () => {
      await new Promise<void>((done) => server.close(() => done()));
      await pool.end();
    });
  } catch (err) {
    console.error('[STARTUP] Erreur:', err);
    process.exit(1);
  }
}

start();
