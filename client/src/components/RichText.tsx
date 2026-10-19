import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/* #hashtag, @mention ou lien http(s). Les autres schémas (javascript:, data:…) ne sont jamais rendus en lien. */
const TOKEN_RE = /(https?:\/\/[^\s<]+)|(^|[^\w])@([a-zA-Z0-9_]{3,30})|#([\p{L}\p{N}_]{1,80})/gu;

export default function RichText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const index = m.index ?? 0;
    if (m[1]) {
      /* on ne garde pas la ponctuation finale dans le lien */
      const url = m[1].replace(/[.,;:!?)]+$/, '');
      nodes.push(text.slice(last, index));
      nodes.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all">
          {url.replace(/^https?:\/\//, '')}
        </a>,
      );
      nodes.push(m[1].slice(url.length));
    } else if (m[3]) {
      nodes.push(text.slice(last, index + m[2].length));
      nodes.push(
        <Link key={key++} to={`/${m[3]}`}>
          @{m[3]}
        </Link>,
      );
    } else if (m[4]) {
      nodes.push(text.slice(last, index));
      nodes.push(
        <Link key={key++} to={`/tag/${encodeURIComponent(m[4])}`}>
          #{m[4]}
        </Link>,
      );
    }
    last = index + m[0].length;
  }
  nodes.push(text.slice(last));
  return (
    <>
      {nodes.map((n, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fragments de texte statiques, ordre stable
        <Fragment key={i}>{n}</Fragment>
      ))}
    </>
  );
}
