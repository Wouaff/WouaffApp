export const MENTION_TOKEN_RE = /@[a-z0-9_]{1,50}/gi;
export const MENTION_WORD_RE = /(^|\s)@([a-z0-9_]{1,50})/gi;

export interface MentionToken {
  start: number;
  end: number;
  query: string;
}

function isWordChar(ch: string): boolean {
  return /[a-z0-9_]/i.test(ch);
}

export function getMentionAt(text: string, caret: number): MentionToken | null {
  if (caret <= 0 || caret > text.length + 1) return null;
  let i = caret - 1;
  if (i >= text.length) i = text.length - 1;
  if (i < 0) return null;
  const ch = text[i];
  if (ch !== '@' && !isWordChar(ch)) return null;
  let start = i;
  while (start >= 0 && text[start] !== '@' && isWordChar(text[start])) start -= 1;
  if (start < 0 || text[start] !== '@') return null;
  if (start > 0 && !/\s/.test(text[start - 1])) return null;
  let end = start + 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  return { start, end, query: text.slice(start + 1, end).toLowerCase() };
}

export function replaceMentionAt(text: string, token: MentionToken, replacement: string): string {
  return text.slice(0, token.start) + replacement + text.slice(token.end);
}
