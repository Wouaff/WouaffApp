import CallButton from '../Call/CallButton';

interface ChatTopbarProps {
  chatWithPseudo: string;
  currentGroupId: string | null;
  chatWith: string | null;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onOpenGroupInfo?: () => void;
  onOpenUserProfile?: (uid: string) => void;
  onDeleteConv?: () => void;
}

export default function ChatTopbar({
  chatWithPseudo,
  currentGroupId,
  chatWith,
  searchOpen: _searchOpen,
  onToggleSearch,
  onOpenGroupInfo,
  onOpenUserProfile,
  onDeleteConv,
}: ChatTopbarProps) {
  return (
    <div className="chat-topbar">
      <span className="topbar-name">{chatWithPseudo || 'Groupe'}</span>
      <div className="topbar-actions">
        {currentGroupId && onOpenGroupInfo && (
          <button
            type="button"
            className="topbar-btn"
            onClick={onOpenGroupInfo}
            title="Infos du groupe"
            aria-label="Informations du groupe"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-label="Infos du groupe">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </button>
        )}
        {chatWith && <CallButton targetUid={chatWith} pseudo={chatWithPseudo} />}
        <button
          type="button"
          className="topbar-btn"
          onClick={onToggleSearch}
          title="Rechercher"
          aria-label="Rechercher"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-label="Rechercher">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </button>
        {chatWith && onOpenUserProfile && (
          <button
            type="button"
            className="topbar-btn"
            onClick={() => onOpenUserProfile(chatWith)}
            title="Profil"
            aria-label="Voir le profil"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-label="Profil">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>
        )}
        {onDeleteConv && (
          <button
            type="button"
            className="topbar-btn"
            onClick={onDeleteConv}
            title="Supprimer la conversation"
            aria-label="Supprimer la conversation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-label="Supprimer la conversation">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
