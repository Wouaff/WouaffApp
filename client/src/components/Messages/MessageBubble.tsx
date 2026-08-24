import { Download, File, Phone, X } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { messages as messagesApi } from '../../services/api';
import type { MessageData } from '../../types';
import { downloadFile, formatTime, groupReactions, renderLinkifiedText } from '../../utils/chatHelpers';
import VoiceMessage from '../Common/VoiceMessage';

interface MessageBubbleProps {
  msg: MessageData;
  isMine: boolean;
  showSender?: boolean;
  senderName?: string;
  convId?: string;
  isGroup?: boolean;
}

function needsBlob(msg: MessageData): boolean {
  return !!(msg.type === 'image' || msg.type === 'file' || msg.type === 'audio' || msg.type === 'contact');
}

export const MessageBubble = memo(function MessageBubble({
  msg,
  isMine,
  showSender,
  senderName,
  convId,
  isGroup,
}: MessageBubbleProps) {
  const reactions = msg.reactions ? groupReactions(msg.reactions) : {};
  const [viewer, setViewer] = useState(false);
  const [blob, setBlob] = useState<{
    imageData?: string;
    fileData?: string;
    fileName?: string;
    audioData?: string;
    contact?: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    if (!needsBlob(msg) || blob) return;
    if (!convId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = isGroup
          ? await messagesApi.blobGroup(convId, msg.msgKey as string)
          : await messagesApi.blob(convId, msg.msgKey as string);
        if (cancelled) return;
        const d = data as {
          imageData?: string;
          fileData?: string;
          fileName?: string;
          audioData?: string;
          contactData?: string;
        };
        setBlob({
          imageData: d.imageData || undefined,
          fileData: d.fileData || undefined,
          fileName: d.fileName || undefined,
          audioData: d.audioData || undefined,
          contact: d.contactData ? JSON.parse(d.contactData) : undefined,
        });
      } catch {
        /* blob indisponible */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [msg, convId, isGroup, blob]);

  const imageData = msg.imageData || blob?.imageData;
  const audioData = msg.audioData || blob?.audioData;
  const fileData = msg.fileData || blob?.fileData;
  const fileName = msg.fileName || blob?.fileName;
  const contact = msg.contact || blob?.contact;

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

        {imageData && (
          <img
            src={imageData}
            alt="Visuel envoyé dans le message"
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

        {audioData && (
          <div className="msg-voice">
            <VoiceMessage audioData={audioData} duration={msg.duration} />
          </div>
        )}

        {fileData && (
          <div className="msg-file">
            <a
              href={fileData}
              className="file-link"
              onClick={(e) => {
                e.preventDefault();
                downloadFile({ ...msg, fileData, fileName });
              }}
            >
              <File size={18} />
              <span className="file-name">{fileName || 'Fichier'}</span>
              <Download size={15} />
            </a>
          </div>
        )}

        {contact && (
          <div className="msg-contact">
            <Phone size={15} />
            <div className="contact-details">
              <span className="contact-name">{contact.name || 'Contact'}</span>
              {contact.phone && <span className="contact-tel">{contact.phone}</span>}
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

      {viewer && imageData && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setViewer(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image en plein écran"
        >
          <img
            src={imageData}
            alt="Visuel envoyé dans le message"
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
  if (msg.type === 'image') return '📷 Photo';
  if (msg.type === 'audio') return '🎵 Message vocal';
  if (msg.type === 'file') return `📎 ${msg.fileName || 'Fichier'}`;
  if (msg.type === 'contact') return `📇 Contact`;
  if (msg.text) return msg.text.replace(/\n/g, ' ');
  return '';
}
