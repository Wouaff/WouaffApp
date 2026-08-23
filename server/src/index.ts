import './services/logger.js';

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import pool from './config/database.js';
import { runMigrations } from './config/migrate.js';
import { patchRouter } from './middleware/asyncHandler.js';
import { checkIpBan } from './middleware/auth.js';
import { errorHandler, setupProcessHandlers } from './middleware/errorHandler.js';
import { maintenanceCheck } from './middleware/maintenance.js';
import { rateLimit } from './middleware/rateLimit.js';
import { sqlGuard } from './middleware/sqlGuard.js';
import { requestTimeout } from './middleware/timeout.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import blocksRouter from './routes/blocks.js';
import callsRouter from './routes/calls.js';
import captchaRouter from './routes/captcha.js';
import communitiesRouter from './routes/communities.js';
import contactsRouter from './routes/contacts.js';
import conversationsRouter from './routes/conversations.js';
import gifsRouter from './routes/gifs.js';
import groupsRouter from './routes/groups.js';
import linkPreviewRouter from './routes/linkPreview.js';
import messagesRouter from './routes/messages.js';
import notificationsRouter from './routes/notifications.js';
import onboardingRouter from './routes/onboarding.js';
import postsRouter from './routes/posts.js';
import profilesRouter from './routes/profiles.js';
import publicRouter from './routes/public.js';
import searchRouter from './routes/search.js';
import securityRouter from './routes/security.js';
import statusRouter from './routes/status.js';
import storiesRouter from './routes/stories.js';
import trendsRouter from './routes/trends.js';
import videosRouter from './routes/videos.js';
import { INDEXNOW_KEY, indexNowKeyFileContent } from './services/indexnow.js';
import { startQueueWorker } from './services/queue.js';
import { registerQueueHandlers, setQueueIo } from './services/queueHandlers.js';
import { cleanExpiredEphemeralMessages, getMaintenanceMode } from './services/rtdb.js';
import { buildSeo, defaultSeo, SITE_URL, seoMetaTags } from './services/seo.js';
import { buildSitemap, robotsTxt } from './services/sitemap.js';
import { setupSocket } from './socket/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

/* Middleware */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.APP_URL || 'https://wouaff.app')
  .split(',')
  .map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

/* SQL injection guard — scanne tous les champs textuels des requêtes API */
app.use('/api', sqlGuard);

/* Blocage des adresses IP bannies (toutes routes API confondues) */
app.use('/api', checkIpBan);

/* Rate limiting */
app.use('/api/auth/login', rateLimit({ windowMs: 60000, max: 20 }));
app.use('/api/auth/register', rateLimit({ windowMs: 60000, max: 10 }));
app.use('/api/auth/forgot-password', rateLimit({ windowMs: 60000, max: 5 }));
app.use('/api/contacts', rateLimit({ windowMs: 60000, max: 60 }));
app.use('/api/messages', rateLimit({ windowMs: 60000, max: 120 }));
app.use('/api/search', rateLimit({ windowMs: 60000, max: 30 }));
app.use('/api/videos', rateLimit({ windowMs: 60000, max: 60 }));
app.use('/api/posts', rateLimit({ windowMs: 60000, max: 120 }));
app.use('/api/communities', rateLimit({ windowMs: 60000, max: 120 }));
app.use('/api/trends', rateLimit({ windowMs: 60000, max: 30 }));
app.use('/api/gifs', rateLimit({ windowMs: 60000, max: 60 }));
app.use('/api/link-preview', rateLimit({ windowMs: 60000, max: 20 }));
app.use('/api/admin/bootstrap', rateLimit({ windowMs: 60000, max: 3 }));
app.use('/api/auth/2fa/verify', rateLimit({ windowMs: 60000, max: 10 }));
app.use('/api/auth/verify-email', rateLimit({ windowMs: 60000, max: 10 }));
app.use('/api/notifications', rateLimit({ windowMs: 60000, max: 60 }));
app.use('/api/groups', rateLimit({ windowMs: 60000, max: 60 }));
app.use('/api/profiles', rateLimit({ windowMs: 60000, max: 60 }));
app.use('/api/stories', rateLimit({ windowMs: 60000, max: 30 }));
app.use('/api/blocks', rateLimit({ windowMs: 60000, max: 30 }));

/* Public maintenance status (accessible even during maintenance) */
app.get('/api/maintenance', (_req, res) => {
  getMaintenanceMode()
    .then((m) => res.json(m))
    .catch(() => res.json({ enabled: false, message: null }));
});

/* Maintenance check (blocks non-staff when enabled) */
app.use('/api', maintenanceCheck);

/* Request timeout (30s for regular, 60s for uploads) */
app.use('/api', requestTimeout(30000));

/* Socket.IO */
const io = setupSocket(httpServer);
app.set('io', io);

