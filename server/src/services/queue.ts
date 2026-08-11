import { query } from '../config/database.js';

type JobPayload = Record<string, unknown>;
type JobHandler = (payload: JobPayload) => Promise<void>;

const handlers = new Map<string, JobHandler>();

/* Backoff en ms entre les tentatives (index = tentatives déjà faites) */
const RETRY_BACKOFF_MS = [0, 5000, 30000, 120000];
const DEFAULT_MAX_ATTEMPTS = 3;
const LEASE_MS = 60000; /* durée du lock : un worker mort est re-réclamé après 60s */

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export function hasJobHandler(type: string): boolean {
  return handlers.has(type);
}

export async function enqueueJob(
  type: string,
  payload?: JobPayload,
  opts: { runAt?: number; maxAttempts?: number } = {},
): Promise<void> {
  try {
    await query(
      `INSERT INTO jobs (type, payload, status, attempts, maxAttempts, runAt, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        type,
        payload ? JSON.stringify(payload) : null,
        'pending',
        0,
        opts.maxAttempts || DEFAULT_MAX_ATTEMPTS,
        opts.runAt || Date.now(),
        Date.now(),
        Date.now(),
      ],
    );
  } catch (err) {
    /* Ne jamais faire tomber l'appelant à cause de la file */
    console.error('[QUEUE] enqueue error:', (err as Error).message);
  }
}

interface JobRow {
  id: number;
  type: string;
  payload: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAt: number;
  lockedAt: number | null;
  lastError: string | null;
}

/* Réclame un job éligible de façon atomique (crash-safe grâce au lease). */
async function claimNextJob(now: number): Promise<JobRow | null> {
  const candidates = await query<JobRow[]>(
    `SELECT * FROM jobs
     WHERE (status='pending' AND runAt <= ?) OR (status='running' AND (lockedAt IS NULL OR lockedAt < ?))
     ORDER BY id ASC LIMIT 5`,
    [now, now - LEASE_MS],
  );
  for (const row of candidates) {
    const res = await query<{ affectedRows: number }>(
      `UPDATE jobs SET status='running', lockedAt=?, updatedAt=?
       WHERE id=? AND (
         (status='pending' AND runAt <= ?) OR
         (status='running' AND (lockedAt IS NULL OR lockedAt < ?))
       )`,
      [now, now, row.id, now, now - LEASE_MS],
    );
    if (res.affectedRows === 1) return row;
  }
  return null;
}

async function runJob(row: JobRow): Promise<void> {
  const id = row.id;
  const payload: JobPayload = (() => {
    if (!row.payload) return {};
    try {
      return JSON.parse(row.payload) as JobPayload;
    } catch {
      return {};
    }
  })();

  const handler = handlers.get(row.type);
  if (!handler) {
    await query("UPDATE jobs SET status='done', lockedAt=NULL, updatedAt=? WHERE id=?", [Date.now(), id]);
    return;
  }

  try {
    await handler(payload);
    await query("UPDATE jobs SET status='done', lockedAt=NULL, updatedAt=? WHERE id=?", [Date.now(), id]);
  } catch (err) {
    const attempts = (row.attempts || 0) + 1;
    const lastError = (err as Error).message || String(err);
    if (attempts >= (row.maxAttempts || DEFAULT_MAX_ATTEMPTS)) {
      await query("UPDATE jobs SET status='failed', attempts=?, lastError=?, lockedAt=NULL, updatedAt=? WHERE id=?", [
        attempts,
        lastError.slice(0, 500),
        Date.now(),
        id,
      ]);
    } else {
      const backoff = RETRY_BACKOFF_MS[Math.min(attempts, RETRY_BACKOFF_MS.length - 1)] ?? 120000;
      await query(
        "UPDATE jobs SET status='pending', attempts=?, lastError=?, runAt=?, lockedAt=NULL, updatedAt=? WHERE id=?",
        [attempts, lastError.slice(0, 500), Date.now() + backoff, Date.now(), id],
      );
    }
  }
}

async function processBatch(limit = 5): Promise<void> {
  for (let i = 0; i < limit; i++) {
    const row = await claimNextJob(Date.now());
    if (!row) break;
    await runJob(row);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startQueueWorker(intervalMs = 1000, batch = 5): void {
  if (timer) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processBatch(batch);
    } catch (err) {
      console.error('[QUEUE] worker error:', (err as Error).message);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref?.();
}
