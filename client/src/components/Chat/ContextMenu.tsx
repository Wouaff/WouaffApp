import { memo } from 'react';
import type { MessageData } from '../../types';
import { EMOJIS, toggleReaction } from '../../utils/chatHelpers';

interface ContextMenuProps {
  x: number;
  y: number;
  mid: string;
  msg: MessageData;
  convId: string;
  isGroup: boolean;
  isOwn: boolean;
  onReply: () => void;
  onEdit: () => void;
  onForward: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const ContextMenu = memo(function ContextMenu({
  x,
  y,
  mid,
  msg,
  convId,
  isGroup,
  isOwn,
  onReply,
  onEdit,
  onForward,
  onTogglePin,
  onDelete,
  onClose,
}: ContextMenuProps) {
  return (
    <div className="ctx-menu" style={{ position: 'fixed', left: x, top: y, zIndex: 9999 } as React.CSSProperties}>
      <fieldset className="ctx-reactions" aria-label="Réactions">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            className="ctx-emoji"
            aria-label={`Réaction ${e}`}
            onClick={() => {
              toggleReaction(mid, e, convId, isGroup);
              onClose();
            }}
          >
            {e}
          </button>
        ))}
      </fieldset>
      <div className="ctx-divider" />
      {!msg.deleted && (
        <button
          type="button"
          className="ctx-item"
          onClick={() => {
            onReply();
            onClose();
          }}
        >
          ↩️ Répondre
        </button>
      )}
      {isOwn && !msg.deleted && (
        <>
          <button
            type="button"
            className="ctx-item"
            onClick={() => {
              onEdit();
              onClose();
            }}
          >
            ✏️ Modifier
          </button>
          <button
            type="button"
            className="ctx-item"
            onClick={() => {
              onForward();
              onClose();
            }}
          >
            📤 Transférer
          </button>
          <button
            type="button"
            className="ctx-item"
            onClick={() => {
              onTogglePin();
              onClose();
            }}
          >
            📌 {msg.pinned ? 'Désépingler' : 'Épingler'}
          </button>
          <button
            type="button"
            className="ctx-item danger"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            🗑️ Supprimer
          </button>
        </>
      )}
    </div>
  );
});

export default ContextMenu;