/* REST API (all routers auto-wrap async handlers) */
app.use('/api/auth', patchRouter(authRouter));
app.use('/api/auth', patchRouter(securityRouter));
app.use('/api/captcha', patchRouter(captchaRouter));
app.use('/api/communities', patchRouter(communitiesRouter));
app.use('/api/messages', patchRouter(messagesRouter));
app.use('/api/conversations', patchRouter(conversationsRouter));
app.use('/api/onboarding', patchRouter(onboardingRouter));
app.use('/api/profiles', patchRouter(profilesRouter));
app.use('/api/groups', patchRouter(groupsRouter));
app.use('/api/contacts', patchRouter(contactsRouter));
app.use('/api/stories', patchRouter(storiesRouter));
app.use('/api/notifications', patchRouter(notificationsRouter));
app.use('/api/search', patchRouter(searchRouter));
app.use('/api/admin', patchRouter(adminRouter));
app.use('/api/status', patchRouter(statusRouter));
app.use('/api/public', patchRouter(publicRouter));
app.use('/api/link-preview', patchRouter(linkPreviewRouter));
app.use('/api/blocks', patchRouter(blocksRouter));
app.use('/api/gifs', patchRouter(gifsRouter));
app.use('/api/calls', patchRouter(callsRouter));
app.use('/api/videos', patchRouter(videosRouter));
app.use('/api/posts', patchRouter(postsRouter));
app.use('/api/trends', patchRouter(trendsRouter));

/* Health check */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

/* API 404 — JSON, not the SPA fallback */
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

/* Frontend static files (built React app) */
const clientDist = resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist, { maxAge: '7d', immutable: true, index: false }));

/* Downloads (installer, etc.) */
const downloadsDir = resolve(__dirname, '../downloads');
app.use('/downloads', express.static(downloadsDir));

/* Uploaded videos & thumbnails */
const uploadsDir = resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

/* Sitemap XML dynamique (posts, profils, communautés, hashtags) */
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const xml = await buildSitemap();
    res.set('Cache-Control', `public, max-age=${Math.floor((5 * 60 * 1000) / 1000)}`);
    res.type('application/xml');
    res.send(xml);
  } catch {
    res.status(500).send('Internal Server Error');
  }
});

/* Robots.txt pointant vers le sitemap */
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain');
  res.send(robotsTxt());
});

/* IndexNow key file verification */
if (INDEXNOW_KEY) {
  app.get(`/${INDEXNOW_KEY}.txt`, (_req, res) => {
    res.type('text/plain');
    res.send(indexNowKeyFileContent());
  });
}

/* SEO & embeds sociaux : injection serveur des meta OG/Twitter selon l'URL */
let indexHtmlCache: string | null = null;
function getIndexHtml(): string {
  if (indexHtmlCache !== null) return indexHtmlCache;
  indexHtmlCache = readFileSync(resolve(clientDist, 'index.html'), 'utf8');
  return indexHtmlCache;
}

/* Pages qui ne doivent pas être indexées (routes protégées / auth) */
const NOINDEX_PATHS = [
  /^\/auth/,
  /^\/forgot-password/,
  /^\/reset-password/,
  /^\/verify-email/,
  /^\/notifications/,
  /^\/messages/,
  /^\/hashtag\//,
  /^\/settings/,
  /^\/search/,
  /^\/admin/,
];

app.get('*', async (req, res) => {
  try {
    const pathname = req.path;
    const canonicalUrl = `${SITE_URL}${pathname}`;
    const seo = await buildSeo(pathname, canonicalUrl).catch(() => defaultSeo(canonicalUrl));
    let html = getIndexHtml();
    if (html.includes('<!--seo-meta-->')) {
      html = html.replace('<!--seo-meta-->', seoMetaTags(seo));
    }
    if (NOINDEX_PATHS.some((re) => re.test(pathname))) {
      html = html.replace(
        '<meta name="robots" content="index, follow" />',
        '<meta name="robots" content="noindex, nofollow" />',
      );
    }
    res.set('Cache-Control', 'no-cache');
    res.type('html');
    res.send(html);
  } catch {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(resolve(clientDist, 'index.html'));
  }
});

/* Express error middleware (must be last) */
app.use(errorHandler);

/* Process handlers */
setupProcessHandlers(async () => {
  try {
    await pool.end();
  } catch {}
  httpServer.close();
});

/* Run DB migrations then start */
const PORT = parseInt(process.env.PORT || '7285', 10);

runMigrations()
  .then(async () => {
    /* File asynchrone : emails, webhooks, notifications */
    setQueueIo(io);
    registerQueueHandlers();
    startQueueWorker();

    /* Start ephemeral messages cleanup every 30 seconds */
    setInterval(async () => {
      try {
        const deleted = await cleanExpiredEphemeralMessages();
        if (deleted.length > 0) {
          for (const { type, convId, key } of deleted) {
            const room = type === 'dm' ? `dm:${convId}` : `group:${convId}`;
            io.to(room).emit('message:removed', { convId, key });
          }
        }
      } catch {
        /* silent */
      }
    }, 30000);

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🟢 Wouaff server running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
