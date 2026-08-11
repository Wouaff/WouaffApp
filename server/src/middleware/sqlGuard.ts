import type { NextFunction, Request, Response } from 'express';
import { enqueueSqlInjectionAlert, type SqlMatch } from '../services/discordWebhook.js';

/*
 * Détection de tentatives d'injection SQL dans tous les champs textuels
 * (body JSON, query string, URL). Bloque la requête et envoie une alerte
 * Discord avec l'IP et le compte connecté.
 */

const SQL_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /(?:UNION\s+(?:ALL\s+)?SELECT)/i, name: 'UNION SELECT' },
  { pattern: /\bSELECT\b[\s\S]{0,80}?\bFROM\b/i, name: 'SELECT ... FROM' },
  { pattern: /\bINSERT\s+INTO\b/i, name: 'INSERT INTO' },
  { pattern: /\bDELETE\s+FROM\b/i, name: 'DELETE FROM' },
  { pattern: /\bDROP\s+TABLE\b/i, name: 'DROP TABLE' },
  { pattern: /\bALTER\s+TABLE\b/i, name: 'ALTER TABLE' },
  { pattern: /\bCREATE\s+TABLE\b/i, name: 'CREATE TABLE' },
  { pattern: /\bTRUNCATE\s+TABLE\b/i, name: 'TRUNCATE TABLE' },
  { pattern: /\bUPDATE\b[\s\S]{0,80}?\bSET\b/i, name: 'UPDATE ... SET' },
  { pattern: /\bGRANT\b/i, name: 'GRANT' },
  { pattern: /\bREVOKE\b/i, name: 'REVOKE' },
  { pattern: /\bINFORMATION_SCHEMA\b/i, name: 'INFORMATION_SCHEMA' },
  { pattern: /\b(?:SLEEP|BENCHMARK|PG_SLEEP)\s*\(/i, name: 'SLEEP()/BENCHMARK() (time-based)' },
  { pattern: /\bWAITFOR\s+DELAY\b/i, name: 'WAITFOR DELAY' },
  { pattern: /\bXP_CMDSHELL\b/i, name: 'XP_CMDSHELL' },
  { pattern: /\bLOAD_FILE\s*\(/i, name: 'LOAD_FILE()' },
  { pattern: /\bINTO\s+OUTFILE\b/i, name: 'INTO OUTFILE' },
  { pattern: /\bINTO\s+DUMPFILE\b/i, name: 'INTO DUMPFILE' },
  { pattern: /'?\s*OR\s+\d+\s*=\s*\d+/i, name: 'OR 1=1' },
  { pattern: /'?\s*OR\s+'[\s\S]*?'\s*=\s*'[\s\S]*?'/i, name: "OR 'x'='x'" },
  { pattern: /\bAND\s+\d+\s*=\s*\d+/i, name: 'AND 1=1' },
  { pattern: /\bOR\b[^\n]{0,40}\bLIKE\b/i, name: 'OR ... LIKE' },
  { pattern: /--\s*$/m, name: 'Commentaire SQL (--)' },
  { pattern: /\/\*/, name: 'Commentaire SQL (/*)' },
  { pattern: /\bCONCAT\s*\(/i, name: 'CONCAT()' },
  { pattern: /\bCHAR\s*\(/i, name: 'CHAR()' },
  { pattern: /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT)\b/i, name: 'Requête empilée (;)' },
];

function scanValue(value: unknown, out: SqlMatch[]): void {
  if (typeof value === 'string') {
    for (const { pattern, name } of SQL_PATTERNS) {
      if (pattern.test(value)) {
        out.push({ name, input: value });
        return;
      }
    }
  } else if (Array.isArray(value)) {
    for (const v of value) scanValue(v, out);
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) scanValue(v, out);
  }
}

export function sqlGuard(req: Request, res: Response, next: NextFunction): void {
  const matches: SqlMatch[] = [];

  if (req.body !== undefined) scanValue(req.body, matches);
  if (req.query && Object.keys(req.query).length > 0) scanValue(req.query, matches);
  if (req.url) scanValue(req.url, matches);

  if (matches.length === 0) {
    next();
    return;
  }

  const match = matches[0];
  console.warn(
    `[SQL-GUARD] Tentative d'injection SQL (${match.name}) depuis ${req.ip || 'inconnu'} sur ${req.method} ${req.originalUrl}`,
  );
  enqueueSqlInjectionAlert(req, match).catch(() => {});

  res.status(400).json({ error: 'Requête rejetée' });
}
