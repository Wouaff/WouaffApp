import { BookUser, Check, Phone, Send, UserPlus, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { type ContactMatch, contacts, profiles } from '../../services/api';
import { showToast } from '../Common/Toast';

interface ContactsModalProps {
  onDone: () => void;
  onClose: () => void;
}

interface ContactsEntry {
  name?: string[];
  tel?: string[];
}

interface ContactsManager {
  select: (properties: string[], options?: { multiple?: boolean }) => Promise<ContactsEntry[]>;
}

const contactsManager = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
const canReadContacts = typeof contactsManager !== 'undefined' && typeof contactsManager.select === 'function';

export default function ContactsModal({ onDone, onClose }: ContactsModalProps) {
  const [ownPhone, setOwnPhone] = useState('');
  const [manualNumbers, setManualNumbers] = useState('');
  const [step, setStep] = useState<'intro' | 'result'>('intro');
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  const inviteLink = useMemo(() => `${window.location.origin}`, []);

  const collectContacts = useCallback(async (): Promise<string[]> => {
    const manual = manualNumbers
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!canReadContacts) return manual;
    try {
      const entries = await contactsManager!.select(['tel', 'name'], { multiple: true });
      const numbers = new Set<string>();
      for (const e of entries) {
        for (const t of e.tel || []) numbers.add(t);
      }
      return [...numbers, ...manual];
    } catch {
      return manual;
    }
  }, [manualNumbers]);

  const sync = useCallback(
    async (readContacts?: boolean) => {
      setLoading(true);
      try {
        let list: string[];
        if (readContacts && canReadContacts) {
          list = await collectContacts();
        } else {
          list = manualNumbers
            .split(/[\n,;]+/)
            .map((n) => n.trim())
            .filter(Boolean);
        }
        const res = await contacts.sync(ownPhone.trim() || undefined, list);
        setMatches(res.matches);
        setMissing(res.missing);
        setStep('result');
      } catch (err) {
        showToast((err as Error).message || 'Impossible de synchroniser les contacts', 'error');
      } finally {
        setLoading(false);
      }
    },
    [collectContacts, manualNumbers, ownPhone],
  );

  const toggleFollow = async (m: ContactMatch) => {
    const isFollowing = !!following[m.uid];
    setFollowing((prev) => ({ ...prev, [m.uid]: !isFollowing }));
    try {
      if (isFollowing) {
        await profiles.unfollow(m.uid);
      } else {
        await profiles.follow(m.uid);
      }
    } catch (err) {
      setFollowing((prev) => ({ ...prev, [m.uid]: isFollowing }));
      showToast((err as Error).message || 'Erreur', 'error');
    }
  };

  const invite = async (number: string) => {
    const text = `Rejoins-moi sur Wouaff ! ${inviteLink}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* partage annulé → on tente le SMS */
      }
    }
    try {
      const a = document.createElement('a');
      a.href = `sms:${encodeURIComponent(number)}?body=${encodeURIComponent(text)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Invitation envoyée par SMS', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(`${text}, ${number}`);
        showToast('Invitation copiée', 'success');
      } catch {
        showToast('Impossible d’inviter ce contact', 'error');
      }
    }
  };

  const handle = (m: ContactMatch): string => {
    if (m.wouaffId) return m.wouaffId.startsWith('@') ? m.wouaffId : `@${m.wouaffId}`;
    return `@${m.pseudo || 'inconnu'}`;
  };

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="w-full max-w-[520px] max-h-[92dvh] overflow-hidden flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
        <div className="flex items-center gap-4 px-5 h-14 border-b border-[var(--border)] flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-[var(--brand-glow)] flex items-center justify-center flex-shrink-0">
            <BookUser size={18} className="text-brand" />
          </div>
          <span className="font-bold text-[var(--text-primary)] text-[17px] m-0">Retrouve tes amis</span>
          {!loading && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="ml-auto w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-primary)] border-none bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {step === 'intro' ? (
          <div className="px-5 py-4 overflow-y-auto min-h-0">
            <p className="m-0 text-[14px] leading-relaxed text-[var(--text-secondary)]">
              Ton répertoire contient peut-être déjà des potes sur Wouaff. Autorise l'accès à tes contacts pour les
              retrouver facilement par numéro de téléphone. Ton numéro sera enregistré pour que <b>tes amis</b> puissent
              te retrouver aussi. Rien n'est partagé avec des tiers.
            </p>

            <label
              htmlFor="contact-own-phone"
              className="block mt-4 text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]"
            >
              Ton numéro de téléphone (optionnel, pour être retrouvable)
            </label>
            <input
              id="contact-own-phone"
              type="tel"
              value={ownPhone}
              onChange={(e) => setOwnPhone(e.target.value)}
              placeholder="+33 6 12 34 56 78"
              autoComplete="tel"
              className="mt-1.5 w-full bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--brand)] outline-none rounded-xl px-4 py-2.5 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors"
            />

            {canReadContacts && (
              <button
                type="button"
                onClick={() => sync(true)}
                disabled={loading}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-brand hover:opacity-90 disabled:opacity-50 transition-opacity text-white font-bold text-sm rounded-full px-4 py-3 border-none cursor-pointer"
              >
                {loading ? <span className="spinner spinner-sm" /> : <Phone size={16} />}
                {loading ? 'Recherche de tes amis…' : 'Autoriser l’accès à mes contacts'}
              </button>
            )}

            {!canReadContacts && (
              <>
                <label
                  htmlFor="contact-manual-numbers"
                  className="block mt-4 text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]"
                >
                  Ou colle les numéros de tes amis (un par ligne)
                </label>
                <textarea
                  id="contact-manual-numbers"
                  value={manualNumbers}
                  onChange={(e) => setManualNumbers(e.target.value)}
                  placeholder={'06 12 34 56 78\n+33 7 98 76 54 32'}
                  rows={4}
                  className="mt-1.5 w-full bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--brand)] outline-none rounded-xl px-4 py-2.5 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none transition-colors"
                />
              </>
            )}

            <button
              type="button"
              onClick={() => sync(false)}
              disabled={loading || (!canReadContacts && !manualNumbers.trim() && !ownPhone.trim())}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[var(--text-primary)] font-bold text-sm rounded-full px-4 py-3 border border-[var(--border)] cursor-pointer"
            >
              {loading ? <span className="spinner spinner-sm" /> : <Send size={16} />}
              {loading ? 'Synchronisation…' : canReadContacts ? 'Continuer' : 'Rechercher'}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full mt-2 text-[12px] font-bold text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-3 py-1.5 hover:text-[var(--text-primary)] transition-colors"
            >
              Plus tard
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 overflow-y-auto min-h-0">
            <p className="m-0 text-[13px] text-[var(--text-secondary)]">
              {matches.length} de tes contacts sont déjà sur Wouaff · {missing.length} ne le sont pas encore.
            </p>

            {matches.length > 0 && (
              <section className="mt-4">
                <h3 className="m-0 mb-2 text-[13px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wide">
                  Sur Wouaff, suis-les !
                </h3>
                <div className="flex flex-col gap-2">
                  {matches.map((m) => {
                    const isFollowing = !!following[m.uid];
                    const initial = (m.pseudo || '?')[0]?.toUpperCase() || '?';
                    return (
                      <div
                        key={m.uid}
                        className="flex items-center gap-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] px-3 py-2"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
                          {m.avatar ? (
                            <img
                              src={m.avatar}
                              alt={`Avatar de ${m.pseudo || "l'utilisateur"}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{initial}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">{m.pseudo}</div>
                          <div className="text-[12px] text-[var(--text-muted)] truncate">{handle(m)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFollow(m)}
                          aria-label={isFollowing ? `Ne plus suivre ${m.pseudo}` : `Suivre $m.pseudo`}
                          className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-bold border-none cursor-pointer transition-colors $
                            isFollowing
                              ? 'bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border)]'
                              : 'bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90'`}
                        >
                          {isFollowing ? <Check size={13} /> : <UserPlus size={13} />}
                          {isFollowing ? 'Suivi' : 'Suivre'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {missing.length > 0 && (
              <section className="mt-5">
                <h3 className="m-0 mb-2 text-[13px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wide">
                  Pas encore sur Wouaff, invite-les !
                </h3>
                <div className="flex flex-col gap-2">
                  {missing.slice(0, 20).map((num) => (
                    <div
                      key={num}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] px-3 py-2"
                    >
                      <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{num}</span>
                      <button
                        type="button"
                        onClick={() => invite(num)}
                        className="flex items-center gap-1 rounded-full bg-brand hover:opacity-90 transition-opacity text-white font-bold text-[12px] px-3.5 py-1.5 border-none cursor-pointer"
                      >
                        <Send size={13} /> Inviter
                      </button>
                    </div>
                  ))}
                  {missing.length > 20 && (
                    <p className="m-0 text-[12px] text-[var(--text-muted)]">+{missing.length - 20} autres contacts</p>
                  )}
                </div>
              </section>
            )}

            <button
              type="button"
              onClick={onDone}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-4 py-3 border-none cursor-pointer"
            >
              Terminer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
