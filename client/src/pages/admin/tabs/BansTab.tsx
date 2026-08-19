import { Ban, Globe, Loader2, RefreshCw, ShieldCheck, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { admin as adminApi } from '../../../services/api';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  formatDate,
  Input,
  PageHeader,
  SectionTitle,
  SegTabs,
  Select,
  SkeletonRows,
  Textarea,
  useConfirm,
  useToast,
} from '../ui';

type BansSub = 'users' | 'ips';

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

interface IpBanRow {
  id: number;
  ip: string;
  reason: string | null;
  bannedBy: string;
  createdAt: number;
  expiresAt: number | null;
}

const DURATIONS: Array<{ value: string; label: string }> = [
  { value: 'permanent', label: 'Permanent' },
  { value: '6', label: '6 heures' },
  { value: '24', label: '24 heures' },
  { value: '72', label: '3 jours' },
  { value: '168', label: '7 jours' },
  { value: '720', label: '30 jours' },
];

export function BansTab({ isOwner }: { isOwner: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [sub, setSub] = useState<BansSub>('users');

  /* ── Utilisateurs ── */
  const [userBans, setUserBans] = useState<BanRow[]>([]);
  const [userBansLoading, setUserBansLoading] = useState(false);
  const [userTarget, setUserTarget] = useState('');
  const [userReason, setUserReason] = useState('');
  const [userDuration, setUserDuration] = useState('permanent');
  const [userSending, setUserSending] = useState(false);
  const [userErr, setUserErr] = useState('');

  /* ── IP ── */
  const [ipBans, setIpBans] = useState<IpBanRow[]>([]);
  const [ipBansLoading, setIpBansLoading] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [ipReason, setIpReason] = useState('');
  const [ipDuration, setIpDuration] = useState('permanent');
  const [ipSending, setIpSending] = useState(false);
  const [ipErr, setIpErr] = useState('');

  const loadUserBans = useCallback(async () => {
    setUserBansLoading(true);
    try {
      setUserBans(await adminApi.bans.list());
    } catch {
      toast('Erreur de chargement des bannissements', 'error');
    }
    setUserBansLoading(false);
  }, [toast]);

  const loadIpBans = useCallback(async () => {
    setIpBansLoading(true);
    try {
      setIpBans(await adminApi.ipBans.list());
    } catch {
      toast('Erreur de chargement des IP bannies', 'error');
    }
    setIpBansLoading(false);
  }, [toast]);

  useEffect(() => {
    loadUserBans();
    loadIpBans();
  }, [loadUserBans, loadIpBans]);

  const resolveUser = async (q: string): Promise<string> => {
    if (q.startsWith('@')) {
      const res = await fetch(`/api/search/users/${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Utilisateur introuvable');
      const data = (await res.json()) as { uid: string };
      return data.uid;
    }
    const res = await fetch(`/api/profiles/${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('Utilisateur introuvable');
    const prof = (await res.json()) as { uid?: string; pseudo?: string };
    if (!prof?.pseudo) throw new Error('Utilisateur introuvable');
    return q;
  };

  const submitUserBan = async () => {
    const target = userTarget.trim();
    if (!target || userSending) return;
    setUserSending(true);
    setUserErr('');
    try {
      const uid = await resolveUser(target);
      const durationHours = userDuration === 'permanent' ? undefined : Number(userDuration);
      await adminApi.bans.ban(uid, userReason.trim() || undefined, durationHours);
      toast('Utilisateur banni', 'success');
      setUserTarget('');
      setUserReason('');
      setUserDuration('permanent');
      loadUserBans();
    } catch (e) {
      setUserErr(e instanceof Error ? e.message : 'Erreur');
    }
    setUserSending(false);
  };

  const unbanUser = async (uid: string) => {
    const ok = await confirm({ title: 'Débannir cet utilisateur ?', confirmLabel: 'Débannir' });
    if (!ok) return;
    try {
      await adminApi.bans.unban(uid);
      setUserBans((prev) => prev.filter((b) => b.uid !== uid));
      toast('Utilisateur débanni', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const submitIpBan = async () => {
    const ip = ipInput.trim();
    if (!ip || ipSending) return;
    setIpSending(true);
    setIpErr('');
    try {
      const durationHours = ipDuration === 'permanent' ? undefined : Number(ipDuration);
      await adminApi.ipBans.ban(ip, ipReason.trim() || undefined, durationHours);
      toast('Adresse IP bannie', 'success');
      setIpInput('');
      setIpReason('');
      setIpDuration('permanent');
      loadIpBans();
    } catch (e) {
      setIpErr(e instanceof Error ? e.message : 'Erreur');
    }
    setIpSending(false);
  };

  const unbanIp = async (id: number, ip: string) => {
    const ok = await confirm({ title: 'Débannir cette adresse IP ?', confirmLabel: 'Débannir' });
    if (!ok) return;
    try {
      await adminApi.ipBans.unban(id);
      setIpBans((prev) => prev.filter((b) => b.id !== id));
      toast(`IP ${ip} débannie`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Bannissements"
        subtitle="Bannissez des utilisateurs ou des adresses IP (les demandes depuis une IP bannie sont refusées)."
      />

      <SegTabs<BansSub>
        value={sub}
        onChange={setSub}
        items={[
          { id: 'users', label: 'Utilisateurs', icon: <UserX size={15} />, count: userBans.length },
          { id: 'ips', label: 'Adresses IP', icon: <Globe size={15} />, count: ipBans.length },
        ]}
      />

      {sub === 'users' && (
        <div>
          {isOwner && (
            <Card title="Bannir un utilisateur" icon={<UserX size={15} />}>
              <div className="wa-form-grid">
                <Field label="UID ou @ID" hint="Identifiant technique ou @WouaffID">
                  <Input
                    value={userTarget}
                    onChange={(e) => {
                      setUserTarget(e.target.value);
                      setUserErr('');
                    }}
                    placeholder="ex. @jean.wouaff ou abcd1234…"
                    onKeyDown={(e) => e.key === 'Enter' && submitUserBan()}
                  />
                </Field>
                <Field label="Durée">
                  <Select value={userDuration} onChange={(e) => setUserDuration(e.target.value)}>
                    {DURATIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Raison">
                <Textarea
                  rows={2}
                  value={userReason}
                  onChange={(e) => setUserReason(e.target.value)}
                  placeholder="Motif du bannissement…"
                />
              </Field>
              {userErr && <div className="wa-form-err">{userErr}</div>}
              <div className="wa-form-actions">
                <Button
                  variant="danger"
                  icon={userSending ? <Loader2 size={14} className="wa-spin" /> : <Ban size={14} />}
                  onClick={submitUserBan}
                  loading={userSending}
                  disabled={!userTarget.trim()}
                >
                  Bannir
                </Button>
              </div>
            </Card>
          )}

          <SectionTitle
            action={
              <Button
                variant="secondary"
                size="sm"
                icon={userBansLoading ? <Loader2 size={12} className="wa-spin" /> : <RefreshCw size={12} />}
                onClick={loadUserBans}
              >
                Recharger
              </Button>
            }
          >
            Utilisateurs bannis
          </SectionTitle>
          <div className="wa-item-list" style={{ marginBottom: 22 }}>
            {userBansLoading && <SkeletonRows count={3} />}
            {!userBansLoading && userBans.length === 0 && (
              <EmptyState icon={<UserX size={26} />} title="Aucun utilisateur banni" />
            )}
            {!userBansLoading &&
              userBans.map((b) => (
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
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<ShieldCheck size={13} />}
                        onClick={() => unbanUser(b.uid)}
                      >
                        Débannir
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {sub === 'ips' && (
        <div>
          {isOwner && (
            <Card title="Bannir une adresse IP" icon={<Globe size={15} />}>
              <div className="wa-form-grid">
                <Field label="Adresse IP" hint="IPv4 ou IPv6. Les IP locales sont refusées.">
                  <Input
                    value={ipInput}
                    onChange={(e) => {
                      setIpInput(e.target.value);
                      setIpErr('');
                    }}
                    placeholder="ex. 203.0.113.42"
                    onKeyDown={(e) => e.key === 'Enter' && submitIpBan()}
                  />
                </Field>
                <Field label="Durée">
                  <Select value={ipDuration} onChange={(e) => setIpDuration(e.target.value)}>
                    {DURATIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Raison">
                <Textarea
                  rows={2}
                  value={ipReason}
                  onChange={(e) => setIpReason(e.target.value)}
                  placeholder="Motif du bannissement…"
                />
              </Field>
              {ipErr && <div className="wa-form-err">{ipErr}</div>}
              <div className="wa-form-actions">
                <Button
                  variant="danger"
                  icon={ipSending ? <Loader2 size={14} className="wa-spin" /> : <Ban size={14} />}
                  onClick={submitIpBan}
                  loading={ipSending}
                  disabled={!ipInput.trim()}
                >
                  Bannir
                </Button>
              </div>
            </Card>
          )}

          <SectionTitle
            action={
              <Button
                variant="secondary"
                size="sm"
                icon={ipBansLoading ? <Loader2 size={12} className="wa-spin" /> : <RefreshCw size={12} />}
                onClick={loadIpBans}
              >
                Recharger
              </Button>
            }
          >
            Adresses IP bannies
          </SectionTitle>
          <div className="wa-item-list" style={{ marginBottom: 22 }}>
            {ipBansLoading && <SkeletonRows count={3} />}
            {!ipBansLoading && ipBans.length === 0 && (
              <EmptyState icon={<Globe size={26} />} title="Aucune adresse IP bannie" />
            )}
            {!ipBansLoading &&
              ipBans.map((b) => (
                <div key={b.id} className="wa-item">
                  <span className="wa-avatar wa-avatar-ip">
                    <Globe size={18} />
                  </span>
                  <div className="wa-item-body">
                    <div className="wa-item-head">
                      <code className="wa-item-author">{b.ip}</code>
                      <span className="wa-item-time">
                        {b.expiresAt ? `jusqu'au ${formatDate(b.expiresAt)}` : 'Permanent'}
                      </span>
                    </div>
                    {b.reason ? <p className="wa-item-text">« {b.reason} »</p> : null}
                    <div className="wa-item-reply">Bannie le {formatDate(b.createdAt)}</div>
                  </div>
                  {isOwner && (
                    <div className="wa-item-actions">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<ShieldCheck size={13} />}
                        onClick={() => unbanIp(b.id, b.ip)}
                      >
                        Débannir
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
