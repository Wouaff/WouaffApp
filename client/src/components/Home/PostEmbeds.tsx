import { useEffect, useMemo, useState } from 'react';
import { renderLinkPreviews } from '../../utils/chatHelpers';
import { fetchLinkPreview, getSocialEmbed, type LinkPreview, parseUrls } from '../../utils/links';

interface PostEmbedsProps {
  text: string;
}

/* Rend les embeds (sociaux + aperçus de liens) pour les URLs présentes dans un post */
export default function PostEmbeds({ text }: PostEmbedsProps) {
  const urls = useMemo(() => [...new Set(parseUrls(text))], [text]);
  const [previews, setPreviews] = useState<Record<string, LinkPreview | null>>({});

  // biome-ignore lint/correctness/useExhaustiveDependencies: previews délibérément exclues (mise à jour via setPreviews)
  useEffect(() => {
    let cancelled = false;
    const pending = urls.filter((u) => !(u in previews));
    if (pending.length === 0) return;
    Promise.all(
      pending.map(async (u) => {
        const p = await fetchLinkPreview(u);
        return { u, p };
      }),
    ).then((results) => {
      if (cancelled) return;
      setPreviews((prev) => {
        const next = { ...prev };
        for (const { u, p } of results) next[u] = p;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls]);

  if (urls.length === 0) return null;

  return (
    <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      {urls.map((url) => {
        const embed = getSocialEmbed(url);
        if (embed) {
          return (
            <div key={url}>
              <iframe
                src={embed.src}
                title="Embed social"
                className="w-full rounded-2xl border border-[var(--border)] bg-black"
                style={{ height: embed.height }}
                loading="lazy"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-presentation"
              />
            </div>
          );
        }
        return renderLinkPreviews(url, previews);
      })}
    </div>
  );
}
