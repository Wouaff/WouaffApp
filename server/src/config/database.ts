import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPool } from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const pool = createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wouaff',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 50,
  charset: 'utf8mb4',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
  /* MySQL renvoie les TIMESTAMP/DATETIME en texte : sans ça mysql2 les relit comme de
     l'heure locale et tout `createdAt` ressort décalé (post « il y a 2h » à l'instant).
     À combiner avec la session forcée en +00:00 juste en dessous. */
  timezone: 'Z',
});

/* Le pool typé par mysql2/promise n'expose pas les évènements du pool sous-jacent. */
const poolEvents = pool as unknown as {
  on?: (event: string, cb: (payload: unknown) => void) => void;
};

/* Chaque connexion du pool raisonne en UTC, cohérent avec `timezone: 'Z'` ci-dessus. */
poolEvents.on?.('connection', (connection) => {
  const raw = connection as { query: (sql: string, cb: (err: Error | null) => void) => void };
  raw.query("SET time_zone = '+00:00'", (err) => {
    if (err) console.error('[DB] Impossible de forcer le fuseau UTC:', err.message);
  });
});

poolEvents.on?.('error', (err) => {
  console.error('[DB POOL ERROR]', (err as Error).message);
});

/* Seules les lectures sont rejouables : rejouer un INSERT/UPDATE après une coupure
   peut dupliquer l'écriture (la requête a pu être exécutée avant la perte de connexion). */
const READ_ONLY_RE = /^\s*(?:SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/i;

export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
  const sanitized = params?.map((p) => (p === undefined ? null : p));
  const args = sanitized as (string | number | boolean | null | Buffer | Date)[];
  try {
    const [rows] = await pool.execute(sql, args);
    return rows as T;
  } catch (err: unknown) {
    const dbErr = err as { code?: string };
    const retryable = dbErr.code === 'ECONNRESET' || dbErr.code === 'PROTOCOL_CONNECTION_LOST';
    if (retryable && READ_ONLY_RE.test(sql)) {
      console.warn('[DB] Connection lost, retrying read-only query...');
      const [rows] = await pool.execute(sql, args);
      return rows as T;
    }
    if (retryable) {
      console.error('[DB] Connection lost pendant une écriture : requête non rejouée (risque de doublon)');
    }
    throw err;
  }
}

export async function getOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T[]>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function queryPaginated<T>(
  sql: string,
  params: unknown[],
  limit: number = 50,
  offset: number = 0,
): Promise<{ rows: T; total: number }> {
  const countSql = `SELECT COUNT(*) as total FROM (${sql}) as _count`;
  const [{ total }] = await query<[{ total: number }]>(countSql, params.slice(0, -2));
  const rows = await query<T>(`${sql} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}

export default pool;
