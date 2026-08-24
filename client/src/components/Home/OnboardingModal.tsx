import { Check, Sparkles, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { OnboardingCommunity, OnboardingUser } from '../../services/api';
import { onboarding } from '../../services/api';
import { showToast } from '../Common/Toast';

interface OnboardingModalProps {
  onDone: () => void;
  onSkip?: () => void;
}

const MIN_SELECTION = 8;
const MAX_SELECTION = 10;

export default function OnboardingModal({ onDone, onSkip }: OnboardingModalProps) {
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [communities, setCommunities] = useState<OnboardingCommunity[]>([]);
  const [minimum, setMinimum] = useState(MIN_SELECTION);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedCommunities, setSelectedCommunities] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onboarding
      .suggestions()
      .then((data) => {
        setUsers(data.users);
        setCommunities(data.communities);
        setMinimum(Math.max(1, data.minimum));
      })
      .catch(() => showToast('Impossible de charger les suggestions', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const count = selectedUsers.size + selectedCommunities.size;
  const canSubmit = count >= minimum && count <= MAX_SELECTION;

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCommunity = (id: string) => {
    setSelectedCommunities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (count < minimum) {
      showToast(`Choisis au minimum ${minimum} comptes pour ton fil`, 'error');
      return;
    }
    if (count > MAX_SELECTION) {
      showToast(`Maximum ${MAX_SELECTION} comptes pour l'onboarding`, 'error');
      return;
    }
    setSaving(true);
    try {
      const followUids = users.filter((u) => selectedUsers.has(u.uid)).map((u) => u.uid);
      const communityNames = communities.filter((c) => selectedCommunities.has(c.id)).map((c) => c.name);
      await onboarding.complete(followUids, communityNames);
      showToast('Bienvenue ! Ton fil est prêt', 'success');
      onDone();
    } catch (err) {
      showToast((err as Error).message || "Erreur lors de l'abonnement", 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderUser = (u: OnboardingUser) => {
    const isSelected = selectedUsers.has(u.uid);
    const initial = (u.pseudo || '?')[0]?.toUpperCase() || '?';
    const handle = u.wouaffId
      ? u.wouaffId.startsWith('@')
        ? u.wouaffId
        : `@${u.wouaffId}`
      : `@${u.pseudo || 'inconnu'}`;
    return (
      <button
        key={u.uid}
        type="button"
        onClick={() => toggleUser(u.uid)}
        aria-pressed={isSelected}
        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left cursor-pointer transition-colors ${
          isSelected
            ? 'border-brand bg-[var(--brand-glow)]'
            : 'border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]'
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
          {u.avatar ? (
            <img
              src={u.avatar}
              alt={`Avatar de ${u.pseudo || "l'utilisateur"}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1 text-[13px] font-bold text-[var(--text-primary)] truncate">
            {u.pseudo}
            {u.isStaff && (
              <span className="text-[10px] font-extrabold text-brand rounded-full border border-brand/40 px-1.5 py-px flex-shrink-0">
                Wouaff
              </span>
            )}
          </span>
          <span className="block text-[11px] text-[var(--text-muted)] truncate">{u.bio || handle}</span>
        </span>
        isSelected && (
        <span className="w-5 h-5 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
          <Check size={12} className="text-white" />
        </span>
        );
      </button>
    );
  };

  const renderCommunity = (c: OnboardingCommunity) => {
    const isSelected = selectedCommunities.has(c.id);
    const initial = (c.displayName || c.name)[0]?.toUpperCase() || 'r';
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => toggleCommunity(c.id)}
        aria-pressed={isSelected}
        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left cursor-pointer transition-colors ${
          isSelected
            ? 'border-brand bg-[var(--brand-glow)]'
            : 'border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]'
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
          {c.avatar ? (
            <img src={c.avatar} alt={`Avatar de ${c.displayName || c.name}`} className="w-full h-full object-cover" />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-bold text-[var(--text-primary)] truncate">c/{c.name}</span>
          <span className="block text-[11px] text-[var(--text-muted)] truncate">{c.memberCount} membres</span>
        </span>
        {isSelected && (
          <span className="w-5 h-5 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
            <Check size={12} className="text-white" />
          </span>
        )}
      </button>
    );
  };

  const shown = useMemo(() => count >= minimum, [count, minimum]);

  return (
    <div className="modal-overlay active">
      <div className="flex flex-col w-full max-w-[720px] max-h-[92dvh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div
            className="w-10 h-10 rounded-xl bg-[var(--brand-glow)] flex items-center justify-center text-xl text-brand"
            aria-hidden="true"
          >
            <Sparkles size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="m-0 text-[19px] font-extrabold text-[var(--text-primary)]">Bienvenue sur Wouaff !</h2>
            <p className="m-0 mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Suis des comptes et rejoins des communautés pour remplir ton fil ({minimum} à {MAX_SELECTION} choix).
            </p>
          </div>
          <span
            className={`text-[13px] font-extrabold rounded-full px-3 py-1 ${
              shown ? 'bg-online/10 text-online' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
            }`}
          >
            {count}/{minimum}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {loading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="spinner" />
              <p className="m-0 text-sm text-[var(--text-muted)]">Chargement des suggestions...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {users.length > 0 && (
                <section>
                  <h3 className="m-0 mb-2 text-[14px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wide flex items-center gap-1.5">
                    <UserPlus size={15} /> Comptes à suivre
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{users.map(renderUser)}</div>
                </section>
              )}

              {communities.length > 0 && (
                <section>
                  <h3 className="m-0 mb-2 text-[14px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wide">
                    Communautés à rejoindre
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{communities.map(renderCommunity)}</div>
                </section>
              )}

              {!loading && users.length === 0 && communities.length === 0 && (
                <p className="m-0 py-8 text-center text-[var(--text-secondary)]">
                  Aucune suggestion pour le moment. Ton fil se remplira au fil de tes abonnements !
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[var(--border)] flex-shrink-0">
          <p className="m-0 text-[12px] text-[var(--text-muted)]">
            Tu pourras t'abonner / te désabonner à tout moment. Aucun algorithme opaque : ton fil est l'ordre
            chronologique de ce que tu suis.
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={saving || loading || !canSubmit}
            className="flex-shrink-0 bg-brand hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
          >
            {saving ? 'Abonnement...' : !canSubmit ? `Encore ${minimum - count} choix` : 'Commencer'}
          </button>
        </div>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="flex items-center gap-1.5 self-end mr-6 mb-4 text-[12px] font-bold text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-3 py-1 hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={13} /> Plus tard
          </button>
        )}
      </div>
    </div>
  );
}
