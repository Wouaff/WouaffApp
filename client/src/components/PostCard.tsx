import { Ban, Flag, Heart, Link2, MessageCircle, MoreHorizontal, Repeat2, Share, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fullDate, timeAgo } from '../lib/time';
import { api } from '../services/api';
import Avatar from './Avatar';
import RichText from './RichText';
import VerifiedBadge from './VerifiedBadge';

export interface PostUser {
  uid: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
  verified: boolean;
}

export interface Post {
  /* post d'origine : cible des likes, commentaires et reposts */
  id: number;
  /* ligne du fil (celle du repost s'il y en a un) : clé de liste et suppression */
  feedId: number;
  text: string | null;
  image: string | null;
  video: string | null;
  createdAt: string;
  feedAt: string;
  likesCount: number;
  repostsCount: number;
  commentsCount: number;
  userLiked: boolean;
  userReposted: boolean;
  repostOf: number | null;
  repostedBy: { uid: string; pseudo: string; displayName: string | null } | null;
  user: PostUser;
}

interface PostCardProps {
  post: Post;
  /* Clic sur la carte => ouvre la page du post (désactivé sur la page du post elle-même). */
  linkToPost?: boolean;
  onDelete?: (feedId: number) => void;
  onBlocked?: (uid: string) => void;
}

