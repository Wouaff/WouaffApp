import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import pool from './config/database.js';
import { runMigrations } from './config/migrate.js';
import authRoutes from './routes/auth.js';
import notificationsRoutes from './routes/notifications.js';
import postsRoutes from './routes/posts.js';
import profilesRoutes from './routes/profiles.js';
import socialRoutes from './routes/social.js';
import trendsRoutes from './routes/trends.js';
import uploadRoutes from './routes/upload.js';

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

app.use(cors({ origin: process.env.APP_URL || `http://localhost:${PORT}`, credentials: true }));
app.use(express.json({ limit: '5mb' }));
/* Sans ce middleware, req.cookies est undefined : le cookie de session n'est jamais lu
   et toutes les routes authentifiées répondent 401 alors que le login a réussi. */
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api', socialRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/upload', uploadRoutes);

app.use('/uploads', express.static(resolve(__dirname, '../../uploads')));

async function start() {
  try {
    await pool.getConnection().then((c: any) => {
      c.release();
      console.log('[DB] Connecté');
    });
    await runMigrations();

    if (isProd) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(resolve(distPath, 'index.html'));
      });
      app.listen(PORT, () => console.log(`[SERVER] Production sur port ${PORT}`));
    } else {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: resolve(__dirname, '../../client'),
        configFile: resolve(__dirname, '../../client/vite.config.ts'),
      });
      app.use(vite.middlewares);
      app.listen(PORT, () => console.log(`[SERVER] Dev sur port ${PORT} (Vite middleware)`));
    }
  } catch (err) {
    console.error('[STARTUP] Erreur:', err);
    process.exit(1);
  }
}

start();
