import { memo } from 'react';
import { EMOJI_CATEGORIES } from '../../utils/chatHelpers';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const EmojiPicker = memo(function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  return (
    <div className="emoji-picker">
      <div className="emoji-picker-content">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.name} className="emoji-category">
            <div className="emoji-category-name">{cat.name}</div>
            <div className="emoji-grid">
              {cat.items.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="emoji-item"
                  aria-label={emoji}
                  onClick={() => onEmojiSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default EmojiPicker;
