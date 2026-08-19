import { Plus, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageData } from '../../types';
import { formatTime } from '../../utils/chatHelpers';
import { messagePreview } from './MessageBubble';

export interface ConvListItem {
  id: string;
  type: 'dm' | 'group';
  name: string;
  avatar?: string;
  lastMsg: MessageData | null;
  lastTime: number;
  online?: boolean;
  memberCount?: number;
}

interface ConversationListProps {
  dms: ConvListItem[];
  groups: ConvListItem[];
  activeId: string | null;
  typingMap: Record<string, string | null>;
  onSelect: (id: string, type: 'dm' | 'group') => void;
  onStartConversation: (uid: string) => void;
  onOpenGroup: (gid: string) => void;
}

function AvatarRow({ item }: { item: ConvListItem }) {
  const initial = (item.name[0] || '?').toUpperCase();
  return (
    <div className={`conv-avatar${item.type === 'group' ? ' group-avatar' : ''}`}>
      {item.avatar ? (
        <img src={item.avatar} alt="" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
      ) : item.type === 'group' ? (
        <Users size={20} />
      ) : (
        <span>{initial}</span>
      )}
      {item.type === 'dm' && item.online && <span className="status-dot online" />}
      {item.type === 'dm' && !item.online && <span className="status-dot offline" />}
    </div>
  );
}

function timeLabel(ts: number): string {
  if (!ts) return '';
  const now = new Date();
  const d = new Date(ts);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return formatTime(ts);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function NewConversationModal({ onClose, onStart }: { onClose: () => void; onStart: (uid: string) => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = useCallback(async () => {
    const query = q.trim();
    if (!query || busy) return;
    setBusy(true);
    setErr('');
    try {
      let uid: string;
      if (query.startsWith('@')) {
        const res = await fetch(`/api/search/users/${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Utilisateur introuvable');
        const data = (await res.json()) as { uid: string };
        uid = data.uid;
      } else {
        const res = await fetch(`/api/profiles/${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Utilisateur introuvable');
        const prof = (await res.json()) as { pseudo?: string };
        if (!prof?.pseudo) throw new Error('Utilisateur introuvable');
        uid = query;
      }
      onStart(uid);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
    setBusy(false);
  }, [q, busy, onStart, onClose]);

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[19px] font-extrabold text-[var(--text-primary)] m-0">Nouvelle conversation</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full flex items-center justify-center border-none bg-transparent text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Plus size={18} className="rotate-45" />
          </button>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)] m-0 mb-3">
          Entrez un @WouaffID ou un identifiant d'utilisateur pour démarrer un message privé.
        </p>
        <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-transparent focus-within:border-[var(--brand)] rounded-full py-2.5 pl-4 pr-3 transition-colors">
          <Search size={17} className="text-[var(--text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setErr('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="@pseudo ou UID…"
            disabled={busy}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-sans"
          />
        </div>
        {err && <div className="text-[12px] text-[var(--danger)] mt-2">{err}</div>}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-bold text-[var(--text-secondary)] bg-[var(--bg-input)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors border-none"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!q.trim() || busy}
            className="px-5 py-2 rounded-full text-sm font-bold text-white bg-brand cursor-pointer hover:opacity-90 transition-opacity border-none disabled:opacity-40"
          >
            {busy ? '…' : 'Démarrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConversationList({
  dms,
  groups,
  activeId,
  typingMap,
  onSelect,
  onStartConversation,
  onOpenGroup,
}: ConversationListProps) {
  const [newOpen, setNewOpen] = useState(false);

  const renderItem = (item: ConvListItem) => {
    const typing = typingMap[item.id];
    return (
      <div
        key={`${item.type}-${item.id}`}
        className={`conv-item${activeId === item.id ? ' active' : ''}`}
        onClick={() =>
          item.type === 'group' && item.id === activeId ? onOpenGroup(item.id) : onSelect(item.id, item.type)
        }
      >
        <AvatarRow item={item} />
        <div className="conv-info">
          <div className="conv-row">
            <span className="conv-name">{item.name}</span>
            {item.lastTime > 0 && <span className="conv-time">{timeLabel(item.lastTime)}</span>}
          </div>
          <div className="conv-preview">
            {typing ? (
              <span className="typing-dots">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            ) : (
              messagePreview(item.lastMsg)
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="h-14 flex items-center px-4 border-b border-[var(--border)] bg-[var(--bg-base)] flex-shrink-0">
        <h2 className="text-xl font-extrabold m-0 text-[var(--text-primary)] flex-1">Messages</h2>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation"
          className="input-action-btn"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="conversations-list">
        {dms.length === 0 && groups.length === 0 && (
          <div className="chat-placeholder">
            <div className="chat-placeholder-content">
              <span style={{ fontSize: 40 }}>💬</span>
              <p className="m-0" style={{ fontWeight: 600 }}>
                Aucune conversation
              </p>
              <p className="m-0" style={{ fontSize: 13 }}>
                Cliquez sur + pour envoyer votre premier message privé.
              </p>
            </div>
          </div>
        )}

        {dms.length > 0 && (
          <>
            <div className="conv-section-label">Messages</div>
            {dms.map(renderItem)}
          </>
        )}

        {groups.length > 0 && (
          <>
            <div className="conv-section-label">
              <Users size={12} /> Groupes
            </div>
            {groups.map(renderItem)}
          </>
        )}
      </div>

      {newOpen && <NewConversationModal onClose={() => setNewOpen(false)} onStart={onStartConversation} />}
    </>
  );
}
