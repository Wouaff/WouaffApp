import type { Request } from 'express';

const TRUST_CF =
  process.env.TRUST_CF_CONNECTING_IP === '1' ||
  process.env.TRUST_CF_CONNECTING_IP === 'true' ||
  process.env.TRUST_CF_CONNECTING_IP === 'yes';

export function getClientIp(req: Request): string {
  if (TRUST_CF) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim();
  }
  return (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}
