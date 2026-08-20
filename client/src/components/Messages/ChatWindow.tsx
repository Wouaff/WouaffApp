import { ArrowLeft, ImagePlus, Send, Smile, X } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { emitTypingDM, emitTypingGroup } from '../../services/socket';
import type { MessageData } from '../../types';
import EmojiPicker from '../Common/EmojiPicker';
import { MessageBubble } from './MessageBubble';

export interface ChatTarget {
  id: string;
  type: 'dm' | 'group';
  name: string;
  avatar?: string;
  online?: boolean;
  memberCount?: number;
}

interface ChatWindowProps {
  conv: ChatTarget;
  meUid: string;
  myPseudo: string;
  myAvatar?: string;
  senderNames: Record<string, string>;
  senderAvatars: Record<string, string>;
  isMobile?: boolean;
  messages: Record<string, MessageData>;
  hasMore: boolean;
  loading: boolean;
  typing: string | null;
  onLoadMore: () => void;
  onSend: (text: string, imageData?: string) => Promise<void>;
  onBack: () => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resizeImage(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image invalide'));
      img.src = dataUrl;
    });
    const MAX_DIM = 1600;
    let { width, height } = img;
    const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
    if (scale < 1) {
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, width, height);
    const isPng = file.type === 'image/png';
    return canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.85);
  } catch {
    return dataUrl;
  }
}

