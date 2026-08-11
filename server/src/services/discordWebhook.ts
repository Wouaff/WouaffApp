import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type { Request } from 'express';
import { getOne, query } from '../config/database.js';

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
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'inconnue';
}

async function resolveAccount(req: Request): Promise<string> {
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

function truncate(s: string, max = 900): string {
  const value = s.length > max ? `${s.slice(0, max)}…` : s;
  return value.replace(/`/g, '');
}

/* Envoie une alerte de sécurité à Discord (@everyone + embed) */
export async function sendSqlInjectionAlert(req: Request, match: SqlMatch): Promise<void> {
  if (!WEBHOOK_URL) return;
  try {
    const ip = getClientIp(req);
    const account = await resolveAccount(req);
    const ua =
      typeof req.headers['user-agent'] === 'string' && req.headers['user-agent'].length > 0
        ? req.headers['user-agent'].slice(0, 200)
        : 'Inconnu';

    const payload = {
      content: '@everyone',
      username: 'Wouaff Sécurité',
      embeds: [
        {
          title: '🚨 Tentative d’injection SQL bloquée',
          color: 0xed4245,
          description:
            'Une requête suspecte contenant une tentative d’injection SQL a été détectée et bloquée automatiquement.',
          fields: [
            { name: '🌐 Adresse IP', value: `\`${ip}\``, inline: true },
            { name: '👤 Compte', value: account, inline: true },
            { name: '🔗 Endpoint', value: `\`${req.method} ${req.originalUrl}\``, inline: false },
            { name: '🧠 Type', value: match.name, inline: true },
            { name: '📝 Contenu', value: `\`\`\`${truncate(match.input)}\`\`\``, inline: false },
            { name: '🖥️ User-Agent', value: `\`${ua}\``, inline: false },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'Wouaff · Protection anti-injection SQL' },
        },
      ],
    };

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok && res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
    }
  } catch {
    /* Silencieux — ne pas casser la requête */
  }
}

/* Envoie un embed Discord à chaque nouvelle inscription */
export async function sendNewUserAlert(data: {
  pseudo: string;
  wouaffId: string;
  uid: string;
  email?: string | null;
}): Promise<void> {
  if (!REGISTER_WEBHOOK_URL) return;
  try {
    const rows = await query<Array<{ total: number }>>('SELECT COUNT(*) AS total FROM users');
    const total = rows[0]?.total || 0;

    const payload = {
      username: 'Wouaff · Nouveautés',
      embeds: [
        {
          title: '🎉 Nouvelle inscription !',
          color: 0xf97b3b,
          description: `Un nouveau membre a rejoint la communauté Wouaff : **${data.pseudo}** !`,
          fields: [
            { name: '👤 Pseudo', value: data.pseudo || 'Inconnu', inline: true },
            { name: '🔗 Identifiant', value: data.wouaffId || '@inconnu', inline: true },
            { name: '📊 Total d’inscrits', value: `\`${total}\``, inline: true },
            { name: '🪪 UID', value: `\`${data.uid}\``, inline: false },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'Wouaff · Inscriptions' },
        },
      ],
    };

    const res = await fetch(REGISTER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok && res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
    }
  } catch {
    /* Silencieux — ne pas casser l'inscription */
  }
}
