import type { MessageData } from '../types';
import type { LinkPreview } from './links';
import { parseUrls, textToParts } from './links';

export const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '😍'];

export const EMOJI_CATEGORIES: Array<{ name: string; items: string[] }> = [
  {
    name: 'Sourires',
    items: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😅',
      '😂',
      '🤣',
      '😊',
      '😇',
      '🙂',
      '🙃',
      '😉',
      '😌',
      '😍',
      '🥰',
      '😘',
      '😗',
      '😙',
      '😚',
      '😋',
      '😛',
      '😜',
      '🤪',
      '😝',
      '🤑',
      '🤗',
      '🤭',
      '🤫',
      '🤔',
      '🤐',
      '🤨',
      '😐',
      '😑',
      '😶',
      '😏',
      '😒',
      '🙄',
      '😬',
      '🤥',
      '😌',
      '😔',
      '😪',
      '🤤',
      '😴',
      '😷',
      '🤒',
      '🤕',
      '🤢',
      '🤮',
      '🥴',
      '😵',
      '🤯',
      '🤠',
      '🥳',
      '😎',
      '🤓',
      '🧐',
      '😕',
      '😟',
      '🙁',
      '😮',
      '😯',
      '😲',
      '😳',
      '🥺',
      '😦',
      '😧',
      '😨',
      '😰',
      '😥',
      '😢',
      '😭',
      '😱',
      '😖',
      '😣',
      '😞',
      '😓',
      '😩',
      '😫',
      '🥱',
      '😤',
      '😡',
      '😠',
      '🤬',
      '😈',
      '👿',
      '💀',
      '☠️',
      '💩',
      '🤡',
      '👹',
      '👺',
      '👻',
      '👽',
      '👾',
      '🤖',
    ],
  },
  {
    name: 'Gestes',
    items: [
      '👍',
      '👎',
      '👊',
      '✊',
      '🤛',
      '🤜',
      '👏',
      '🙌',
      '👐',
      '🤲',
      '🤝',
      '🙏',
      '✌️',
      '🤞',
      '🖕',
      '🤟',
      '👌',
      '🤌',
      '🤏',
      '🫵',
      '🫱',
      '🫲',
      '🫳',
      '🫴',
      '✋',
      '🤚',
      '🖐️',
      '🖖',
      '👋',
      '🤙',
      '💪',
      '🦵',
      '🦶',
      '👂',
      '🦻',
      '👃',
      '🧠',
      '🫀',
      '🫁',
      '🦷',
      '🦴',
      '👀',
      '👁️',
      '👅',
      '👄',
    ],
  },
  {
    name: 'Cœurs',
    items: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💕',
      '💞',
      '💗',
      '💖',
      '💘',
      '💝',
      '💟',
      '❣️',
      '💔',
      '❤️‍🔥',
      '❤️‍🩹',
    ],
  },
  {
    name: 'Objets',
    items: [
      '🎉',
      '🎊',
      '🎈',
      '🎁',
      '🎀',
      '🪄',
      '🎯',
      '🎲',
      '🎮',
      '🏆',
      '🥇',
      '🥈',
      '🥉',
      '🏅',
      '🎖️',
      '🏵️',
      '🎗️',
      '🔮',
      '💎',
      '👑',
      '💍',
      '🧿',
      '📿',
      '💄',
      '👗',
      '👠',
      '👟',
      '👔',
      '👕',
      '🧢',
      '🎩',
      '🕶️',
      '💼',
      '📷',
      '📸',
      '📱',
      '💻',
      '⌚',
      '🔑',
      '🗝️',
      '🔒',
      '🔓',
      '📝',
      '✏️',
      '📖',
      '📚',
      '📌',
      '📍',
      '🧷',
      '✂️',
      '🖇️',
      '📎',
    ],
  },
  {
    name: 'Nourriture',
    items: [
      '🍎',
      '🍊',
      '🍋',
      '🍌',
      '🍉',
      '🍇',
      '🍓',
      '🫐',
      '🍈',
      '🍒',
      '🍑',
      '🥭',
      '🍍',
      '🥝',
      '🍅',
      '🥑',
      '🥦',
      '🥬',
      '🥒',
      '🌽',
      '🥕',
      '🧄',
      '🧅',
      '🥔',
      '🍠',
      '🍞',
      '🥖',
      '🥨',
      '🧀',
      '🥚',
      '🍳',
      '🥞',
      '🧇',
      '🥓',
      '🥩',
      '🍗',
      '🍖',
      '🌭',
      '🍔',
      '🍟',
      '🍕',
      '🥪',
      '🥙',
      '🧆',
      '🌮',
      '🌯',
      '🥗',
      '🥘',
      '🍝',
      '🍜',
      '🍲',
      '🍛',
      '🍣',
      '🍤',
      '🥟',
      '🍱',
      '🍚',
      '🦪',
      '🍘',
      '🍙',
      '🥠',
      '🥮',
      '🍡',
      '🍧',
      '🍨',
      '🍦',
      '🥧',
      '🧁',
      '🍰',
      '🎂',
      '🍮',
      '🍭',
      '🍬',
      '🍫',
      '🍿',
      '🍩',
      '🍪',
      '🥜',
      '🌰',
      '☕',
      '🫖',
      '🍵',
      '🧋',
      '🥤',
      '🧃',
      '🍶',
      '🍺',
      '🍻',
      '🥂',
      '🍷',
      '🥃',
      '🍸',
      '🍹',
      '🧉',
    ],
  },
  {
    name: 'Animaux',
    items: [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐻‍❄️',
      '🐨',
      '🐯',
      '🦁',
      '🐮',
      '🐷',
      '🐸',
      '🐵',
      '🙈',
      '🙉',
      '🙊',
      '🐒',
      '🐔',
      '🐧',
      '🐦',
      '🐤',
      '🐣',
      '🐥',
      '🦆',
      '🦅',
      '🦉',
      '🦇',
      '🐺',
      '🐗',
      '🐴',
      '🦄',
      '🐝',
      '🪱',
      '🐛',
      '🦋',
      '🐌',
      '🐞',
      '🐜',
      '🪰',
      '🪲',
      '🪳',
      '🦟',
      '🦗',
      '🕷️',
      '🦂',
      '🐢',
      '🐍',
      '🦎',
      '🦖',
      '🦕',
      '🐙',
      '🦑',
      '🦐',
      '🦞',
      '🦀',
      '🐡',
      '🐠',
      '🐟',
      '🐬',
      '🐳',
      '🐋',
      '🦈',
      '🐊',
      '🐅',
      '🐆',
      '🦓',
      '🦍',
      '🦧',
      '🐘',
      '🦛',
      '🦏',
      '🐪',
      '🐫',
      '🦒',
      '🦘',
      '🐃',
      '🐂',
      '🐄',
      '🐎',
      '🐖',
      '🐏',
      '🐑',
      '🦙',
      '🐐',
      '🦌',
      '🐕',
      '🐩',
      '🦮',
      '🐕‍🦺',
      '🐈',
      '🐈‍⬛',
      '🪶',
      '🐓',
      '🦃',
      '🦤',
      '🦚',
      '🦜',
      '🦢',
      '🦩',
      '🕊️',
      '🐇',
      '🦝',
      '🦨',
      '🦡',
      '🦫',
      '🦦',
      '🦥',
      '🐁',
      '🐀',
      '🐿️',
      '🦔',
      '🐾',
      '🐉',
      '🐲',
    ],
  },
  {
    name: 'Nature',
    items: [
      '🌵',
      '🎄',
      '🌲',
      '🌳',
      '🌴',
      '🪵',
      '🌱',
      '🌿',
      '☘️',
      '🍀',
      '🎍',
      '🪴',
      '🎋',
      '🍃',
      '🍂',
      '🍁',
      '🍄',
      '🐚',
      '🪸',
      '🌾',
      '💐',
      '🌷',
      '🌹',
      '🥀',
      '🌺',
      '🌸',
      '🌼',
      '🌻',
      '🌞',
      '🌝',
      '🌛',
      '🌜',
      '🌚',
      '🌕',
      '🌖',
      '🌗',
      '🌘',
      '🌑',
      '🌒',
      '🌓',
      '🌔',
      '🌙',
      '🌎',
      '🌍',
      '🌏',
      '🪐',
      '💫',
      '⭐',
      '🌟',
      '✨',
      '⚡',
      '☄️',
      '💥',
      '🔥',
      '🌪️',
      '🌈',
      '☀️',
      '🌤️',
      '⛅',
      '🌥️',
      '☁️',
      '🌦️',
      '🌧️',
      '⛈️',
      '🌩️',
      '🌨️',
      '❄️',
      '☃️',
      '⛄',
      '🌬️',
      '💨',
      '💧',
      '💦',
      '🫧',
      '🌊',
    ],
  },
];

