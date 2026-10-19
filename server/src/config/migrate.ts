import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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

/* Le dossier de migrations peut manquer (dépôt sans SQL, déploiement partiel) : un
   readdirSync en aveugle ferait échouer le démarrage du serveur. */
export function findMigrationsDir(candidates: string[]): string | null {
  return candidates.find((dir) => existsSync(dir) && statSync(dir).isDirectory()) ?? null;
}

/* Découpe un fichier SQL en requêtes (séparées par « ; »), commentaires retirés : un reste de
   commentaire en fin de fichier ne doit pas être exécuté comme une requête vide. */
export function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((chunk) =>
      chunk
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((stmt) => stmt.length > 0);
}

export async function runMigrations(): Promise<void> {
  const rootDir = resolve(__dirname, '../../');
  const migrationsDir = findMigrationsDir([resolve(__dirname, '../migrations'), resolve(rootDir, 'src/migrations')]);
  if (!migrationsDir) {
    console.warn('[MIGRATE] Aucun dossier de migrations trouvé : schéma non vérifié');
    return;
  }
  /* Par défaut une migration en échec empêche le démarrage : mieux vaut un arrêt net qu'un serveur
     qui tourne sur un schéma à moitié migré. MIGRATE_IGNORE_FAILURES=1 rétablit l'ancien comportement. */
  const ignoreFailures = process.env.MIGRATE_IGNORE_FAILURES === '1';

  const connection = await pool.getConnection();
  try {
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    if (files.length === 0) {
      console.warn(`[MIGRATE] Aucune migration dans ${migrationsDir} : la base doit exister`);
    }

    await ensureMigrationsTable(connection);
    const [appliedRows] = (await connection.query('SELECT filename FROM schema_migrations')) as [
      Array<{ filename: string }>,
      unknown,
    ];
    const applied = new Set(appliedRows.map((r) => r.filename));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sqlPath = resolve(migrationsDir, file);
      const statements = splitStatements(readFileSync(sqlPath, 'utf8'));
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
              const e2 = err2 as { code?: string; message?: string };
              if (e2.code === 'ER_DUP_FIELDNAME' || e2.code === 'ER_DUP_KEYNAME') continue;
              failure = e2.message ?? String(err2);
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
        if (!ignoreFailures) {
          throw new Error(
            `Migration ${file} en échec (${failure}). Corrigez la migration ou la base, puis relancez. (MIGRATE_IGNORE_FAILURES=1 pour démarrer malgré tout.)`,
          );
        }
        console.error(`[MIGRATE] ${file} n'est pas marqué comme appliqué et sera retenté au prochain démarrage`);
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
