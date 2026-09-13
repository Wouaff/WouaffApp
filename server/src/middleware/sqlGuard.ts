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
  { pattern: /'?\s{0,10}OR\s{1,10}\d{1,20}\s{0,10}=\s{0,10}\d{1,20}/i, name: 'OR 1=1' },
  { pattern: /'?\s{0,10}OR\s{1,10}'[^']{0,80}'\s{0,10}=\s{0,10}'[^']{0,80}'/i, name: "OR 'x'='x'" },
  { pattern: /\bAND\s{1,10}\d{1,20}\s{0,10}=\s{0,10}\d{1,20}/i, name: 'AND 1=1' },
  { pattern: /\bOR\b[^\n]{0,40}\bLIKE\b/i, name: 'OR ... LIKE' },
  { pattern: /--\s*$/m, name: 'Commentaire SQL (--)' },
  { pattern: /\/\*/, name: 'Commentaire SQL (/*)' },
  { pattern: /\bCONCAT\s*\(/i, name: 'CONCAT()' },
  { pattern: /\bCHAR\s*\(/i, name: 'CHAR()' },
  { pattern: /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT)\b/i, name: 'Requête empilée (;)' },
];

/* Bornes de scan : neutralise les ReDoS des motifs et l'amplification par entrée géante */
const MAX_SCAN_LENGTH = 4096;
const MAX_SCAN_VALUES = 200;
const MAX_MATCH_INPUT = 500;

interface ScanBudget {
  remaining: number;
}

function scanValue(value: unknown, out: SqlMatch[], budget: ScanBudget): void {
  if (budget.remaining <= 0) return;
  if (typeof value === 'string') {
    budget.remaining--;
    const probe = value.length > MAX_SCAN_LENGTH ? value.slice(0, MAX_SCAN_LENGTH) : value;
    for (const { pattern, name } of SQL_PATTERNS) {
      if (pattern.test(probe)) {
        out.push({ name, input: value.slice(0, MAX_MATCH_INPUT) });
        return;
      }
    }
  } else if (Array.isArray(value)) {
    for (const v of value) {
      if (budget.remaining <= 0) return;
      scanValue(v, out, budget);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) {
      if (budget.remaining <= 0) return;
      scanValue(v, out, budget);
    }
  }
}

/* Quota global d'alertes : borne l'amplification (job DB + webhook) */
const ALERT_BUDGET_PER_MINUTE = 30;
let alertBudget = ALERT_BUDGET_PER_MINUTE;
setInterval(() => {
  alertBudget = ALERT_BUDGET_PER_MINUTE;
}, 60000).unref();

/* Cooldown par IP + motif : une alerte par minute maximum pour un même couple */
const ALERT_COOLDOWN_MS = 60000;
const MAX_COOLDOWN_ENTRIES = 5000;
const alertCooldown = new Map<string, number>();

function shouldAlert(key: string): boolean {
  const now = Date.now();
  const last = alertCooldown.get(key);
  if (last && now - last < ALERT_COOLDOWN_MS) return false;
  if (alertCooldown.size >= MAX_COOLDOWN_ENTRIES && !alertCooldown.has(key)) {
    const oldest = alertCooldown.keys().next().value;
    if (oldest !== undefined) alertCooldown.delete(oldest);
  }
  alertCooldown.set(key, now);
  return true;
}

export function sqlGuard(req: Request, res: Response, next: NextFunction): void {
  const matches: SqlMatch[] = [];
  const budget: ScanBudget = { remaining: MAX_SCAN_VALUES };

  if (req.body !== undefined) scanValue(req.body, matches, budget);
  if (req.query && Object.keys(req.query).length > 0) scanValue(req.query, matches, budget);
  if (req.url) scanValue(req.url, matches, budget);

  if (matches.length === 0) {
    next();
    return;
  }

  const match = matches[0];
  console.warn(
    `[SQL-GUARD] Tentative d'injection SQL (${match.name}) depuis ${req.ip || 'inconnu'} sur ${req.method} ${req.originalUrl}`,
  );
  const key = `${req.ip || 'inconnu'}:${match.name}`;
  if (alertBudget > 0 && shouldAlert(key)) {
    alertBudget--;
    enqueueSqlInjectionAlert(req, match).catch(() => {});
  }

  res.status(400).json({ error: 'Requête rejetée' });
}
