import { Check, Link2, Loader2, Share2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/context';
import { useFormatTimeAgo } from '../../i18n/time';
import type { SocialPost } from '../../types';
import { showToast } from '../Common/Toast';

interface SharePostModalProps {
  post: SocialPost;
  onClose: () => void;
}

export default function SharePostModal({ post, onClose }: SharePostModalProps) {
  const { t } = useI18n();
  const formatTime = useFormatTimeAgo();
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/post/${post.id}`);
  }, [post.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast(t('Lien copié dans le presse-papiers'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t('Impossible de copier le lien'), 'error');
    }
  }, [url, t]);

  const nativeShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await navigator.share({
        title: t('Post de {name} sur Wouaff', { name: post.pseudo }),
        text: post.text || t('Voir le post de {name} sur Wouaff', { name: post.pseudo }),
        url,
      });
      onClose();
    } catch {
      /* partage annulé par l'utilisateur, ne rien faire */
    } finally {
      setSharing(false);
    }
  }, [post.pseudo, post.text, url, onClose, sharing, t]);

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  const initial = (post.pseudo || '?')[0]?.toUpperCase() || '?';

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[440px] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
        <div className="flex items-center gap-4 px-4 h-14 border-b border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Fermer')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-primary)] border-none bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={18} />
          </button>
          <span className="font-bold text-[var(--text-primary)] text-[17px] m-0">{t('Partager le post')}</span>
        </div>

        <div className="px-5 py-4">
          <div className="flex gap-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] p-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
              {post.avatar ? (
                <img
                  src={post.avatar}
                  alt={t('Avatar de {name}', { name: post.pseudo || t("l'utilisateur") })}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-[var(--text-primary)] text-[14px]">{post.pseudo}</span>
                <span className="text-[var(--text-muted)] text-[13px]">· {formatTime(post.time)}</span>
              </div>
              {post.text && (
                <p className="m-0 mt-0.5 text-[14px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words line-clamp-3">
                  {post.text}
                </p>
              )}
            </div>
          </div>

          {canNativeShare && (
            <button
              type="button"
              onClick={nativeShare}
              disabled={sharing}
              className="w-full flex items-center justify-center gap-2 mb-3 bg-brand hover:opacity-90 disabled:opacity-50 transition-opacity text-white font-bold text-sm rounded-full px-4 py-3 border-none cursor-pointer"
            >
              {sharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              {t("Partager via l'application")}
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-[var(--bg-input)] border border-[var(--border)] rounded-full px-4 py-2.5 text-[13px] text-[var(--text-secondary)] truncate select-all">
              {url}
            </div>
            <button
              type="button"
              onClick={copyLink}
              aria-label={t('Copier le lien')}
              className="flex items-center gap-1.5 bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)] font-bold text-sm rounded-full px-4 py-2.5 border border-[var(--border)] cursor-pointer"
            >
              {copied ? <Check size={15} className="text-online" /> : <Link2 size={15} />}
              {copied ? t('Copié') : t('Copier')}
            </button>
          </div>
          <p className="m-0 mt-3 text-[12px] text-[var(--text-muted)]">
            {t('Toute personne disposant du lien pourra consulter ce post.')}
          </p>
        </div>
      </div>
    </div>
  );
}