export function postUrl(id: number): string {
  return `${window.location.origin}/post/${id}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function PostCard({ post, linkToPost = true, onDelete, onBlocked }: PostCardProps) {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.userLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [reposted, setReposted] = useState(post.userReposted);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 2500);
  };

  /* La ligne appartient à celui qui a reposté, sinon à l'auteur. */
  const rowOwnerUid = post.repostedBy ? post.repostedBy.uid : post.user.uid;
  const canDelete = me?.uid === rowOwnerUid;
  const isOwnPost = me?.uid === post.user.uid;

  const handleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikesCount((c) => c + (next ? 1 : -1));
    try {
      await api.post(`/posts/${post.id}/like`);
    } catch {
      setLiked(!next);
      setLikesCount((c) => c + (next ? -1 : 1));
    }
  };

  const handleRepost = async () => {
    const next = !reposted;
    setReposted(next);
    setRepostsCount((c) => c + (next ? 1 : -1));
    try {
      await api.post(`/posts/${post.id}/repost`);
    } catch {
      setReposted(!next);
      setRepostsCount((c) => c + (next ? -1 : 1));
    }
  };

  const handleShare = async () => {
    const url = postUrl(post.id);
    if (navigator.share) {
      try {
        await navigator.share({ url, text: post.text || undefined });
        return;
      } catch {
        /* partage annulé : on retombe sur la copie du lien */
      }
    }
    flash((await copyToClipboard(url)) ? 'Lien copié' : 'Copie impossible');
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm(post.repostedBy ? 'Annuler ce repost ?' : 'Supprimer ce post ?')) return;
    try {
      await api.del(`/posts/${post.feedId}`);
      onDelete?.(post.feedId);
    } catch {
      flash('Suppression impossible');
    }
  };

  const handleReport = async () => {
    setMenuOpen(false);
    if (!window.confirm('Signaler ce post aux modérateurs ?')) return;
    try {
      await api.post(`/posts/${post.id}/report`, {});
      flash('Merci, le post a été signalé');
    } catch {
      flash('Signalement impossible');
    }
  };

  const handleBlock = async () => {
    setMenuOpen(false);
    if (!window.confirm(`Bloquer @${post.user.pseudo} ? Vous ne verrez plus vos contenus respectifs.`)) return;
    try {
      await api.post(`/blocks/${post.user.pseudo}`);
      onBlocked?.(post.user.uid);
    } catch {
      flash('Blocage impossible');
    }
  };

  const openPost = (e: React.MouseEvent) => {
    if (!linkToPost) return;
    if ((e.target as HTMLElement).closest('a, button, video, [data-no-open]')) return;
    navigate(`/post/${post.id}`);
  };

  return (
    <article
      onClick={openPost}
      className={`px-4 pt-2 pb-1 border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/40 transition-colors ${linkToPost ? 'cursor-pointer' : ''}`}
    >
      {post.repostedBy && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] pl-8 mb-0.5">
          <Repeat2 className="w-4 h-4" />
          <Link to={`/${post.repostedBy.pseudo}`} className="hover:underline text-[var(--text-secondary)] font-medium">
            {post.repostedBy.uid === me?.uid
              ? 'Tu as reposté'
              : `${post.repostedBy.displayName || post.repostedBy.pseudo} a reposté`}
          </Link>
        </div>
      )}
      <div className="flex gap-3">
        <Link to={`/${post.user.pseudo}`} className="flex-shrink-0 mt-1">
          <Avatar src={post.user.avatar} name={post.user.pseudo} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link
                to={`/${post.user.pseudo}`}
                className="font-bold text-[var(--text-primary)] hover:underline truncate"
              >
                {post.user.displayName || post.user.pseudo}
              </Link>
              {post.user.verified && <VerifiedBadge className="w-4 h-4" />}
              <Link
                to={`/${post.user.pseudo}`}
                className="text-[var(--text-secondary)] hover:underline truncate text-sm"
              >
                @{post.user.pseudo}
              </Link>
              <span className="text-[var(--text-secondary)] flex-shrink-0 text-sm">·</span>
              <time
                dateTime={new Date(post.createdAt).toISOString()}
                title={fullDate(post.createdAt)}
                className="text-[var(--text-secondary)] flex-shrink-0 text-sm"
              >
                {timeAgo(post.createdAt)}
              </time>
            </div>
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Plus d'actions"
                aria-expanded={menuOpen}
                className="p-1.5 rounded-full hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] transition-colors"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {menuOpen && (
                <>
                  <div data-no-open className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 top-8 z-50 min-w-[210px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl py-1"
                  >
                    <MenuItem
                      icon={<Link2 className="w-4 h-4" />}
                      label="Copier le lien"
                      onClick={async () => {
                        setMenuOpen(false);
                        flash((await copyToClipboard(postUrl(post.id))) ? 'Lien copié' : 'Copie impossible');
                      }}
                    />
                    {canDelete && (
                      <MenuItem
                        icon={<Trash2 className="w-4 h-4" />}
                        label={post.repostedBy ? 'Annuler le repost' : 'Supprimer'}
                        danger
                        onClick={handleDelete}
                      />
                    )}
                    {!isOwnPost && (
                      <>
                        <MenuItem icon={<Flag className="w-4 h-4" />} label="Signaler" onClick={handleReport} />
                        <MenuItem
                          icon={<Ban className="w-4 h-4" />}
                          label={`Bloquer @${post.user.pseudo}`}
                          danger
                          onClick={handleBlock}
                        />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {post.text && (
            <p className="text-[var(--text-primary)] text-[15px] leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
              <RichText text={post.text} />
            </p>
          )}

          {post.image && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-[var(--border-color)]">
              <img
                src={post.image}
                alt="Pièce jointe du post"
                loading="lazy"
                className="w-full max-h-[500px] object-cover"
              />
            </div>
          )}

          {post.video && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-[var(--border-color)]">
              {/* biome-ignore lint/a11y/useMediaCaption: vidéo envoyée par un utilisateur, pas de sous-titres disponibles */}
              <video
                src={post.video}
                className="w-full max-h-[500px] object-contain bg-black"
                controls
                preload="metadata"
              />
            </div>
          )}

          {notice && (
            <p role="status" className="mt-2 text-sm text-[var(--accent)]">
              {notice}
            </p>
          )}

          <div className="flex items-center justify-between mt-2 max-w-[420px]">
            <Link
              to={`/post/${post.id}`}
              aria-label={`Commentaires : ${post.commentsCount}`}
              className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:no-underline transition-colors group"
            >
              <span className="p-2 rounded-full group-hover:bg-[var(--accent)]/10 transition-colors">
                <MessageCircle className="w-5 h-5" />
              </span>
              <span className="text-sm">{post.commentsCount || ''}</span>
            </Link>

            <button
              type="button"
              onClick={handleRepost}
              aria-pressed={reposted}
              aria-label="Reposter"
              className={`flex items-center gap-1.5 transition-colors group ${reposted ? 'text-[var(--repost-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--repost-color)]'}`}
            >
              <span className="p-2 rounded-full group-hover:bg-[var(--repost-color)]/10 transition-colors">
                <Repeat2 className="w-5 h-5" />
              </span>
              <span className="text-sm">{repostsCount || ''}</span>
            </button>

            <button
              type="button"
              onClick={handleLike}
              aria-pressed={liked}
              aria-label="J'aime"
              className={`flex items-center gap-1.5 transition-colors group ${liked ? 'text-[var(--like-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--like-color)]'}`}
            >
              <span className="p-2 rounded-full group-hover:bg-[var(--like-color)]/10 transition-colors">
                <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
              </span>
              <span className="text-sm">{likesCount || ''}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              aria-label="Partager"
              className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors group"
            >
              <span className="p-2 rounded-full group-hover:bg-[var(--accent)]/10 transition-colors">
                <Share className="w-5 h-5" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left hover:bg-[var(--bg-tertiary)] transition-colors ${danger ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}`}
    >
      {icon}
      {label}
    </button>
  );
}
