import { memo } from 'react';
import type { MessageData } from '../../types';
import {
  formatTime,
  groupReactions,
  renderLinkifiedText,
  renderLinkPreviews,
  toggleReaction,
} from '../../utils/chatHelpers';
import type { LinkPreview } from '../../utils/links';
import { sanitizeHtml } from '../../utils/safe';
import VoiceMessage from './VoiceMessage';

interface MessageBubbleProps {
  mid: string;
  msg: MessageData;
  isSent: boolean;
  isGroup: boolean;
  groupClass?: string;
  prevSame: boolean;
  profiles: Record<string, { avatar?: string; pseudo?: string }>;
  allMessages: Record<string, MessageData>;
  linkPreviews: Record<string, LinkPreview | null>;
  user: { uid: string } | null;
  convId: string;
  currentGroupId: string | null;
  onOpenUserProfile?: (uid: string) => void;
  onContextMenu: (e: React.MouseEvent, mid: string, msg: MessageData) => void;
  onTouchStart?: (mid: string, msg: MessageData) => void;
  onTouchEnd?: () => void;
  onTouchMove?: () => void;
  onDownloadFile?: (fileData: string, fileName: string, fromUid: string) => void;
}

const MessageBubble = memo(function MessageBubble({
  mid,
  msg,
  isSent,
  isGroup,
  groupClass,
  prevSame,
  profiles,
  allMessages,
  linkPreviews,
  user,
  convId,
  currentGroupId,
  onOpenUserProfile,
  onContextMenu,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onDownloadFile,
}: MessageBubbleProps) {
  const p = profiles[msg.from];
  const initial = (p?.pseudo || '?')[0]?.toUpperCase() || '?';

  return (
    <div className={`msg-wrapper ${isSent ? 'sent' : 'recv'} ${groupClass || ''}`} data-mid={mid}>
      {!isSent && !prevSame && (
        <div className="msg-avatar">
          {p?.avatar ? <img src={p.avatar} alt="" loading="lazy" decoding="async" /> : <span>{initial}</span>}
        </div>
      )}
      {!isSent && prevSame && <div className="msg-avatar-placeholder" />}
      <div
        className={`msg-bubble${msg.messageTheme && msg.messageTheme !== 'default' ? ` theme-${msg.messageTheme}` : ''}`}
        role="presentation"
        onClick={(e) => {
          if (isGroup && !isSent && !prevSame) {
            const nameEl = (e.target as HTMLElement).closest('.msg-sender-name');
            if (nameEl) {
              if (onOpenUserProfile) onOpenUserProfile(msg.from);
              return;
            }
          }
          const chip = (e.target as HTMLElement).closest('.reaction-chip');
          if (chip) return;
        }}
        onContextMenu={(e) => onContextMenu(e, mid, msg)}
        onTouchStart={() => onTouchStart?.(mid, msg)}
        onTouchEnd={() => onTouchEnd?.()}
        onTouchMove={() => onTouchMove?.()}
      >
        {isGroup && !isSent && !prevSame && (
          <div className="msg-sender-name" title={msg.from}>
            {msg.senderName || profiles[msg.from]?.pseudo || ''}
          </div>
        )}
        {msg.replyTo && allMessages[msg.replyTo] && (
          <div className="reply-quote">
            <div className="reply-quote-name">Réponse</div>
            <div className="reply-quote-text">{allMessages[msg.replyTo].text?.substring(0, 60) || ''}</div>
          </div>
        )}
        {msg.forwardedFrom && <div className="msg-forwarded">Transféré</div>}
        {msg.deleted ? (
          <div className="msg-text deleted">🚫 Message supprimé</div>
        ) : msg.type === 'image' ? (
          <div className="msg-image">
            <img
              src={msg.imageData || msg.text}
              alt=""
              loading="lazy"
              decoding="async"
              onClick={() => window.open(msg.imageData || msg.text)}
              className="cursor-pointer max-w-full max-h-[300px] rounded-lg block"
            />
          </div>
        ) : msg.type === 'file' ? (
          <div className="msg-file">
            <button
              className="file-link"
              type="button"
              onClick={() => {
                if (onDownloadFile && msg.from !== user?.uid) {
                  onDownloadFile(msg.fileData || '', msg.fileName || 'Fichier', msg.from || '');
                } else {
                  const a = document.createElement('a');
                  a.href = msg.fileData || '';
                  a.download = msg.fileName || 'fichier';
                  a.style.display = 'none';
                  document.body.appendChild(a);
                  a.click();
                  setTimeout(() => a.remove(), 1000);
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
                aria-label={msg.fileName || 'Fichier'}
              >
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-3.06 16L7.4 14.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L10.94 18z" />
              </svg>
              <span className="file-name">{msg.fileName || 'Fichier'}</span>
            </button>
          </div>
        ) : msg.type === 'voice' ? (
          <VoiceMessage audioData={msg.audioData} duration={msg.duration} />
        ) : msg.html ? (
          <div className="msg-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.html) }} />
        ) : msg.text ? (
          <div className="msg-text">
            {renderLinkifiedText(msg.text)}
            {renderLinkPreviews(msg.text, linkPreviews)}
          </div>
        ) : null}
        <div className="msg-footer">
          {!!msg.pinned && <span className="msg-pinned">📌</span>}
          {!!msg.ephemeralDuration && (
            <span className="msg-ephemeral" title="Message éphémère">
              🕐
            </span>
          )}
          {!!msg.edited && <span className="msg-edited">modifié</span>}
          <span className="msg-time">{formatTime(msg.time)}</span>
          {isSent &&
            (currentGroupId ? (
              msg.seenBy && msg.seenBy.length > 0 ? (
                <span
                  className="msg-group-seen"
                  title={`Vu par ${msg.seenBy.length} personne${msg.seenBy.length > 1 ? 's' : ''}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="Vu">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  <span className="msg-group-seen-count">{msg.seenBy.length}</span>
                </span>
              ) : null
            ) : (
              <span className={`msg-status${msg.seen ? ' seen' : ''}`}>
                <svg className="check1" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                {!!msg.seen && (
                  <svg className="check2" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </span>
            ))}
        </div>
        {msg.reactions && (
          <div className="msg-reactions" data-mid={mid}>
            {Object.entries(groupReactions(msg.reactions)).map(([emoji, uids]) => (
              <div
                key={emoji}
                className={`reaction-chip${uids.includes(user?.uid || '') ? ' mine' : ''}`}
                data-emoji={emoji}
                data-mid={mid}
                onClick={() => toggleReaction(mid, emoji, convId, !!currentGroupId)}
              >
                {emoji} {uids.length}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
