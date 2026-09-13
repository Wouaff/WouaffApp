const MAX_ENTRIES = 10000;

const attempts = new Map<string, { count: number; expires: number }>();

function prune(): void {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.expires < now) attempts.delete(key);
  }
}
setInterval(prune, 60000).unref();

export function tooManyAttempts(key: string, max: number): boolean {
  const entry = attempts.get(key);
  if (!entry || entry.expires < Date.now()) return false;
  return entry.count >= max;
}

export function registerAttemptFailure(key: string, windowMs: number): number {
  const now = Date.now();
  let entry = attempts.get(key);
  if (!entry || entry.expires < now) {
    entry = { count: 0, expires: now + windowMs };
  }
  entry.count++;
  if (attempts.size >= MAX_ENTRIES && !attempts.has(key)) {
    const oldest = attempts.keys().next().value;
    if (oldest !== undefined) attempts.delete(oldest);
  }
  attempts.set(key, entry);
  return entry.count;
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}
