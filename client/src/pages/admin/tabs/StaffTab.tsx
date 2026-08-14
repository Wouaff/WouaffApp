import { RefreshCw, Shield, UserMinus, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { admin as adminApi } from '../../../services/api';
import type { UserProfile } from '../../../types';
import { Avatar, Button, Card, Chip, EmptyState, Input, PageHeader, SectionTitle, useConfirm, useToast } from '../ui';

interface StaffEntry {
  role: string;
  addedAt: number;
  profile?: UserProfile;
}

export function StaffTab({ isOwner }: { isOwner: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState<Record<string, StaffEntry>>({});
  const [uidInput, setUidInput] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setList(await adminApi.staff.list());
    } catch {
      toast('Erreur de chargement du staff', 'error');
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const uid = uidInput.trim();
    if (!uid) return;
    try {
      await adminApi.staff.add(uid);
      setMsg(`${uid} ajouté au staff (modérateur)`);
      toast('Membre ajouté au staff', 'success');
      setUidInput('');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const setRole = async (uid: string, role: string) => {
    try {
      await adminApi.staff.setRole(uid, role);
      toast(role === 'owner' ? 'Membre promu propriétaire' : 'Membre rétrogradé modérateur', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const remove = async (uid: string, pseudo?: string) => {
    const ok = await confirm({
      title: 'Retirer du staff ?',
      message: `${pseudo || uid} perdra l'accès au panneau d'administration.`,
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.staff.remove(uid);
      toast('Membre retiré du staff', 'success');
      load();
    } catch {
      toast('Erreur', 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Gestion du staff" subtitle="Ajouter ou retirer des membres, gérer les rôles." />

      {isOwner && (
        <Card title="Ajouter un membre" icon={<UserPlus size={15} />}>
          <div className="wa-search-row">
            <Input
              placeholder="UID…"
              value={uidInput}
              onChange={(e) => setUidInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <Button variant="primary" icon={<UserPlus size={15} />} onClick={add}>
              Ajouter (modérateur)
            </Button>
          </div>
          {msg && <div className="wa-inline-msg">{msg}</div>}
        </Card>
      )}

      <SectionTitle
        action={
          <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={load}>
            Charger
          </Button>
        }
      >
        Membres du staff ({Object.keys(list).length})
      </SectionTitle>

      <div className="wa-item-list">
        {Object.keys(list).length === 0 && <EmptyState icon={<Shield size={26} />} title="Aucun membre" />}
        {Object.entries(list).map(([uid, s]) => (
          <div key={uid} className="wa-item">
            <Avatar src={s.profile?.avatar} name={s.profile?.pseudo} size={40} />
            <div className="wa-item-body">
              <div className="wa-item-head">
                <span className="wa-item-author">{s.profile?.pseudo || uid.slice(0, 8)}</span>
                <Chip tone={s.role === 'owner' ? 'brand' : 'neutral'}>
                  {s.role === 'owner' ? 'Propriétaire' : 'Modérateur'}
                </Chip>
                <span className="wa-item-time">Ajouté {new Date(s.addedAt).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="wa-item-reply">
                <code>{s.profile?.wouaffId || `${uid.slice(0, 12)}…`}</code>
              </div>
            </div>
            {isOwner && (
              <div className="wa-item-actions wa-item-actions-row">
                {s.role === 'moderator' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Shield size={12} />}
                    onClick={() => setRole(uid, 'owner')}
                  >
                    Promouvoir
                  </Button>
                )}
                {s.role === 'owner' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<UserMinus size={12} />}
                    onClick={() => setRole(uid, 'moderator')}
                  >
                    Rétrograder
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  icon={<UserMinus size={12} />}
                  onClick={() => remove(uid, s.profile?.pseudo)}
                >
                  Retirer
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
