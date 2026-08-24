import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const WEBHOOK_URL = process.env.LOGGER_WEBHOOK_URL;

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  timestamp: string;
  footer?: { text: string };
}

const queue: DiscordEmbed[] = [];
let flushing = false;
let sending = false;

const LEVEL_COLORS: Record<string, number> = {
  log: 0x57f287,
  info: 0x57f287,
  warn: 0xfee75c,
  error: 0xed4245,
  debug: 0x5865f2,
};

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.message}\n${a.stack || ''}`.trim();
      try {
        return JSON.stringify(a, null, 2);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

async function sendToDiscord(embeds: DiscordEmbed[]): Promise<void> {
  if (!WEBHOOK_URL || sending) return;
  sending = true;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds }),
    });
    if (!res.ok && res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
    }
  } catch {
    /* Silent, avoid recursion */
  } finally {
    sending = false;
  }
}

async function flushQueue(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  while (queue.length > 0) {
    const batch = queue.splice(0, 10);
    await sendToDiscord(batch);
    if (queue.length > 0) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  flushing = false;
}

function enqueue(level: string, message: string): void {
  if (!WEBHOOK_URL) return;
  const desc = message.length > 4000 ? `${message.substring(0, 3997)}...` : message;
  if (!desc.trim()) return;
  queue.push({
    title: level.toUpperCase(),
    description: desc,
    color: LEVEL_COLORS[level] || 0x5865f2,
    timestamp: new Date().toISOString(),
  });
  if (!flushing) flushQueue();
}

/* Patch console methods */
const origLog = console.log.bind(console);
const origWarn = console.warn.bind(console);
const origError = console.error.bind(console);

console.log = (...args: unknown[]) => {
  origLog(...args);
  enqueue('log', formatArgs(args));
};

console.warn = (...args: unknown[]) => {
  origWarn(...args);
  enqueue('warn', formatArgs(args));
};

console.error = (...args: unknown[]) => {
  origError(...args);
  enqueue('error', formatArgs(args));
};
