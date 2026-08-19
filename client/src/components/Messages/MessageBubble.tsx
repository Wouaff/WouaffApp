import { Download, File, Phone } from 'lucide-react';
import { memo } from 'react';
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
  if (msg.deleted) {
    return (
      <div className={`message-bubble message-bubble-deleted ${isMine ? 'mine' : ''}`}>
        <span className="italic text-[var(--text-muted)] text-[13px]">Message supprimé</span>
      </div>
    );
  }

  const reactions = msg.reactions ? groupReactions(msg.reactions) : {};

  return (
    <div className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
      <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
        {showSender && !isMine && <div className="message-sender">{senderName || 'Utilisateur'}</div>}

        {msg.replyTo && <div className="message-reply-target">Réponse à un message</div>}

        {msg.imageData && (
          <img
            src={msg.imageData}
            alt=""
            className="message-image"
            onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
          />
        )}

        {msg.audioData && (
          <div className="message-audio">
            <VoiceMessage audioData={msg.audioData} duration={msg.duration} />
          </div>
        )}

        {msg.fileData && (
          <a
            href={msg.fileData}
            className="message-file"
            onClick={(e) => {
              e.preventDefault();
              downloadFile(msg);
            }}
          >
            <span className="message-file-icon">
              <File size={18} />
            </span>
            <span className="message-file-name">{msg.fileName || 'Fichier'}</span>
            <Download size={15} />
          </a>
        )}

        {msg.contact && (
          <div className="message-contact">
            <span className="message-contact-icon">
              <Phone size={15} />
            </span>
            <div>
              <div className="message-contact-name">{msg.contact.name || 'Contact'}</div>
              {msg.contact.phone && <div className="message-contact-phone">{msg.contact.phone}</div>}
            </div>
          </div>
        )}

        {msg.text && <div className="message-text">{renderLinkifiedText(msg.text)}</div>}

        {Object.keys(reactions).length > 0 && (
          <div className="message-reactions">
            {Object.entries(reactions).map(([emoji, uids]) => (
              <span key={emoji} className="message-reaction">
                {emoji}
                {uids.length > 1 && <b>{uids.length}</b>}
              </span>
            ))}
          </div>
        )}

        <div className="message-meta">
          {msg.edited && <span className="message-edited">modifié</span>}
          <span>{formatTime(msg.time)}</span>
        </div>
      </div>
    </div>
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