export const ChatWindow = memo(function ChatWindow({
  conv,
  meUid,
  myPseudo,
  myAvatar,
  senderNames,
  senderAvatars,
  isMobile,
  messages,
  hasMore,
  loading,
  typing,
  onLoadMore,
  onSend,
  onBack,
}: ChatWindowProps) {
  const [text, setText] = useState('');
  const [imageData, setImageData] = useState<string | undefined>(undefined);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const typingStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stickBottom = useRef(true);

  const entries = Object.entries(messages).sort((a, b) => a[1].time - b[1].time);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    stickBottom.current = true;
    void conv.id;
    scrollToBottom();
  }, [conv.id, scrollToBottom]);

  useEffect(() => {
    void messages;
    if (stickBottom.current) scrollToBottom(true);
  }, [messages, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 60 && hasMore && !loadingMore) {
      setLoadingMore(true);
      onLoadMore();
    }
  };

  useEffect(() => {
    if (!loadingMore) return;
    const t = setTimeout(() => setLoadingMore(false), 600);
    return () => clearTimeout(t);
  }, [loadingMore]);

  const handleTyping = (value: string) => {
    setText(value);
    if (typingStop.current) clearTimeout(typingStop.current);
    if (conv.type === 'dm') emitTypingDM(conv.id, true);
    else emitTypingGroup(conv.id, true);
    typingStop.current = setTimeout(() => {
      if (conv.type === 'dm') emitTypingDM(conv.id, false);
      else emitTypingGroup(conv.id, false);
    }, 1600);
  };

  const send = async () => {
    const t = text.trim();
    if ((!t && !imageData) || sending) return;
    setSending(true);
    await onSend(t, imageData);
    setText('');
    setImageData(undefined);
    setEmojiOpen(false);
    setSending(false);
    stickBottom.current = true;
    scrollToBottom(true);
    if (typingStop.current) clearTimeout(typingStop.current);
    if (conv.type === 'dm') emitTypingDM(conv.id, false);
    else emitTypingGroup(conv.id, false);
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await resizeImage(file);
      setImageData(data);
    } catch {
      /* fichier illisible */
    }
  };

  const senderLabel = (from: string): string => {
    if (from === meUid) return myPseudo || 'Vous';
    if (from === 'pendingFrom') return 'Utilisateur';
    return senderNames[from] || 'Utilisateur';
  };

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="chat-topbar">
        <button
          type="button"
          className="chat-back-btn"
          onClick={onBack}
          aria-label="Retour"
          style={isMobile ? { display: 'flex' } : undefined}
        >
          <ArrowLeft size={20} />
        </button>
        <div
          className="chat-info"
          onClick={() => {
            /* navigation profil gérée par la page */
          }}
        >
          <div id="chatName">
            <span className="truncate">{conv.name}</span>
            {conv.type === 'group' && (
              <span className="group-icon">{conv.memberCount ? `${conv.memberCount} membres` : 'Groupe'}</span>
            )}
          </div>
          <div id="chatStatus" className={conv.online ? 'online' : undefined}>
            {typing ? (
              <span className="typing-dots">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            ) : conv.type === 'group' ? (
              'Conversation de groupe'
            ) : conv.online ? (
              'En ligne'
            ) : (
              'Hors ligne'
            )}
          </div>
        </div>
      </div>

      <div className="messages" ref={scrollRef} onScroll={onScroll}>
        {hasMore && (
          <div className="text-center text-[12px] text-[var(--text-muted)] py-1">
            {loadingMore ? 'Chargement…' : 'Défiler pour charger plus'}
          </div>
        )}
        <div ref={topRef} />
        {loading && entries.length === 0 && (
          <div className="text-center text-[13px] text-[var(--text-muted)] py-8">Chargement…</div>
        )}
        {!loading && entries.length === 0 && (
          <div className="text-center text-[13px] text-[var(--text-muted)] py-8">Aucun message. Dites bonjour ! 👋</div>
        )}
        {entries.map(([key, msg]) => {
          const mine = msg.from === meUid;
          const showSender = conv.type === 'group' && !mine;
          const recvAvatar = conv.type === 'group' ? senderAvatars[msg.from] : conv.avatar;
          const avatarUrl = mine ? myAvatar : recvAvatar;
          const initial = senderLabel(msg.from)[0]?.toUpperCase() || '?';
          const avatarEl = (
            <div className={`msg-avatar flex-shrink-0 ${mine ? 'msg-avatar-mine' : ''}`}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span>{mine ? myPseudo[0]?.toUpperCase() || '?' : initial}</span>
              )}
            </div>
          );
          return (
            <div key={key} className={`msg-wrapper ${mine ? 'sent' : 'recv'}`}>
              {!mine && avatarEl}
              {mine ? (
                <div className="msg-row flex items-end gap-2 min-w-0">
                  <MessageBubble
                    msg={msg}
                    isMine={mine}
                    showSender={showSender}
                    senderName={showSender ? senderLabel(msg.from) : undefined}
                    convId={conv.id}
                    isGroup={conv.type === 'group'}
                  />
                  {avatarEl}
                </div>
              ) : (
                <MessageBubble
                  msg={msg}
                  isMine={mine}
                  showSender={showSender}
                  senderName={showSender ? senderLabel(msg.from) : undefined}
                  convId={conv.id}
                  isGroup={conv.type === 'group'}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="msg-input-area">
        <div className="emoji-wrapper">
          <button
            type="button"
            className="input-action-btn"
            onClick={() => setEmojiOpen((o) => !o)}
            aria-label="Emojis"
          >
            <Smile size={20} />
          </button>
          {emojiOpen && (
            <EmojiPicker
              onEmojiSelect={(emoji) => {
                setText((t) => t + emoji);
                setEmojiOpen(false);
              }}
            />
          )}
        </div>
        <button
          type="button"
          className="input-action-btn"
          onClick={() => fileRef.current?.click()}
          aria-label="Envoyer une image"
        >
          <ImagePlus size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickImage(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          {imageData && (
            <div className="relative mb-2 w-max">
              <img src={imageData} alt="" className="max-h-32 rounded-xl border border-[var(--border)]" />
              <button
                type="button"
                onClick={() => setImageData(undefined)}
                aria-label="Retirer l'image"
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] flex items-center justify-center cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          )}
          <input
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Écrire un message…"
            aria-label="Message"
          />
        </div>
        <button
          type="button"
          className="send-btn"
          onClick={send}
          disabled={(!text.trim() && !imageData) || sending}
          aria-label="Envoyer"
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
});
