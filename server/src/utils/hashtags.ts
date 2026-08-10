const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;
const MAX_TAG_LENGTH = 80;

export function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  HASHTAG_RE.lastIndex = 0;
  let match = HASHTAG_RE.exec(text);
  while (match) {
    const raw = match[1];
    const tag = raw.toLowerCase();
    if (tag.length <= MAX_TAG_LENGTH) tags.add(tag);
    match = HASHTAG_RE.exec(text);
  }
  return [...tags];
}
