import { IonAvatar, IonButton, IonCard, IonCardContent, IonIcon, IonList } from '@ionic/react';
import { people, trendingUp } from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast, { showToast } from '../../components/Common/Toast';
import { groups as groupsAPI, trends as trendsAPI } from '../../services/api';
import type { TrendItem } from '../../types';
import MobilePage from '../MobilePage';
import { MobileEmpty, MobileSkeleton } from '../MobileState';
import SearchButton from '../SearchButton';

interface PublicGroup {
  gid: string;
  name: string;
  description: string;
  icon: string;
  memberCount: number;
  members: Record<string, { role: string }>;
}

export default function ExploreMobile() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinedGids, setJoinedGids] = useState<Set<string>>(new Set());

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await groupsAPI.public();
      setGroups(data as unknown as PublicGroup[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMyGroups = useCallback(async () => {
    try {
      const mine = await groupsAPI.list();
      const gids = new Set<string>();
      for (const key of Object.keys(mine)) {
        const entry = mine[key] as { group?: { gid?: string } };
        if (entry.group?.gid) gids.add(entry.group.gid);
      }
      setJoinedGids(gids);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadGroups();
    loadMyGroups();
    trendsAPI
      .list(10)
      .then(setTrends)
      .catch(() => {});
  }, [loadGroups, loadMyGroups]);

  const getInviteForGroup = async (gid: string): Promise<string | null> => {
    try {
      const g = await groupsAPI.get(gid);
      const inviteId = (g as Record<string, unknown>).inviteId as string | undefined;
      if (!inviteId || inviteId === 'null') return null;
      return inviteId;
    } catch {
      return null;
    }
  };

  const handleJoin = async (gid: string) => {
    try {
      const inviteId = await getInviteForGroup(gid);
      if (!inviteId) {
        showToast("Ce groupe n'a pas de lien d'invitation", 'error');
        return;
      }
      await groupsAPI.join(inviteId);
      setJoinedGids((prev) => new Set(prev).add(gid));
      showToast('Vous avez rejoint le groupe !', 'success');
    } catch {
      showToast('Impossible de rejoindre le groupe', 'error');
    }
  };

  return (
    <MobilePage title="Explorer" onRefresh={loadGroups} rightSlot={<SearchButton />}>
      {trends.length > 0 && (
        <section className="px-4 pt-3">
          <h2 className="flex items-center gap-1.5 m-0 mb-2 text-[15px] font-extrabold text-[var(--text-primary)]">
            <IonIcon icon={trendingUp} className="text-brand" />
            Tendances
          </h2>
          <div className="flex flex-wrap gap-2">
            {trends.map((t) => (
              <button
                key={t.tag}
                type="button"
                onClick={() => navigate(`/hashtag/${encodeURIComponent(t.tag)}`)}
                className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-[13px] font-bold text-[var(--text-primary)] cursor-pointer hover:border-brand hover:text-brand transition-colors"
              >
                <span className="text-brand">#{t.tag}</span>
                <span className="text-[var(--text-muted)] font-semibold">{t.posts} posts</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {loading ? (
        <MobileSkeleton count={4} />
      ) : groups.length === 0 ? (
        <MobileEmpty
          icon={<IonIcon icon={people} />}
          title="Aucun groupe public"
          text="Crée ton groupe ou attends l'arrivée de nouveaux groupes publics."
        />
      ) : (
        <IonList className="ion-padding-horizontal" inset={false}>
          {groups.map((g) => {
            const joined = joinedGids.has(g.gid);
            return (
              <IonCard key={g.gid} className="!mb-3">
                <IonCardContent>
                  <div className="flex items-center gap-3">
                    <IonAvatar slot="start">
                      {g.icon ? (
                        <img src={g.icon} alt="" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[var(--brand-glow)] text-brand">
                          <IonIcon icon={people} />
                        </div>
                      )}
                    </IonAvatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-bold text-[var(--text-primary)]">{g.name}</div>
                      {g.description && (
                        <div className="truncate text-[12px] text-[var(--text-muted)]">{g.description}</div>
                      )}
                      <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                        <IonIcon icon={people} size="small" /> {g.memberCount || 0} membres
                      </div>
                    </div>
                    {joined ? (
                      <IonButton
                        fill="outline"
                        size="small"
                        onClick={() => showToast('La messagerie revient bientôt', 'info')}
                      >
                        Ouvrir
                      </IonButton>
                    ) : (
                      <IonButton size="small" onClick={() => handleJoin(g.gid)}>
                        Rejoindre
                      </IonButton>
                    )}
                  </div>
                </IonCardContent>
              </IonCard>
            );
          })}
        </IonList>
      )}

      <Toast />
    </MobilePage>
  );
}
