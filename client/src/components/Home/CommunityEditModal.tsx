import { Camera, Lock, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { communities as communitiesAPI } from '../../services/api';
import type { Community } from '../../types';
import { compressImage } from '../../utils/audio';
import { showToast } from '../Common/Toast';

interface CommunityEditModalProps {
  community: Community;
  onClose: () => void;
  onUpdated?: (community: Community) => void;
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

export default function CommunityEditModal({ community, onClose, onUpdated }: CommunityEditModalProps) {
  const [displayName, setDisplayName] = useState(community.displayName || '');
  const [description, setDescription] = useState(community.description || '');
  const [category, setCategory] = useState(community.category || 'Autre');
  const [rules, setRules] = useState<string[]>(community.rules.length > 0 ? community.rules : ['']);
  const [isPrivate, setIsPrivate] = useState(community.isPrivate);
  const [avatar, setAvatar] = useState(community.avatar || '');
  const [banner, setBanner] = useState(community.banner || '');
  const [sending, setSending] = useState(false);
  const [imageLoading, setImageLoading] = useState<'avatar' | 'banner' | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const setRule = (index: number, value: string) => {
    setRules((prev) => prev.map((r, i) => (i === index ? value : r)));
  };

  const addRule = () => {
    setRules((prev) => (prev.length < 10 ? [...prev, ''] : prev));
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const pickImage = async (file: File, kind: 'avatar' | 'banner') => {
    if (!file.type.startsWith('image/')) {
      showToast('Le fichier sélectionné doit être une image.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image trop volumineuse (5 Mo maximum).', 'error');
      return;
    }
    setImageLoading(kind);
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target?.result) {
        setImageLoading(null);
        return;
      }
      try {
        const compressed = await compressImage(e.target.result as string, kind === 'avatar' ? 600 : 1200, 0.78);
        if (kind === 'avatar') setAvatar(compressed);
        else setBanner(compressed);
      } catch {
        showToast("Impossible de traiter l'image.", 'error');
      } finally {
        setImageLoading(null);
      }
    };
    reader.onerror = () => {
      setImageLoading(null);
      showToast("Impossible de lire l'image.", 'error');
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const cleanRules = rules.map((r) => r.trim()).filter(Boolean);
    setSending(true);
    try {
      const updated = await communitiesAPI.update(community.name, {
        displayName: displayName.trim() || community.name,
        description: description.trim(),
        category,
        rules: cleanRules,
        avatar,
        banner,
        isPrivate,
      });
      showToast('Communauté mise à jour', 'success');
      onUpdated?.(updated);
      onClose();
    } catch (err) {
      showToast((err as Error).message || 'Erreur lors de la mise à jour', 'error');
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
          <span className="font-bold text-[var(--text-primary)] text-[17px] m-0">Modifier c/{community.name}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">
          {/* Banner */}
          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: input caché, interaction via le div role="button" */}
            <label className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5">Bannière</label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => bannerInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') bannerInputRef.current?.click();
              }}
              className="relative w-full h-24 rounded-xl overflow-hidden bg-[var(--bg-input)] border border-[var(--border)] cursor-pointer group flex items-center justify-center"
            >
              {banner ? (
                <img src={banner} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[13px] text-[var(--text-muted)]">Ajouter une bannière</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={18} className="text-white" />
              </div>
              {imageLoading === 'banner' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="spinner" />
                </div>
              )}
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickImage(file, 'banner');
                e.target.value = '';
              }}
            />
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-xl overflow-hidden cursor-pointer border-none flex-shrink-0 group"
              aria-label="Changer la photo de profil"
            >
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera size={22} className="text-white/70" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={18} className="text-white" />
              </div>
              {imageLoading === 'avatar' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="spinner" />
                </div>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickImage(file, 'avatar');
                e.target.value = '';
              }}
            />
            <div className="text-[13px] text-[var(--text-secondary)]">
              <div className="font-bold text-[var(--text-primary)]">Photo de profil</div>
              <div className="text-[12px] text-[var(--text-muted)]">Clique pour changer</div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="ce-display" className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5">
              Nom d'affichage
            </label>
            <input
              id="ce-display"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Communauté France"
              maxLength={100}
              aria-label="Nom d'affichage"
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="ce-desc" className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5">
              Description
            </label>
            <textarea
              id="ce-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="De quoi parle ta communauté ?"
              maxLength={500}
              rows={3}
              aria-label="Description"
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans resize-none transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="ce-cat" className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5">
              Catégorie
            </label>
            <select
              id="ce-cat"
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

          {/* Rules */}
          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: étiquette de groupe */}
            <label className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5">Règles</label>
            <div className="flex flex-col gap-2">
              {rules.map((rule, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: liste de règles éditables
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
                className="self-start text-[13px] font-bold text-brand rounded-full border-none bg-transparent cursor-pointer px-2 py-1 hover:bg-[var(--brand-glow)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Ajouter une règle
              </button>
            </div>
          </div>

          {/* Private toggle */}
          <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-[var(--border)] px-3 py-2.5">
            <Lock size={18} className="text-[var(--text-muted)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-[var(--text-primary)]">Communauté privée</div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                Le contenu n'est visible que par les membres.
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
            disabled={sending}
            className="ml-auto bg-brand hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
          >
            {sending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
