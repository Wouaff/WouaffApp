import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createTransport } from 'nodemailer';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '"Wouaff" <noreply@example.com>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const transporter = createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

let lastError: string | null = null;

export function getLastEmailError(): string | null {
  return lastError;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function genCode(): string {
  const values = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(values, (v) => CODE_CHARS[v % CODE_CHARS.length]).join('');
}

export async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject: `Votre code de vérification — Wouaff`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f5f5f5;padding:40px 20px}.card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.08)}.logo{text-align:center;font-size:24px;font-weight:700;color:#f97b3b;margin-bottom:20px}h2{text-align:center;color:#1a1a2e;margin:0 0 8px}p{color:#555;line-height:1.6;text-align:center;margin:0 0 24px}.code{display:block;width:fit-content;margin:0 auto 24px;padding:16px 32px;background:#f97b3b;color:#fff;font-size:28px;font-weight:800;letter-spacing:6px;border-radius:12px}.footer{text-align:center;color:#999;font-size:12px;margin-top:24px}</style></head><body><div class="card"><div class="logo">Wouaff</div><h2>Votre code de vérification</h2><p>Merci de votre inscription ! Saisissez le code ci-dessous pour confirmer votre adresse email.</p><span class="code">${code}</span><div class="footer">Si vous n'avez pas créé de compte, ignorez cet email.</div></div></body></html>`,
    });
    lastError = null;
    return true;
  } catch (err) {
    lastError = (err as { message?: string }).message ?? null;
    console.error('[EMAIL] sendVerification error:', (err as { message?: string }).message);
    return false;
  }
}

export async function send2FAEmail(to: string, code: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject: `Votre code de connexion : ${code} — Wouaff`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f5f5f5;padding:40px 20px}.card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.08)}.logo{text-align:center;font-size:24px;font-weight:700;color:#7c3aed;margin-bottom:20px}h2{text-align:center;color:#1a1a2e;margin:0 0 8px}p{color:#555;line-height:1.6;text-align:center;margin:0 0 24px}.code{display:block;width:fit-content;margin:0 auto 24px;padding:16px 32px;background:#7c3aed;color:#fff;font-size:32px;font-weight:800;letter-spacing:8px;border-radius:12px}.footer{text-align:center;color:#999;font-size:12px;margin-top:24px}</style></head><body><div class="card"><div class="logo">Wouaff</div><h2>Votre code de connexion</h2><p>Une tentative de connexion est en cours. Saisissez ce code pour la valider (valable 10 minutes).</p><span class="code">${code}</span><p style="font-size:12px;color:#888">Si vous n'êtes pas à l'origine de cette connexion, changez immédiatement votre mot de passe.</p><div class="footer">Wouaff · Sécurité de votre compte</div></div></body></html>`,
    });
    lastError = null;
    return true;
  } catch (err) {
    lastError = (err as { message?: string }).message ?? null;
    console.error('[EMAIL] send2FA error:', (err as { message?: string }).message);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const link = `${APP_URL}/reset-password?token=${token}`;
  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject: 'Réinitialisation de mot de passe — Wouaff',
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f5f5f5;padding:40px 20px}.card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.08)}.logo{text-align:center;font-size:24px;font-weight:700;color:#7c3aed;margin-bottom:20px}h2{text-align:center;color:#1a1a2e;margin:0 0 8px}p{color:#555;line-height:1.6;text-align:center;margin:0 0 24px}.btn{display:inline-block;padding:14px 32px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px}.btn-wrap{text-align:center}.footer{text-align:center;color:#999;font-size:12px;margin-top:24px}</style></head><body><div class="card"><div class="logo">Wouaff</div><h2>Réinitialisation de mot de passe</h2><p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en définir un nouveau.</p><div class="btn-wrap"><a class="btn" href="${link}">Réinitialiser mon mot de passe</a></div><p style="margin-top:24px;font-size:13px;color:#888">Ou copiez ce lien :<br><span style="color:#7c3aed;word-break:break-all">${link}</span></p><div class="footer">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</div></div></body></html>`,
    });
    lastError = null;
    return true;
  } catch (err) {
    lastError = (err as { message?: string }).message ?? null;
    console.error('[EMAIL] sendPasswordReset error:', (err as { message?: string }).message);
    return false;
  }
}
