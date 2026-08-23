import { AlertTriangle, Save, ShieldAlert, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { admin as adminApi } from '../../../services/api';
import { Button, Card, PageHeader, Textarea, useToast } from '../ui';

export function SettingsTab({ isOwner }: { isOwner: boolean }) {
  const toast = useToast();

  /* ── Maintenance ── */
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  const loadMaintenance = useCallback(() => {
    adminApi.maintenance
      .get()
      .then((m) => {
        setMaintenanceOn(m.enabled);
        setMaintenanceMsg(m.message ?? '');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMaintenance();
  }, [loadMaintenance]);

  const toggleMaintenance = async (apply?: boolean) => {
    setMaintenanceBusy(true);
    try {
      const next = apply ? true : !maintenanceOn;
      await adminApi.maintenance.set(next, maintenanceMsg || undefined);
      setMaintenanceOn(next);
      toast(next ? 'Mode maintenance activé' : 'Mode maintenance désactivé', 'success');
    } catch {
      toast("Erreur lors du changement d'état", 'error');
    }
    setMaintenanceBusy(false);
  };

  /* ── Purge comptes non vérifiés ── */
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const purgeUnverified = async () => {
    if (!confirmPurge) {
      setConfirmPurge(true);
      return;
    }
    setPurgeBusy(true);
    try {
      const res = await adminApi.purgeUnverified();
      toast(`${res.deleted} comptes non vérifiés supprimés`, 'success');
      setConfirmPurge(false);
    } catch {
      toast('Erreur lors de la purge', 'error');
    }
    setPurgeBusy(false);
  };

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration générale de la plateforme" />

      {maintenanceOn && (
        <div className="wa-alert wa-alert-danger">
          <ShieldAlert size={18} />
          <div className="wa-alert-body">
            <strong>Maintenance active</strong>
            <span>{maintenanceMsg || 'Aucun message affiché aux utilisateurs.'}</span>
          </div>
        </div>
      )}

      <Card title="Maintenance" icon={<ShieldAlert size={15} />}>
        <p className="wa-muted" style={{ marginBottom: 12 }}>
          Bloque l'accès aux utilisateurs non-staff. Seuls les administrateurs peuvent se connecter.
        </p>
        <div className="wa-inline-actions">
          <Button
            variant={maintenanceOn ? 'danger' : 'secondary'}
            size="sm"
            icon={<ShieldAlert size={14} />}
            onClick={() => toggleMaintenance()}
            loading={maintenanceBusy}
          >
            {maintenanceOn ? 'Désactiver maintenance' : 'Activer maintenance'}
          </Button>
        </div>
        {maintenanceOn && (
          <div style={{ marginTop: 12 }}>
            <Textarea
              rows={2}
              value={maintenanceMsg}
              onChange={(e) => setMaintenanceMsg(e.target.value)}
              placeholder="Message optionnel affiché aux utilisateurs…"
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Save size={14} />}
              onClick={() => toggleMaintenance(true)}
              loading={maintenanceBusy}
              style={{ marginTop: 8 }}
            >
              Appliquer le message
            </Button>
          </div>
        )}
      </Card>

      {isOwner && (
        <Card title="Comptes" icon={<Trash2 size={15} />}>
          <p className="wa-muted" style={{ marginBottom: 12 }}>
            Supprimer tous les comptes dont l'email n'a pas été vérifié. Cette action est irréversible.
          </p>
          <Button
            variant={confirmPurge ? 'danger' : 'secondary'}
            size="sm"
            icon={confirmPurge ? <AlertTriangle size={14} /> : <Trash2 size={14} />}
            onClick={purgeUnverified}
            loading={purgeBusy}
          >
            {confirmPurge ? 'Confirmer la purge' : 'Purger les comptes non vérifiés'}
          </Button>
          {confirmPurge && (
            <Button variant="secondary" size="sm" onClick={() => setConfirmPurge(false)} style={{ marginLeft: 8 }}>
              Annuler
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
