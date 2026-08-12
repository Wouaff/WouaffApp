import { Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { communities as communitiesAPI } from '../../services/api';
import type { Community } from '../../types';
import { showToast } from '../Common/Toast';

interface OnboardingModalProps {
  onDone: () => void;
}

const MIN_SELECTION = 3;

export default function OnboardingModal({ onDone }: OnboardingModalProps) {
  const [groups, setGroups] = useState<Array<{ category: string; items: Community[] }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    communitiesAPI
      .discover()
      .then((data) => {
        setGroups(data.groups);
        setSelected(new Set());
      })
      .catch(() => showToast('Impossible de charger les communautés', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const popular = useMemo(() => {
    const flat: Community[] = [];
    for (const group of groups) flat.push(...group.items);
    return flat.slice(0, 24);
  }, [groups]);

  const count = selected.size;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (count < MIN_SELECTION) {
      showToast(`Choisis au minimum ${MIN_SELECTION} communautés`, 'error');
      return;
    }
    setSaving(true);
    try {
      const flat: Community[] = [];
      for (const group of groups) flat.push(...group.items);
      const names = flat.filter((c) => selected.has(c.id)).map((c) => c.name);
      await communitiesAPI.onboard(names);
      showToast('Bienvenue ! Ton fil est prêt 🎉', 'success');
      onDone();
    } catch (err) {
      showToast((err as Error).message || "Erreur lors de l'abonnement", 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay active">
      <div className="flex flex-col w-full max-w-[720px] max-h-[92dvh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div
            className="w-10 h-10 rounded-xl bg-[var(--brand-glow)] flex items-center justify-center text-xl"
            aria-hidden="true"
          >
            🐺
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="m-0 text-[19px] font-extrabold text-[var(--text-primary)]">Bienvenue sur Wouaff !</h2>
            <p className="m-0 mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Choisis au moins {MIN_SELECTION} communautés pour personnaliser ton fil d'actualité.
            </p>
          </div>
          <span
            className={`text-[13px] font-extrabold rounded-full px-3 py-1 ${
              count >= MIN_SELECTION ? 'bg-online/10 text-online' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
            }`}
          >
            {count}/{MIN_SELECTION}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {loading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="spinner" />
              <p className="m-0 text-sm text-[var(--text-muted)]">Chargement des communautés...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {popular.length > 0 && (
                <section>
                  <h3 className="m-0 mb-2 text-[14px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wide">
                    Les plus populaires
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {popular.map((c) => {
                      const isSelected = selected.has(c.id);
                      const initial = (c.displayName || c.name)[0]?.toUpperCase() || 'r';
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(c.id)}
                          aria-pressed={isSelected}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-brand bg-[var(--brand-glow)]'
                              : 'border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
                            {c.avatar ? (
                              <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>
                          <span className="flex-1 min-w-0 text-[13px] font-bold text-[var(--text-primary)] truncate">
                            c/{c.name}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                              <Check size={12} className="text-white" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {groups.map((group) => (
                <section key={group.category}>
                  <h3 className="m-0 mb-2 text-[14px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wide">
                    {group.category}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {group.items.map((c) => {
                      const isSelected = selected.has(c.id);
                      const initial = (c.displayName || c.name)[0]?.toUpperCase() || 'r';
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(c.id)}
                          aria-pressed={isSelected}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-brand bg-[var(--brand-glow)]'
                              : 'border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
                            {c.avatar ? (
                              <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>
                          <span className="flex-1 min-w-0 text-[13px] font-bold text-[var(--text-primary)] truncate">
                            c/{c.name}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                              <Check size={12} className="text-white" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              {!loading && groups.length === 0 && popular.length === 0 && (
                <p className="m-0 py-8 text-center text-[var(--text-secondary)]">
                  Aucune communauté pour le moment. Crée la première !
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[var(--border)] flex-shrink-0">
          <p className="m-0 text-[12px] text-[var(--text-muted)]">
            Tu pourras t'abonner / te désabonner à tout moment. Aucun algorithme opaque : ton fil est l'ordre
            chronologique de tes communautés.
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={saving || loading}
            className="flex-shrink-0 bg-brand hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
          >
            {saving ? 'Abonnement...' : count < MIN_SELECTION ? `Encore ${MIN_SELECTION - count} choix` : 'Commencer'}
          </button>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="flex items-center gap-1.5 self-end mr-6 mb-4 text-[12px] font-bold text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-3 py-1 hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={13} /> Plus tard
        </button>
      </div>
    </div>
  );
}
