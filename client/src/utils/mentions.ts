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
  if (text[i] !== '@') return null;
  const start = i;
  let j = start + 1;
  let end = j;
  while (j < text.length && isWordChar(text[j])) {
    end = j + 1;
    j += 1;
  }
  if (start > 0 && isWordChar(text[start - 1])) return null;
  return { start, end, query: text.slice(start, end).slice(1).toLowerCase() };
}

export function replaceMentionAt(text: string, token: MentionToken, replacement: string): string {
  return text.slice(0, token.start) + replacement + text.slice(token.end);
}
