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
import { rateLimit } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/security.js';
import authRoutes from './routes/auth.js';
import notificationsRoutes from './routes/notifications.js';
import postsRoutes from './routes/posts.js';
import profilesRoutes from './routes/profiles.js';
import socialRoutes from './routes/social.js';
import trendsRoutes from './routes/trends.js';
import uploadRoutes, { uploadsDir } from './routes/upload.js';
import { purgeExpiredSessions } from './services/rtdb.js';

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

/* Derrière un reverse proxy (nginx, Caddy…), définir TRUST_PROXY=1 pour que req.ip soit la vraie IP. */
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
app.disable('x-powered-by');

app.use(securityHeaders(isProd));
app.use(compression());
app.use(cors({ origin: process.env.APP_URL || `http://localhost:${PORT}`, credentials: true }));
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

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api', socialRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/upload', uploadRoutes);

/* Uploads : même dossier que celui où écrit /api/upload. Un fichier d'upload ne doit jamais
   être interprété comme une page (nosniff + CSP vide), même si un type MIME était usurpé. */
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  },
  express.static(uploadsDir, { maxAge: '7d', index: false, dotfiles: 'deny' }),
  (_req, res) => res.status(404).end(),
);

/* Une route /api inconnue répond en JSON, pas avec le fallback HTML de la SPA. */
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable' }));

async function start() {
  try {
    await pool.getConnection().then((c) => {
      c.release();
      console.log('[DB] Connecté');
    });
    await runMigrations();

    if (isProd) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
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

    /* Purge des sessions et jetons expirés (au démarrage puis toutes les heures). */
    const purge = () => purgeExpiredSessions().catch((err) => console.error('[PURGE]', err.message));
    void purge();
    setInterval(purge, 60 * 60 * 1000).unref();

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
