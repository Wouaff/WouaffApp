/* Safe JSON parse, returns fallback instead of throwing */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/* Safe JSON stringify, returns fallback instead of throwing */
export function safeJsonStringify(value: unknown, fallback = ''): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

/* Call a function safely inside a try-catch */
export function safeCall<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export async function safeAsyncCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/* Strip dangerous HTML tags and attributes (XSS prevention) */
const XSS_PATTERN =
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|on\w+\s*=|javascript\s*:|data\s*:\s*text\/html|document\.|alert\s*\(|fetch\s*\(|eval\s*\(/gi;
export function sanitizeHtml(html: string): string {
  return html.replace(XSS_PATTERN, '');
}
