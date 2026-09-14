import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type { Request } from 'express';
import { getOne, query } from '../config/database.js';
import { getClientIp as resolveClientIp } from '../utils/clientIp.js';
import { enqueueJob } from './queue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

/* Les URLs des webhooks ne doivent JAMAIS être en dur dans le code :
   uniquement dans le .env (DISCORD_WEBHOOK_URL / DISCORD_REGISTER_WEBHOOK_URL). */
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const REGISTER_WEBHOOK_URL = process.env.DISCORD_REGISTER_WEBHOOK_URL;

export interface SqlMatch {
  name: string;
  input: string;
}

export function getClientIp(req: Request): string {
  return resolveClientIp(req) || req.socket.remoteAddress || 'inconnue';
}

export async function resolveAccount(req: Request): Promise<string> {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) return 'Non connecté';
  try {
    const session = await getOne<{ uid: string }>('SELECT uid FROM sessions WHERE sessionId = ?', [sessionId]);
    if (!session) return 'Non connecté';
    const user = await getOne<{ pseudo: string | null }>('SELECT pseudo FROM users WHERE uid = ?', [session.uid]);
    return user?.pseudo ? `${user.pseudo} (${session.uid})` : `UID ${session.uid}`;
  } catch {
    return 'Non connecté';
  }
}

/* Neutralise le Markdown et les mentions dans les champs libres d'un embed */
function sanitizeField(value: unknown, max = 900): string {
  const s = typeof value === 'string' ? value : String(value ?? '');
  const cleaned = s
    .replace(/[`\r\n\t]/g, ' ')
    .replace(/@(everyone|here)/gi, '@\u200b$1')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

async function postWebhook(url: string, payload: unknown): Promise<void> {
  if (!url) return;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
  }
}

/* ── Envois HTTP réels (exécutés par le worker de la file) ── */

/* Alerte de sécurité (embed, sans mention) */
export async function sendSqlInjectionAlertData(data: Record<string, unknown>): Promise<void> {
  if (!WEBHOOK_URL) return;
  const payload = {
    username: 'Wouaff Sécurité',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: '🚨 Tentative d’injection SQL bloquée',
        color: 0xed4245,
        description:
          'Une requête suspecte contenant une tentative d’injection SQL a été détectée et bloquée automatiquement.',
        fields: [
          { name: '🌐 Adresse IP', value: sanitizeField(data.ip, 60), inline: true },
          { name: '👤 Compte', value: sanitizeField(data.account, 120), inline: true },
          {
            name: '🔗 Endpoint',
            value: sanitizeField(`${data.method} ${data.url}`, 300),
            inline: false,
          },
          { name: '🧠 Type', value: sanitizeField(data.name, 80), inline: true },
          { name: '📝 Contenu', value: sanitizeField(data.input, 900), inline: false },
          { name: '🖥️ User-Agent', value: sanitizeField(data.ua, 200), inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Wouaff · Protection anti-injection SQL' },
      },
    ],
  };
  await postWebhook(WEBHOOK_URL, payload);
}

/* Embed de nouvelle inscription */
export async function sendNewUserAlert(data: { pseudo: string; wouaffId: string; uid: string }): Promise<void> {
  if (!REGISTER_WEBHOOK_URL) return;
  const rows = await query<Array<{ total: number }>>('SELECT COUNT(*) AS total FROM users');
  const total = rows[0]?.total || 0;

  const pseudo = sanitizeField(data.pseudo || 'Inconnu', 60);
  const wouaffId = sanitizeField(data.wouaffId || '@inconnu', 60);
  const uid = sanitizeField(data.uid, 60);

  const payload = {
    username: 'Wouaff · Nouveautés',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: '🎉 Nouvelle inscription !',
        color: 0xf97b3b,
        description: `Un nouveau membre a rejoint la communauté Wouaff : **${pseudo}** !`,
        fields: [
          { name: '👤 Pseudo', value: pseudo, inline: true },
          { name: '🔗 Identifiant', value: wouaffId, inline: true },
          { name: '📊 Total d’inscrits', value: `\`${total}\``, inline: true },
          { name: '🪪 UID', value: `\`${uid}\``, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Wouaff · Inscriptions' },
      },
    ],
  };
  await postWebhook(REGISTER_WEBHOOK_URL, payload);
}

/* ── Soumission via la file asynchrone ── */

export async function enqueueNewUserAlert(data: { pseudo: string; wouaffId: string; uid: string }): Promise<void> {
  await enqueueJob('webhook', { kind: 'newUser', data });
}

export async function enqueueSqlInjectionAlert(req: Request, match: SqlMatch): Promise<void> {
  const ip = getClientIp(req);
  const account = await resolveAccount(req);
  const ua =
    typeof req.headers['user-agent'] === 'string' && req.headers['user-agent'].length > 0
      ? req.headers['user-agent'].slice(0, 200)
      : 'Inconnu';
  await enqueueJob(
    'webhook',
    {
      kind: 'sqlAlert',
      data: { ip, account, ua, method: req.method, url: req.originalUrl, name: match.name, input: match.input },
    },
    { maxPending: 200 },
  );
}