export function formatTime(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function groupReactions(reactions: Record<string, string>): Record<string, string[]> {
  const counts: Record<string, string[]> = {};
  for (const [uid, emoji] of Object.entries(reactions)) {
    if (!counts[emoji]) counts[emoji] = [];
    counts[emoji].push(uid);
  }
  return counts;
}

export async function toggleReaction(mid: string, emoji: string, convId: string, isGroup: boolean) {
  try {
    const url = isGroup ? `/api/messages/group/${convId}/${mid}/reaction` : `/api/messages/${convId}/${mid}/reaction`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
  } catch (e) {
    console.error('Failed to toggle reaction:', e);
  }
}

export function downloadFile(msg: MessageData) {
  const a = document.createElement('a');
  a.href = msg.fileData || '';
  a.download = msg.fileName || 'fichier';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}

/* ── Markdown parsing ── */

interface MarkdownBlock {
  type: string;
  content?: string;
  children?: Array<{ type: string; content: string }>;
  ordered?: boolean;
  lang?: string;
}

function parseMarkdown(text: string): MarkdownBlock[] {
  const lines = text.split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: 'code', content: codeLines.join('\n'), lang });
      continue;
    }
    if (line.trimStart().startsWith('> ')) {
      const quoteLines: string[] = [line.trimStart().slice(2)];
      i++;
      while (i < lines.length && lines[i].trimStart().startsWith('> ')) {
        quoteLines.push(lines[i].trimStart().slice(2));
        i++;
      }
      blocks.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }
    if (/^\s*[-*+]\s/.test(line)) {
      const items: string[] = [line.replace(/^\s*[-*+]\s+/, '')];
      i++;
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', children: items.map((c) => ({ type: 'list-item', content: c })), ordered: false });
      continue;
    }
    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [line.replace(/^\s*\d+\.\s+/, '')];
      i++;
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', children: items.map((c) => ({ type: 'list-item', content: c })), ordered: true });
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*[-*+]\s/.test(lines[i]) &&
      !/^\s*\d+\.\s/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('> ') &&
      !lines[i].trimStart().startsWith('```')
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', content: paraLines.join('\n') });
  }
  return blocks;
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(`[^`]+`)|(\*\*(.+?)\*\*)|(__(.+?)__)|(\*(.+?)\*)|(_(.+?)_)|(~~(.+?)~~)/g;
  const _lastIndex = 0;
  const remaining: Array<{ start: number; end: number; node: React.ReactNode }> = [];
  let match: RegExpExecArray | null = regex.exec(text);
  while (match !== null) {
    if (match[1]) {
      remaining.push({
        start: match.index,
        end: match.index + match[0].length,
        node: (
          <code key={match.index} className="md-code">
            {match[1].slice(1, -1)}
          </code>
        ),
      });
    } else if (match[2]) {
      remaining.push({
        start: match.index,
        end: match.index + match[0].length,
        node: <strong key={match.index}>{renderInline(match[3])}</strong>,
      });
    } else if (match[4]) {
      remaining.push({
        start: match.index,
        end: match.index + match[0].length,
        node: <strong key={match.index}>{renderInline(match[5])}</strong>,
      });
    } else if (match[6]) {
      remaining.push({
        start: match.index,
        end: match.index + match[0].length,
        node: <em key={match.index}>{renderInline(match[7])}</em>,
      });
    } else if (match[8]) {
      remaining.push({
        start: match.index,
        end: match.index + match[0].length,
        node: <em key={match.index}>{renderInline(match[9])}</em>,
      });
    } else if (match[10]) {
      remaining.push({
        start: match.index,
        end: match.index + match[0].length,
        node: <del key={match.index}>{renderInline(match[11])}</del>,
      });
    }
    match = regex.exec(text);
  }
  let pos = 0;
  remaining.sort((a, b) => a.start - b.start);
  for (const seg of remaining) {
    if (seg.start > pos) {
      const raw = text.slice(pos, seg.start);
      const urlParts = textToParts(raw);
      for (const p of urlParts) {
        if (p.type === 'url') {
          nodes.push(
            <a
              key={`${pos}-${p.value}`}
              className="msg-link"
              href={p.value}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {p.value}
            </a>,
          );
        } else {
          nodes.push(<span key={`${pos}-${p.value}`}>{p.value}</span>);
        }
      }
    }
    nodes.push(seg.node);
    pos = seg.end;
  }
  if (pos < text.length) {
    const raw = text.slice(pos);
    const urlParts = textToParts(raw);
    for (const p of urlParts) {
      if (p.type === 'url') {
        nodes.push(
          <a
            key={`${pos}-${p.value}`}
            className="msg-link"
            href={p.value}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {p.value}
          </a>,
        );
      } else {
        nodes.push(<span key={`${pos}-${p.value}`}>{p.value}</span>);
      }
    }
  }
  return nodes;
}

function renderMarkdown(text: string): React.ReactNode {
  const blocks = parseMarkdown(text);
  return blocks.map((block) => {
    switch (block.type) {
      case 'code':
        return (
          <pre key={`code-${block.content || ''}`} className="md-pre">
            <code className="md-code-block">{block.content || ''}</code>
          </pre>
        );
      case 'blockquote':
        return (
          <blockquote key={`bq-${block.content || ''}`} className="md-blockquote">
            {renderInline(block.content || '')}
          </blockquote>
        );
      case 'list':
        if (block.ordered) {
          return (
            <ol key={`ol-${block.content || ''}`} className="md-ol">
              {block.children!.map((item) => (
                <li key={`li-${item.content}`} className="md-li">
                  {renderInline(item.content)}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <ul key={`ul-${block.content || ''}`} className="md-ul">
            {block.children!.map((item) => (
              <li key={`li-${item.content}`} className="md-li">
                {renderInline(item.content)}
              </li>
            ))}
          </ul>
        );
      default:
        return (
          <p key={`p-${block.content || ''}`} className="md-p">
            {renderInline(block.content || '')}
          </p>
        );
    }
  });
}

export function renderLinkifiedText(text: string): React.ReactNode {
  return renderMarkdown(text);
}

export function renderLinkPreviews(text: string, previews: Record<string, LinkPreview | null>): React.ReactNode {
  const urls = parseUrls(text);
  const unique = [...new Set(urls)];
  return unique.map((url) => {
    const preview = previews[url];
    if (!preview) return null;
    return (
      <a
        key={url}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="link-preview-card"
        onClick={(e) => e.stopPropagation()}
      >
        {preview.image && (
          <div className="link-preview-img-wrap">
            <img
              className="link-preview-img"
              src={preview.image}
              alt="Aperçu du lien"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="link-preview-body">
          <div className="link-preview-site">{preview.siteName}</div>
          <div className="link-preview-title">{preview.title}</div>
          {preview.description && <div className="link-preview-desc">{preview.description}</div>}
        </div>
      </a>
    );
  });
}
