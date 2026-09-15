const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;
const MAX_TAG_LENGTH = 80;

/**
 * Hashtags contenus dans un texte, sans le '#', dédupliqués, dans l'orthographe d'origine.
 * Insensible à la casse à l'intérieur d'un même texte : `#Wouaff` et `#wouaff` ne comptent
 * qu'une fois. Le regroupement entre textes se fait sur la version minuscule.
 */
export function extractHashtags(text: string): string[] {
  const tags = new Map<string, string>();
  HASHTAG_RE.lastIndex = 0;
  let match = HASHTAG_RE.exec(text);
  while (match) {
    const raw = match[1];
    if (raw.length <= MAX_TAG_LENGTH) {
      const key = raw.toLowerCase();
      if (!tags.has(key)) tags.set(key, raw);
    }
    match = HASHTAG_RE.exec(text);
  }
  return [...tags.values()];
}

export interface HashtagTrend {
  tag: string;
  count: number;
}

/**
 * Compte, pour chaque hashtag, le nombre de textes (= de posts) qui le contiennent — une
 * occurrence multiple dans un même post ne compte qu'une fois.
 *
 * Les textes doivent être fournis du plus récent au plus ancien : l'orthographe affichée
 * est celle du post le plus récent. Trié par nombre de posts décroissant, puis par tag.
 */
export function countHashtags(texts: Iterable<string | null | undefined>): HashtagTrend[] {
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const text of texts) {
    if (!text) continue;
    for (const spelling of extractHashtags(text)) {
      const key = spelling.toLowerCase();
      if (!labels.has(key)) labels.set(key, spelling);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ tag: `#${labels.get(key) ?? key}`, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
