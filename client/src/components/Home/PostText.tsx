import { Link } from 'react-router-dom';

const TOKEN_RE = /(?<=^|\s)@[a-z0-9_]{1,50}|#[\p{L}\p{N}_]+/gu;

interface PostTextProps {
  text: string;
}

export default function PostText({ text }: PostTextProps) {
  const parts = text.split(TOKEN_RE);
  let hashtagCount = 0;
  let mentionCount = 0;

  return (
    <>
      {parts.map((part) => {
        if (part.length > 1 && part.startsWith('#')) {
          hashtagCount += 1;
          const tag = part.slice(1);
          return (
            <Link
              key={`h-${tag}-${hashtagCount}`}
              to={`/hashtag/${encodeURIComponent(tag)}`}
              className="text-brand hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        if (part.length > 1 && part.startsWith('@')) {
          mentionCount += 1;
          const handle = part.slice(1);
          return (
            <Link
              key={`m-${handle}-${mentionCount}`}
              to={`/@${handle}`}
              className="text-brand font-semibold bg-brand/10 rounded px-0.5 hover:bg-brand/20 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        return part;
      })}
    </>
  );
}
