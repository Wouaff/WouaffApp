import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

export function isMailEnabled(): boolean {
  return Boolean((process.env.SMTP_HOST || '').trim() && (process.env.SMTP_FROM || '').trim());
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!isMailEnabled()) {
    console.warn('[MAIL] SMTP non configuré : e-mail non envoyé');
    return false;
  }
  try {
    await getTransporter().sendMail({ from: process.env.SMTP_FROM, to, subject, text });
    return true;
  } catch (err) {
    console.error("[MAIL] Échec d'envoi:", (err as Error).message);
    return false;
  }
}
