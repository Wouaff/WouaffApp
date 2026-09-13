import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolConnection } from 'mysql2/promise';
import pool from './database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function ensureMigrationsTable(connection: PoolConnection): Promise<void> {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename VARCHAR(255) PRIMARY KEY,
       appliedAt BIGINT NOT NULL
     )`,
  );
}

export async function runMigrations(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    const rootDir = resolve(__dirname, '../../');
    const srcMigrations = resolve(rootDir, 'src/migrations');
    const distMigrations = resolve(__dirname, '../migrations');
    const migrationsDir = existsSync(distMigrations) ? distMigrations : srcMigrations;

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    await ensureMigrationsTable(connection);
    const [appliedRows] = (await connection.query('SELECT filename FROM schema_migrations')) as [
      Array<{ filename: string }>,
      unknown,
    ];
    const applied = new Set(appliedRows.map((r) => r.filename));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sqlPath = resolve(migrationsDir, file);
      const sql = readFileSync(sqlPath, 'utf8');
      const statements = sql.split(';').filter((s) => s.trim().length > 0);
      let failure: string | null = null;
      for (const stmt of statements) {
        try {
          await connection.execute(stmt);
        } catch (err: unknown) {
          const e = err as { code?: string; message?: string };
          if (e.code === 'ER_UNSUPPORTED_PS') {
            try {
              await connection.query(stmt);
            } catch (err2: unknown) {
              failure = (err2 as { message?: string }).message ?? String(err2);
              break;
            }
          } else if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_DUP_KEYNAME') {
            /* Colonne ou index déjà présent : migration idempotente */
          } else {
            failure = e.message ?? String(err);
            break;
          }
        }
      }
      if (failure) {
        console.error(`[MIGRATE] ÉCHEC sur ${file} : ${failure}`);
        console.error(
          `[MIGRATE] ${file} n'est pas marqué comme appliqué et sera retenté au prochain démarrage — corrigez la migration ou la base`,
        );
        continue;
      }
      await connection.query('INSERT IGNORE INTO schema_migrations (filename, appliedAt) VALUES (?,?)', [
        file,
        Date.now(),
      ]);
      console.log(`[MIGRATE] ${file} exécuté`);
    }
  } finally {
    connection.release();
  }
}
