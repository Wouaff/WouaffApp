import { Download, File, Phone, X } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import type { MessageData } from '../../types';
import { downloadFile, formatTime, groupReactions, renderLinkifiedText } from '../../utils/chatHelpers';
import VoiceMessage from '../Common/VoiceMessage';

interface MessageBubbleProps {
  msg: MessageData;
  isMine: boolean;
  showSender?: boolean;
  senderName?: string;
}

export const MessageBubble = memo(function MessageBubble({ msg, isMine, showSender, senderName }: MessageBubbleProps) {
  const reactions = msg.reactions ? groupReactions(msg.reactions) : {};
  const [viewer, setViewer] = useState(false);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [viewer]);

  return (
    <>
      <div className={`msg-bubble ${isMine ? 'mine' : ''}`}>
        {showSender && !isMine && <div className="msg-sender-name">{senderName || 'Utilisateur'}</div>}

        {msg.replyTo && (
          <div className="reply-quote">
            <div className="reply-quote-name">Réponse</div>
            <div className="reply-quote-text">{msg.replyTo}</div>
          </div>
        )}

        {msg.imageData && (
          <img
            src={msg.imageData}
            alt=""
            className="msg-image"
            style={{
              display: 'block',
              marginTop: 4,
              maxWidth: '100%',
              maxHeight: 'min(340px, 40vh)',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 12,
              cursor: 'zoom-in',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setViewer(true);
            }}
            onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
          />
        )}

        {msg.audioData && (
          <div className="msg-voice">
            <VoiceMessage audioData={msg.audioData} duration={msg.duration} />
          </div>
        )}

        {msg.fileData && (
          <div className="msg-file">
            <a
              href={msg.fileData}
              className="file-link"
              onClick={(e) => {
                e.preventDefault();
                downloadFile(msg);
              }}
            >
              <File size={18} />
              <span className="file-name">{msg.fileName || 'Fichier'}</span>
              <Download size={15} />
            </a>
          </div>
        )}

        {msg.contact && (
          <div className="msg-contact">
            <Phone size={15} />
            <div className="contact-details">
              <span className="contact-name">{msg.contact.name || 'Contact'}</span>
              {msg.contact.phone && <span className="contact-tel">{msg.contact.phone}</span>}
            </div>
          </div>
        )}

        {msg.deleted ? (
          <div className="msg-text deleted">Message supprimé</div>
        ) : (
          msg.text && <div className="msg-text">{renderLinkifiedText(msg.text)}</div>
        )}

        {Object.keys(reactions).length > 0 && (
          <div className="msg-reactions">
            {Object.entries(reactions).map(([emoji, uids]) => (
              <span key={emoji} className={`reaction-chip${isMine ? ' mine' : ''}`}>
                {emoji}
                {uids.length > 1 && <b>{uids.length}</b>}
              </span>
            ))}
          </div>
        )}

        <div className="msg-footer">
          {!!msg.edited && <span className="msg-edited">modifié</span>}
          <span className="msg-time">{formatTime(msg.time)}</span>
        </div>
      </div>

      {viewer && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setViewer(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image en plein écran"
        >
          <img
            src={msg.imageData}
            alt=""
            className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setViewer(false)}
            aria-label="Fermer"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer border-none hover:bg-black/80 transition-colors"
          >
            <X size={22} />
          </button>
        </div>
      )}
    </>
  );
});

export function messagePreview(msg: MessageData | null): string {
  if (!msg) return '';
  if (msg.deleted) return 'Message supprimé';
  if (msg.imageData) return '📷 Photo';
  if (msg.audioData) return '🎵 Message vocal';
  if (msg.fileData) return `📎 ${msg.fileName || 'Fichier'}`;
  if (msg.contact) return `📇 ${msg.contact.name || 'Contact'}`;
  if (msg.text) return msg.text.replace(/\n/g, ' ');
  return '';
}
