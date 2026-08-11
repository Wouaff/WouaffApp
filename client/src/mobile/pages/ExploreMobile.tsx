import { IonAvatar, IonButton, IonCard, IonCardContent, IonIcon, IonList, IonSpinner, IonText } from '@ionic/react';
import { people } from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast, { showToast } from '../../components/Common/Toast';
import { groups as groupsAPI } from '../../services/api';
import MobilePage from '../MobilePage';

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
    <MobilePage title="Explorer" onRefresh={loadGroups}>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <IonSpinner />
          <IonText color="medium">Chargement des groupes...</IonText>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 px-6">
          <IonText color="medium">Aucun groupe public pour le moment.</IonText>
        </div>
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
                      <IonButton fill="outline" size="small" onClick={() => navigate(`/?group=${g.gid}`)}>
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
