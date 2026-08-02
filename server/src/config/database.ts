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
});

(pool as unknown as { on?: (event: string, cb: (err: Error) => void) => void }).on?.('error', (err: Error) => {
  console.error('[DB POOL ERROR]', err.message);
});

export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
  const sanitized = params?.map((p) => (p === undefined ? null : p));
  try {
    const [rows] = await pool.execute(sql, sanitized as (string | number | boolean | null | Buffer | Date)[]);
    return rows as T;
  } catch (err: unknown) {
    const dbErr = err as { code?: string };
    if (dbErr.code === 'ECONNRESET' || dbErr.code === 'PROTOCOL_CONNECTION_LOST') {
      console.warn('[DB] Connection lost, retrying...');
      const [rows] = await pool.execute(sql, sanitized as (string | number | boolean | null | Buffer | Date)[]);
      return rows as T;
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
