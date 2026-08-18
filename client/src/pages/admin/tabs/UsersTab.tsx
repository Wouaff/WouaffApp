import {
  AlertTriangle,
  Award,
  Ban,
  ChevronRight,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminLoginHistoryRow } from '../../../services/api';
import { admin as adminApi } from '../../../services/api';
import type { UserProfile } from '../../../types';
import { compressImage } from '../../../utils/audio';
import {
  Avatar,
  Button,
  Card,
  CopyUid,
  Field,
  formatDate,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SectionTitle,
  Select,
  Textarea,
  useConfirm,
  useToast,
} from '../ui';

export interface UserRequest {
  uid: string;
  nonce: number;
}

interface BanRow {
  uid: string;
  reason: string | null;
  bannedBy: string;
  createdAt: number;
  expiresAt: number | null;
  pseudo: string;
  avatar?: string;
  wouaffId?: string;
}

export function UsersTab({
  request,
  onClearRequest,
  isOwner,
}: {
  request: UserRequest | null;
  onClearRequest: () => void;
  isOwner: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ uid: string; profile: UserProfile } | null>(null);

  const [editData, setEditData] = useState({ pseudo: '', bio: '', avatar: '', banner: '', wouaffId: '' });
  const [imgLoading, setImgLoading] = useState<'avatar' | 'banner' | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [emailOriginal, setEmailOriginal] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const [badgeDefs, setBadgeDefs] = useState<Record<string, { name?: string; icon?: string }>>({});
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [badgeMsg, setBadgeMsg] = useState('');

  const [loginHistory, setLoginHistory] = useState<AdminLoginHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [bans, setBans] = useState<BanRow[]>([]);
  const [bansLoading, setBansLoading] = useState(false);
  const [banTarget, setBanTarget] = useState<{ uid: string; pseudo: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('permanent');
  const [banSending, setBanSending] = useState(false);

  const [recentUsers, setRecentUsers] = useState<Record<string, UserProfile>>({});
  const [recentLoading, setRecentLoading] = useState(false);

  const loadLoginHistory = useCallback(async (uid: string) => {
    setHistoryLoading(true);
    try {
      setLoginHistory(await adminApi.loginHistory(uid));
    } catch {
      setLoginHistory([]);
    }
    setHistoryLoading(false);
  }, []);

  const searchProfile = useCallback(
    async (qOverride?: string) => {
      const q = (qOverride ?? query).trim();
      if (!q) return;
      setSearching(true);
      setError('');
      setResult(null);
      setSaveMsg('');
      setBadgeMsg('');
      setLoginHistory([]);
      try {
        let uid: string;
        let prof: UserProfile;
        if (q.startsWith('@')) {
          const res = await fetch(`/api/search/users/${encodeURIComponent(q)}`);
          if (!res.ok) throw new Error('Utilisateur introuvable');
          const data = (await res.json()) as { uid: string; profile: UserProfile };
          uid = data.uid;
          prof = data.profile;
        } else {
          const res = await fetch(`/api/profiles/${encodeURIComponent(q)}`);
          if (!res.ok) throw new Error('Utilisateur introuvable');
          prof = (await res.json()) as UserProfile;
          uid = q;
        }
        if (!prof?.pseudo) throw new Error('Profil introuvable');
        setResult({ uid, profile: prof });
        setEditData({
          pseudo: prof.pseudo || '',
          bio: prof.bio || '',
          avatar: prof.avatar || '',
          banner: prof.banner || '',
          wouaffId: prof.wouaffId || '',
        });
        const raw = prof.ownedBadges;
        let ids: string[] = [];
        if (raw) {
          if (Array.isArray(raw)) ids = raw.filter(Boolean) as string[];
          else if (typeof raw === 'object') ids = Object.values(raw as Record<string, string>).filter(Boolean);
        }
        setSelectedBadges(ids);
        setEmailLoading(true);
        adminApi.profile
          .email(uid)
          .then((r) => {
            const current = r.email || '';
            setEmail(current);
            setEmailOriginal(current);
            setEmailVerified(!!r.emailVerified);
          })
          .catch(() => {
            setEmail('');
            setEmailOriginal('');
            setEmailVerified(false);
          })
          .finally(() => setEmailLoading(false));
        loadLoginHistory(uid);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
      setSearching(false);
    },
    [query, loadLoginHistory],
  );

  useEffect(() => {
    if (request) {
      setQuery(request.uid);
      searchProfile(request.uid);
      onClearRequest();
    }
  }, [request, searchProfile, onClearRequest]);

  const pickImage = async (file: File, kind: 'avatar' | 'banner') => {
    if (!file.type.startsWith('image/')) {
      toast('Le fichier sélectionné doit être une image.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('Image trop volumineuse (10 Mo maximum).', 'error');
      return;
    }
    setImgLoading(kind);
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target?.result) {
        setImgLoading(null);
        return;
      }
      try {
        const compressed = await compressImage(e.target.result as string, kind === 'avatar' ? 600 : 1200, 0.78);
        setEditData((p) => ({ ...p, [kind]: compressed }));
        toast(kind === 'avatar' ? 'Photo de profil chargée' : 'Bannière chargée', 'success');
      } catch {
        toast('Impossible de traiter l’image.', 'error');
      } finally {
        setImgLoading(null);
      }
    };
    reader.onerror = () => {
      setImgLoading(null);
      toast('Impossible de lire l’image.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!result) return;
    const { uid } = result;
    const data: Record<string, string> = {};
    if (editData.pseudo !== result.profile.pseudo) data.pseudo = editData.pseudo;
    if (editData.bio !== (result.profile.bio || '')) data.bio = editData.bio;
    if (editData.avatar !== (result.profile.avatar || '')) data.avatar = editData.avatar;
    if (editData.banner !== (result.profile.banner || '')) data.banner = editData.banner;
    if (editData.wouaffId !== (result.profile.wouaffId || '')) {
      if (!editData.wouaffId.startsWith('@')) {
        setSaveMsg('L’identifiant doit commencer par @');
        return;
      }
      data.wouaffId = editData.wouaffId;
    }
    if (isOwner && email.trim() !== emailOriginal.trim()) data.email = email.trim();
    if (Object.keys(data).length === 0) {
      setSaveMsg('Aucune modification');
      return;
    }
    try {
      await adminApi.profile.update(uid, data);
      adminApi.logAction('profile_update', 'user', uid, Object.keys(data).join(', '));
      setSaveMsg('Profil mis à jour ✓');
      toast('Profil mis à jour', 'success');
      if (data.email !== undefined) setEmailOriginal(data.email);
      setResult({ ...result, profile: { ...result.profile, ...data } });
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const toggleBadge = (id: string) => {
    setSelectedBadges((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const saveBadges = async () => {
    if (!result) return;
    try {
      await adminApi.badges.set(result.uid, selectedBadges);
      adminApi.logAction('badge_update', 'user', result.uid, selectedBadges.join(', '));
      setBadgeMsg('Badges mis à jour ✓');
      toast('Badges mis à jour', 'success');
    } catch (e) {
      setBadgeMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const resetWouaffId = async () => {
    if (!result) return;
    const ok = await confirm({
      title: 'Réinitialiser le Wouaff ID ?',
      message: `Le Wouaff ID de ${result.profile.pseudo || result.uid} sera effacé.`,
      confirmLabel: 'Réinitialiser',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.profile.resetWouaffId(result.uid);
      adminApi.logAction('wouaffid_reset', 'user', result.uid);
      setEditData((prev) => ({ ...prev, wouaffId: '' }));
      toast('Wouaff ID réinitialisé', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const deleteAccount = async () => {
    if (!result) return;
    const ok = await confirm({
      title: 'Supprimer ce compte ?',
      message: `Le compte de ${result.profile.pseudo || result.uid} sera définitivement supprimé. Cette action est irréversible.`,
      confirmLabel: 'Supprimer définitivement',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.profile.delete(result.uid);
      adminApi.logAction('account_delete', 'user', result.uid, result.profile.pseudo);
      toast('Compte supprimé', 'success');
      setResult(null);
      setQuery('');
      setLoginHistory([]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const loadBans = async () => {
    setBansLoading(true);
    try {
      setBans(await adminApi.bans.list());
    } catch {
      toast('Erreur de chargement des bannissements', 'error');
    }
    setBansLoading(false);
  };

  const submitBan = async () => {
    if (!banTarget || banSending) return;
    setBanSending(true);
    try {
      const durationHours = banDuration === 'permanent' ? undefined : Number(banDuration);
      await adminApi.bans.ban(banTarget.uid, banReason.trim() || undefined, durationHours);
      toast('Utilisateur banni', 'success');
      setBanTarget(null);
      setBanReason('');
      setBanDuration('permanent');
      loadBans();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
    setBanSending(false);
  };

  const unban = async (uid: string) => {
    const ok = await confirm({ title: 'Débannir cet utilisateur ?', confirmLabel: 'Débannir' });
    if (!ok) return;
    try {
      await adminApi.bans.unban(uid);
      setBans((prev) => prev.filter((b) => b.uid !== uid));
      toast('Utilisateur débanni', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      setRecentUsers(await adminApi.users.recent());
    } catch {
      toast('Erreur de chargement des utilisateurs récents', 'error');
    }
    setRecentLoading(false);
  }, [toast]);

  useEffect(() => {
    adminApi.badges
      .list()
      .then((data) => setBadgeDefs(data as Record<string, { name?: string; icon?: string }>))
      .catch(() => {});
    loadRecent();
  }, [loadRecent]);

  const clickUser = (uid: string) => {
    setQuery(uid);
    setResult(null);
    searchProfile(uid);
  };

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle="Recherche, édition, badges, bannissements et historique de connexion."
      />

      <div style={{ marginBottom: 16 }}>
        <div className="wa-search-row">
          <div className="wa-search" style={{ flex: 1 }}>
            <Search size={16} className="wa-search-ic" />
            <input
              className="wa-search-input"
              placeholder="@wouaff_id, UID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchProfile()}
            />
            {query && (
              <button
                type="button"
                className="wa-search-clear"
                onClick={() => {
                  setQuery('');
                  setResult(null);
                  setLoginHistory([]);
                  setEmail('');
                  setEmailOriginal('');
                  setEmailVerified(false);
                }}
                aria-label="Effacer"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Button variant="primary" icon={<Search size={15} />} onClick={() => searchProfile()} loading={searching}>
            Rechercher
          </Button>
        </div>
      </div>

      {error && <div className="wa-alert wa-alert-danger">{error}</div>}

      {result && (
        <div className="wa-user-section">
          <Card pad={false} className="wa-profile-card">
            {result.profile.banner && (
              <div className="wa-profile-banner" style={{ backgroundImage: `url(${result.profile.banner})` }} />
            )}
            <div className="wa-profile-body">
              <div className="wa-profile-avatar-wrap">
                {result.profile.avatar ? (
                  <img className="wa-profile-avatar-img" src={result.profile.avatar} alt="" />
                ) : (
                  <div className="wa-profile-avatar-fallback">{(result.profile.pseudo || '?')[0]?.toUpperCase()}</div>
                )}
              </div>
              <div className="wa-profile-name">{result.profile.pseudo || 'Utilisateur'}</div>
              <div className="wa-profile-handle">{result.profile.wouaffId || '(aucun ID)'}</div>
              <div className="wa-profile-uid">
                <code>{result.uid}</code>
                <CopyUid value={result.uid} />
              </div>
              <div className="wa-profile-email">
                <Mail size={13} />
                <span>{emailLoading ? 'Chargement…' : email || '(aucun email)'}</span>
                {!emailLoading && email && (
                  <span className={`wa-chip wa-chip-${emailVerified ? 'success' : 'danger'}`}>
                    {emailVerified ? 'Vérifié' : 'Non vérifié'}
                  </span>
                )}
              </div>
              {result.profile.bio && <p className="wa-profile-bio">{result.profile.bio}</p>}
              <div className="wa-profile-badges">
                {selectedBadges.length > 0 ? (
                  selectedBadges.map((id) =>
                    badgeDefs[id] ? (
                      <span key={id} className={`wa-chip${id === 'staff' ? ' wa-chip-brand' : ''}`}>
                        {badgeDefs[id].icon && <img src={badgeDefs[id].icon} alt="" className="wa-chip-img" />}
                        {badgeDefs[id].name || id}
                      </span>
                    ) : null,
                  )
                ) : (
                  <span className="wa-muted">Aucun badge</span>
                )}
              </div>
            </div>
          </Card>

          <Card title="Modifier le profil" icon={<User size={15} />}>
            <div className="wa-form-grid">
              <Field label="Pseudo">
                <Input
                  value={editData.pseudo}
                  onChange={(e) => setEditData((p) => ({ ...p, pseudo: e.target.value }))}
                />
              </Field>
              <Field label="Identifiant Wouaff">
                <Input
                  value={editData.wouaffId}
                  onChange={(e) => setEditData((p) => ({ ...p, wouaffId: e.target.value }))}
                  placeholder="@identifiant"
                />
              </Field>
            </div>
            <Field label="Email" hint={!isOwner ? 'Modification réservée au propriétaire' : undefined}>
              <Input
                type="email"
                value={email}
                placeholder="email@exemple.com"
                disabled={!isOwner}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Bio">
              <Textarea
                rows={2}
                value={editData.bio}
                onChange={(e) => setEditData((p) => ({ ...p, bio: e.target.value }))}
              />
            </Field>
            <div className="wa-form-grid">
              <Field label="Avatar">
                <div className="wa-file-row">
                  <Input
                    value={editData.avatar}
                    placeholder="https://… ou fichier"
                    onChange={(e) => setEditData((p) => ({ ...p, avatar: e.target.value }))}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={imgLoading === 'avatar' ? <Loader2 size={14} className="wa-spin" /> : <Upload size={14} />}
                    onClick={() => avatarFileRef.current?.click()}
                    disabled={imgLoading === 'avatar'}
                  >
                    Fichier
                  </Button>
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/*"
                    className="wa-hidden-input"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) pickImage(f, 'avatar');
                      e.target.value = '';
                    }}
                  />
                </div>
              </Field>
              <Field label="Bannière">
                <div className="wa-file-row">
                  <Input
                    value={editData.banner}
                    placeholder="https://… ou fichier"
                    onChange={(e) => setEditData((p) => ({ ...p, banner: e.target.value }))}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={imgLoading === 'banner' ? <Loader2 size={14} className="wa-spin" /> : <Upload size={14} />}
                    onClick={() => bannerFileRef.current?.click()}
                    disabled={imgLoading === 'banner'}
                  >
                    Fichier
                  </Button>
                  <input
                    ref={bannerFileRef}
                    type="file"
                    accept="image/*"
                    className="wa-hidden-input"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) pickImage(f, 'banner');
                      e.target.value = '';
                    }}
                  />
                </div>
              </Field>
            </div>
            <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={saveProfile}>
              Enregistrer
            </Button>
            {saveMsg && <div className="wa-inline-msg">{saveMsg}</div>}
          </Card>

          <Card title="Gestion des badges" icon={<Award size={15} />}>
            <div className="wa-badge-grid">
              {Object.entries(badgeDefs).map(([id, b]) => (
                <button
                  key={id}
                  type="button"
                  className={`wa-badge-opt${selectedBadges.includes(id) ? ' selected' : ''}`}
                  onClick={() => toggleBadge(id)}
                >
                  {b.icon && <img src={b.icon} alt="" />}
                  <span>{b.name || id}</span>
                </button>
              ))}
            </div>
            <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={saveBadges}>
              Sauvegarder les badges
            </Button>
            {badgeMsg && <div className="wa-inline-msg">{badgeMsg}</div>}
          </Card>

          <Card
            title="Historique de connexions"
            icon={<Globe size={15} />}
            action={
              <IconButton label="Recharger" onClick={() => loadLoginHistory(result.uid)}>
                <RefreshCw size={14} />
              </IconButton>
            }
          >
            {historyLoading ? (
              <p className="wa-muted">Chargement…</p>
            ) : loginHistory.length === 0 ? (
              <p className="wa-muted">Aucune connexion enregistrée.</p>
            ) : (
              <div className="wa-log-list">
                {loginHistory.map((h) => (
                  <div key={h.id} className="wa-log-item">
                    <span className="wa-log-icon">
                      <KeyRound size={14} />
                    </span>
                    <div className="wa-log-info">
                      <div className="wa-log-action">
                        <code>{h.ip || 'IP inconnue'}</code>
                      </div>
                      {h.userAgent && (
                        <div className="wa-log-meta">
                          {h.userAgent.length > 80 ? `${h.userAgent.slice(0, 80)}…` : h.userAgent}
                        </div>
                      )}
                    </div>
                    <span className="wa-log-time">{formatDate(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {isOwner && (
            <Card title="Actions sur le compte" icon={<AlertTriangle size={15} />} className="wa-card-danger">
              <div className="wa-inline-actions">
                <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={resetWouaffId}>
                  Réinitialiser l'ID
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Ban size={14} />}
                  onClick={() => setBanTarget({ uid: result.uid, pseudo: result.profile.pseudo || 'Utilisateur' })}
                >
                  Bannir cet utilisateur
                </Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={deleteAccount}>
                  Supprimer le compte
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      <SectionTitle
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={bansLoading ? <Loader2 size={12} className="wa-spin" /> : <RefreshCw size={12} />}
            onClick={loadBans}
          >
            Charger
          </Button>
        }
      >
        Bannissements actifs
      </SectionTitle>
      <div className="wa-item-list" style={{ marginBottom: 22 }}>
        {bans.length === 0 && <p className="wa-muted">Aucun bannissement actif.</p>}
        {bans.map((b) => (
          <div key={b.uid} className="wa-item">
            <Avatar src={b.avatar} name={b.pseudo} size={40} />
            <div className="wa-item-body">
              <div className="wa-item-head">
                <span className="wa-item-author">{b.pseudo || b.uid}</span>
                <span className="wa-item-time">
                  {b.expiresAt ? `jusqu'au ${formatDate(b.expiresAt)}` : 'Permanent'}
                </span>
              </div>
              {b.reason ? <p className="wa-item-text">« {b.reason} »</p> : null}
              <div className="wa-item-reply">Banni le {formatDate(b.createdAt)}</div>
            </div>
            {isOwner && (
              <div className="wa-item-actions">
                <Button variant="primary" size="sm" icon={<ShieldCheck size={13} />} onClick={() => unban(b.uid)}>
                  Débannir
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <SectionTitle
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={recentLoading ? <Loader2 size={12} className="wa-spin" /> : <RefreshCw size={12} />}
            onClick={loadRecent}
          >
            Charger
          </Button>
        }
      >
        Utilisateurs récents
      </SectionTitle>
      <div className="wa-item-list">
        {Object.entries(recentUsers).length === 0 && <p className="wa-muted">Aucun utilisateur</p>}
        {Object.entries(recentUsers)
          .reverse()
          .map(([uid, p]) => (
            <div key={uid} className="wa-item wa-item-clickable" onClick={() => clickUser(uid)}>
              <Avatar src={p.avatar} name={p.pseudo} size={40} />
              <div className="wa-item-body">
                <div className="wa-item-head">
                  <span className="wa-item-author">{p.pseudo || '(sans pseudo)'}</span>
                  <span className="wa-item-handle">{p.wouaffId || "pas d'ID"}</span>
                </div>
              </div>
              <ChevronRight size={16} className="wa-item-chevron" />
            </div>
          ))}
      </div>

      <Modal
        open={!!banTarget}
        onClose={() => setBanTarget(null)}
        title={banTarget ? `Bannir ${banTarget.pseudo}` : ''}
        icon={<Ban size={16} />}
      >
        <Field label="Raison">
          <Textarea
            rows={3}
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Motif du bannissement…"
          />
        </Field>
        <Field label="Durée">
          <Select value={banDuration} onChange={(e) => setBanDuration(e.target.value)}>
            <option value="permanent">Permanent</option>
            <option value="24">24 heures</option>
            <option value="72">3 jours</option>
            <option value="168">7 jours</option>
            <option value="720">30 jours</option>
          </Select>
        </Field>
        <div className="wa-modal-actions">
          <Button variant="ghost" onClick={() => setBanTarget(null)}>
            Annuler
          </Button>
          <Button variant="danger" icon={<Ban size={14} />} onClick={submitBan} loading={banSending}>
            Bannir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
