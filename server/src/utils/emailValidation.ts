const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DISPOSABLE_DOMAINS = new Set([
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'tmpmail.net',
  'tmpmail.org',
  'throwaway.email',
  'throwawaymail.com',
  'tempail.com',
  'tempmailo.com',
  'dispostable.com',
  'mailinator.com',
  'maildrop.cc',
  'mailnesia.com',
  'yopmail.com',
  'yopmail.fr',
  'fakeinbox.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'grr.la',
  'disposableemailaddresses.emailmiser.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'trashmail.me',
  'harakirimail.com',
  'tempr.email',
  'discard.email',
  'discardmail.com',
  'mohmal.com',
  'getnada.com',
  'emailondeck.com',
  '33mail.com',
  'mytemp.email',
  'burnermail.io',
  'tmail.ws',
  'tmail.io',
  'spamgourmet.com',
  'spaml.com',
  'nomail.xl.cx',
  'no-spam.ws',
  'netrosys.ml',
  'mailexpire.com',
  'fake.email',
  'jnxjn.com',
]);

export function isValidEmail(email: string): boolean {
  if (!EMAIL_RE.test(email)) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return false;
  return true;
}
