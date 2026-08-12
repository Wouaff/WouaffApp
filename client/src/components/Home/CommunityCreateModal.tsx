import { Lock, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { communities as communitiesAPI } from '../../services/api';
import type { Community } from '../../types';
import { showToast } from '../Common/Toast';

interface CommunityCreateModalProps {
  onClose: () => void;
  onCreated?: (community: Community) => void;
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const CATEGORIES = [
  'Actu FR',
  'Politique',
  'Tech',
  'Sport',
  'Humour',
  'Culture',
  'Jeux vidéo',
  'Sciences',
  'Musique',
  'Autre',
];

export default function CommunityCreateModal({ onClose, onCreated }: CommunityCreateModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Actu FR');
  const [rules, setRules] = useState<string[]>(['', '', '']);
  const [isPrivate, setIsPrivate] = useState(false);
  const [sending, setSending] = useState(false);

  const slug = slugify(name);

  const setRule = (index: number, value: string) => {
    setRules((prev) => prev.map((r, i) => (i === index ? value : r)));
  };

  const addRule = () => {
    setRules((prev) => (prev.length < 10 ? [...prev, ''] : prev));
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    const cleanRules = rules.map((r) => r.trim()).filter(Boolean);
    if (!slug || slug.length < 2 || slug.length > 50) {
      showToast('Nom invalide (2 à 50 caractères : lettres minuscules, chiffres, _)', 'error');
      return;
    }
    if (!description.trim() && cleanRules.length === 0) {
      showToast('Ajoute une description ou au moins une règle', 'error');
      return;
    }
    setSending(true);
    try {
      const community = await communitiesAPI.create({
        name: slug,
        displayName: displayName.trim() || slug,
        description: description.trim(),
        category,
        rules: cleanRules,
        isPrivate,
      });
      showToast(`Communauté r/${slug} créée 🎉`, 'success');
      onCreated?.(community);
      onClose();
      navigate(`/r/${community.name}`);
    } catch (err) {
      showToast((err as Error).message || 'Erreur lors de la création', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col w-full max-w-[540px] max-h-[90dvh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
        <div className="flex items-center gap-4 px-4 h-14 border-b border-[var(--border)] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-primary)] border-none bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={18} />
          </button>
          <span className="font-bold text-[var(--text-primary)] text-[17px] m-0">Créer une communauté</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">
          <div>
            <label htmlFor="cc-name" className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5">
              Nom de la communauté
            </label>
            <div className="flex items-center gap-1.5 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 focus-within:border-[var(--brand)] transition-colors">
              <span className="text-[var(--text-muted)] font-semibold">r/</span>
              <input
                id="cc-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="france, tech_fr, humour..."
                maxLength={50}
                aria-label="Nom de la communauté"
                className="flex-1 bg-transparent border-none outline-none py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] font-sans"
              />
            </div>
            <p className="m-0 mt-1 text-[12px] text-[var(--text-muted)]">
              URL : /r/{slug || '...'} — lettres minuscules, chiffres et _ uniquement.
            </p>
          </div>

          <div>
            <label htmlFor="cc-display" className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5">
              Nom d'affichage
            </label>
            <input
              id="cc-display"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Communauté France"
              maxLength={100}
              aria-label="Nom d'affichage"
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans transition-colors"
            />
          </div>

          <div>
            <label htmlFor="cc-desc" className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5">
              Description
            </label>
            <textarea
              id="cc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="De quoi parle ta communauté ?"
              maxLength={500}
              rows={3}
              aria-label="Description"
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans resize-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="cc-cat" className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5">
              Catégorie
            </label>
            <select
              id="cc-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Catégorie"
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand)] font-sans transition-colors"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: étiquette de groupe pour la liste de règles */}
            <label className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5">Règles</label>
            <div className="flex flex-col gap-2">
              {rules.map((rule, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: liste de règles éditables, la position est l'identifiant
                <div key={index} className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-[var(--text-muted)] w-5 text-right flex-shrink-0">
                    {index + 1}.
                  </span>
                  <input
                    type="text"
                    value={rule}
                    onChange={(e) => setRule(index, e.target.value)}
                    placeholder="Ex. Pas de spam"
                    maxLength={200}
                    aria-label={`Règle ${index + 1}`}
                    className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans transition-colors"
                  />
                  {rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRule(index)}
                      aria-label={`Supprimer la règle ${index + 1}`}
                      className="w-7 h-7 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addRule}
                disabled={rules.length >= 10}
                className="self-start flex items-center gap-1.5 text-[13px] font-bold text-brand rounded-full border-none bg-transparent cursor-pointer px-2 py-1 hover:bg-[var(--brand-glow)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={15} /> Ajouter une règle
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-[var(--border)] px-3 py-2.5">
            <Lock size={18} className="text-[var(--text-muted)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-[var(--text-primary)]">Communauté privée</div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                Le contenu n'est visible que par les membres (abonnés).
              </div>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              aria-label="Communauté privée"
              className="w-4 h-4 accent-[var(--brand)]"
            />
          </label>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-none bg-transparent cursor-pointer text-[var(--text-secondary)] font-bold text-sm px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending || !slug}
            className="ml-auto bg-brand hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
          >
            {sending ? 'Création...' : 'Créer la communauté'}
          </button>
        </div>
      </div>
    </div>
  );
}
