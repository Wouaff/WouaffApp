import { ChevronLeft, Globe, UserPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../components/Common/Toast';
import { groups as groupsAPI } from '../services/api';

interface PublicGroup {
  gid: string;
  name: string;
  description: string;
  icon: string;
  memberCount: number;
  members: Record<string, { role: string }>;
}

export default function PublicGroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinedGids, setJoinedGids] = useState<Set<string>>(new Set());

  const loadGroups = useCallback(async () => {
    try {
      const data = await groupsAPI.public();
      setGroups(data as unknown as PublicGroup[]);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
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
  }, [loadMyGroups, loadGroups]);

  const handleJoin = async (gid: string) => {
    try {
      const g = groups.find((x) => x.gid === gid);
      const inviteId = g ? await getInviteForGroup(gid) : null;
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

  const handleOpen = (gid: string) => {
    navigate(`/?group=${gid}`);
  };

  return (
    <div className="pubg-container">
      <div className="pubg-header">
        <button className="pubg-back" onClick={() => navigate('/')}>
          <ChevronLeft size={22} />
        </button>
        <div className="pubg-header-info">
          <Globe size={20} className="pubg-header-icon" />
          <span>Groupes publics</span>
        </div>
      </div>

      <div className="pubg-content">
        {loading ? (
          <div className="pubg-empty">Chargement...</div>
        ) : groups.length === 0 ? (
          <div className="pubg-empty">Aucun groupe public pour le moment</div>
        ) : (
          <div className="pubg-grid">
            {groups.map((g) => {
              const joined = joinedGids.has(g.gid);
              return (
                <div
                  key={g.gid}
                  className="pubg-card"
                  onClick={() => (joined ? handleOpen(g.gid) : undefined)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="pubg-card-banner" style={g.icon ? { backgroundImage: `url(${g.icon})` } : {}}>
                    <div className="pubg-card-banner-overlay" />
                    <div className="pubg-card-avatar">{g.icon ? <img src={g.icon} alt="" loading="lazy" decoding="async" /> : <Users size={24} />}</div>
                  </div>
                  <div className="pubg-card-body">
                    <div className="pubg-card-name">{g.name}</div>
                    <div className="pubg-card-desc">{g.description || 'Aucune description'}</div>
                    <div className="pubg-card-meta">
                      <Users size={13} />
                      <span>
                        {g.memberCount || Object.keys(g.members).length} membre
                        {(g.memberCount || Object.keys(g.members).length) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <button
                      className={`pubg-card-btn ${joined ? 'pubg-btn-joined' : 'pubg-btn-join'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        joined ? handleOpen(g.gid) : handleJoin(g.gid);
                      }}
                    >
                      {joined ? (
                        <>Ouvrir</>
                      ) : (
                        <>
                          <UserPlus size={14} /> Rejoindre
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
