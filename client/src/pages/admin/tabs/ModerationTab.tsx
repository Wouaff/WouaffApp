import { Edit3, Film, Heart, MessageCircle, Repeat2, ShieldCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AdminCommentRow, AdminPostRow, AdminVideoRow } from '../../../services/api';
import { admin as adminApi } from '../../../services/api';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  formatNumber,
  PageHeader,
  SearchInput,
  SegTabs,
  SkeletonRows,
  timeAgo,
  useConfirm,
  useToast,
} from '../ui';

type ModSub = 'posts' | 'comments' | 'videos';

export function ModerationTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [sub, setSub] = useState<ModSub>('posts');
  const [posts, setPosts] = useState<AdminPostRow[]>([]);
  const [comments, setComments] = useState<AdminCommentRow[]>([]);
  const [videos, setVideos] = useState<AdminVideoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const load = useCallback(
    async (which: ModSub, uid?: string) => {
      setLoading(true);
      try {
        if (which === 'posts') setPosts(await adminApi.posts.list(30, uid || undefined));
        else if (which === 'comments') setComments(await adminApi.comments.list(30));
        else setVideos(await adminApi.videos.list(30));
      } catch {
        toast('Erreur de chargement de la modération', 'error');
      }
      setLoading(false);
    },
    [toast],
  );

  useEffect(() => {
    load(sub, sub === 'posts' ? activeFilter || undefined : undefined);
  }, [sub, activeFilter, load]);

  const applyFilter = () => {
    setActiveFilter(filter.trim());
  };

  const deletePost = async (id: string, authorPseudo?: string) => {
    const ok = await confirm({
      title: 'Supprimer ce post ?',
      message: authorPseudo
        ? `Le post de ${authorPseudo} sera définitivement supprimé.`
        : 'Le post sera définitivement supprimé.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.posts.delete(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      toast('Post supprimé', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const deleteComment = async (id: number) => {
    const ok = await confirm({
      title: 'Supprimer ce commentaire ?',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.comments.delete(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      toast('Commentaire supprimé', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const deleteVideo = async (id: string, authorPseudo?: string) => {
    const ok = await confirm({
      title: 'Supprimer cette vidéo ?',
      message: authorPseudo
        ? `La vidéo de ${authorPseudo} sera définitivement supprimée.`
        : 'La vidéo sera définitivement supprimée.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.videos.delete(id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
      toast('Vidéo supprimée', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Modération du réseau social"
        subtitle="Posts, commentaires et vidéos : consultez et supprimez le contenu."
      />

      <SegTabs<ModSub>
        value={sub}
        onChange={(s) => setSub(s)}
        items={[
          { id: 'posts', label: 'Posts', icon: <Edit3 size={15} />, count: posts.length },
          { id: 'comments', label: 'Commentaires', icon: <MessageCircle size={15} />, count: comments.length },
          { id: 'videos', label: 'Vidéos', icon: <Film size={15} />, count: videos.length },
        ]}
      />

      {sub === 'posts' && (
        <div style={{ marginBottom: 14 }}>
          <SearchInput
            value={filter}
            onChange={setFilter}
            onEnter={applyFilter}
            onClear={() => setActiveFilter('')}
            placeholder="Filtrer par UID utilisateur…"
          />
        </div>
      )}

      {loading && <SkeletonRows count={5} />}

      {!loading && sub === 'posts' && (
        <div className="wa-item-list">
          {posts.length === 0 && <EmptyState icon={<Edit3 size={26} />} title="Aucun post à modérer" />}
          {posts.map((p) => (
            <div key={p.id} className="wa-item">
              <Avatar src={p.avatar} name={p.pseudo} size={40} />
              <div className="wa-item-body">
                <div className="wa-item-head">
                  <span className="wa-item-author">{p.pseudo || 'Utilisateur'}</span>
                  {p.staffUid && <ShieldCheck size={13} className="wa-verified" />}
                  <span className="wa-item-handle">@{((p.wouaffId as string) || p.uid).replace(/^@/, '')}</span>
                  <span className="wa-item-time">{timeAgo(p.createdAt)}</span>
                </div>
                <p className="wa-item-text">{p.text}</p>
                {p.image && (
                  <img
                    src={p.image}
                    alt=""
                    className="wa-item-thumb"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="wa-item-meta">
                  <span>
                    <Heart size={12} /> {formatNumber(p.likesCount)}
                  </span>
                  <span>
                    <Repeat2 size={12} /> {formatNumber(p.repostsCount)}
                  </span>
                  <span>
                    <MessageCircle size={12} /> {formatNumber(p.commentsCount)}
                  </span>
                </div>
              </div>
              <div className="wa-item-actions">
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={13} />}
                  onClick={() => deletePost(p.id, p.pseudo)}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && sub === 'comments' && (
        <div className="wa-item-list">
          {comments.length === 0 && <EmptyState icon={<MessageCircle size={26} />} title="Aucun commentaire" />}
          {comments.map((c) => (
            <div key={c.id} className="wa-item">
              <Avatar src={c.avatar} name={c.pseudo} size={40} />
              <div className="wa-item-body">
                <div className="wa-item-head">
                  <span className="wa-item-author">{c.pseudo || 'Utilisateur'}</span>
                  <span className="wa-item-time">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="wa-item-text">{c.text}</p>
                {c.postText && <div className="wa-item-reply">sur : « {c.postText} »</div>}
              </div>
              <div className="wa-item-actions">
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteComment(c.id)}>
                  Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && sub === 'videos' && (
        <div className="wa-video-grid">
          {videos.length === 0 && <EmptyState icon={<Film size={26} />} title="Aucune vidéo" />}
          {videos.map((v) => (
            <Card key={v.id} pad={false} className="wa-video-card">
              <div className="wa-video-preview">
                <video src={v.videoPath} preload="metadata" muted playsInline />
                <div className="wa-video-overlay">
                  <Film size={26} />
                </div>
              </div>
              <div className="wa-video-info">
                <div className="wa-item-head">
                  <span className="wa-item-author">{v.pseudo || 'Utilisateur'}</span>
                  <span className="wa-item-time">{timeAgo(v.createdAt)}</span>
                </div>
                {v.caption && <p className="wa-item-text">{v.caption}</p>}
                <div className="wa-item-meta">
                  <span>
                    <Heart size={12} /> {formatNumber(v.likesCount)}
                  </span>
                  <span>
                    <MessageCircle size={12} /> {formatNumber(v.commentsCount)}
                  </span>
                </div>
              </div>
              <div style={{ padding: '0 12px 12px' }}>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={13} />}
                  onClick={() => deleteVideo(v.id, v.pseudo || undefined)}
                  className="wa-video-delete"
                >
                  Supprimer
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
