import { memo } from 'react';

interface ReplyPreviewProps {
  replyTo: string | null;
  replyText: string;
  editingMsgId: string | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
}

const ReplyPreview = memo(function ReplyPreview({
  replyTo,
  replyText,
  editingMsgId,
  onCancelReply,
  onCancelEdit,
}: ReplyPreviewProps) {
  return (
    <>
      {replyTo && (
        <div className="reply-preview" id="replyPreview">
          <div className="reply-preview-content">
            <div className="reply-preview-name">Répondre</div>
            <div className="reply-preview-text">{replyText?.substring(0, 60)}</div>
          </div>
          <button type="button" className="reply-preview-close" onClick={onCancelReply} aria-label="Annuler la réponse">
            ✕
          </button>
        </div>
      )}
      {editingMsgId && (
        <div className="edit-preview" id="editPreview">
          <span>Modification du message</span>
          <button type="button" className="reply-preview-close" onClick={onCancelEdit} aria-label="Annuler la réponse">
            ✕
          </button>
        </div>
      )}
    </>
  );
});

export default ReplyPreview;
