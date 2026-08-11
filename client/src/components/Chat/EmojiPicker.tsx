import { Hand, Heart, Leaf, Lightbulb, PawPrint, Pizza, Smile } from 'lucide-react';
import { memo, useRef, useState } from 'react';
import { EMOJI_CATEGORIES } from '../../utils/chatHelpers';

const CATEGORY_ICONS = {
  Sourires: Smile,
  Gestes: Hand,
  'Cœurs': Heart,
  Objets: Lightbulb,
  Nourriture: Pizza,
  Animaux: PawPrint,
  Nature: Leaf,
};

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const EmojiPicker = memo(function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].name);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const selectCategory = (name: string) => {
    setActiveCategory(name);
    categoryRefs.current[name]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateCategory = (container: HTMLDivElement) => {
    const top = container.getBoundingClientRect().top + 20;
    let current = EMOJI_CATEGORIES[0].name;
    for (const item of EMOJI_CATEGORIES) {
      const section = categoryRefs.current[item.name];
      if (section && section.getBoundingClientRect().top <= top) current = item.name;
    }
    setActiveCategory(current);
  };

  return (
    <div className="emoji-picker">
      <div className="emoji-picker-categories">
        {EMOJI_CATEGORIES.map((item) => {
          const Icon = CATEGORY_ICONS[item.name as keyof typeof CATEGORY_ICONS];
          return (
            <button
              key={item.name}
              type="button"
              className={`emoji-category-button${item.name === activeCategory ? ' active' : ''}`}
              aria-label={item.name}
              title={item.name}
              onClick={() => selectCategory(item.name)}
            >
              <Icon size={18} strokeWidth={2} />
            </button>
          );
        })}
      </div>
      <div className="emoji-picker-content" onScroll={(event) => updateCategory(event.currentTarget)}>
        {EMOJI_CATEGORIES.map((item) => (
          <div
            key={item.name}
            ref={(element) => {
              categoryRefs.current[item.name] = element;
            }}
            className="emoji-category"
          >
            <div className="emoji-category-name">{item.name}</div>
            <div className="emoji-grid">
              {item.items.map((emoji) => (
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
