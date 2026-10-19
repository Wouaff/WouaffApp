import { useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { CurrentUser } from '../services/auth';
import { inputClass, outlineBtn, primaryBtn } from './formStyles';

/* Changement de pseudo / d'adresse e-mail : le mot de passe (et le code 2FA s'il est actif) est exigé. */

interface Props {
  user: CurrentUser;
  refresh: () => Promise<unknown>;
}

function Feedback({ ok, error }: { ok: string; error: string }) {
  if (error)
    return (
      <p role="alert" className="text-sm text-[var(--danger)]">
        {error}
      </p>
    );
  return ok ? (
    <p role="status" className="text-sm text-[var(--repost-color)]">
      {ok}
    </p>
  ) : null;
}

function useIdentityForm(user: CurrentUser, path: string, build: (value: string) => Record<string, unknown>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setOpen(false);
    setValue('');
    setPassword('');
    setCode('');
  };

  const submit = async <T,>(e: React.FormEvent, onDone: (r: T) => Promise<string>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const r = await api.post<T>(path, { ...build(value), password, code: user.totpEnabled ? code : undefined });
      setOk(await onDone(r));
      reset();
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  };

  return { open, setOpen, value, setValue, password, setPassword, code, setCode, busy, ok, error, reset, submit };
}

function SecondFactorFields({
  user,
  password,
  setPassword,
  code,
  setCode,
  idPrefix,
}: {
  user: CurrentUser;
  password: string;
  setPassword: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
  idPrefix: string;
}) {
  return (
    <>
      <input
        id={`${idPrefix}-pass`}
        type="password"
        aria-label="Mot de passe actuel"
        placeholder="Mot de passe actuel"
        className={inputClass}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      {user.totpEnabled && (
        <input
          id={`${idPrefix}-code`}
          type="text"
          aria-label="Code de double authentification ou code de secours"
          placeholder="Code 2FA ou code de secours"
          className={inputClass}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 11))}
          autoComplete="one-time-code"
          required
        />
      )}
    </>
  );
}

export function PseudoForm({ user, refresh }: Props) {
  const f = useIdentityForm(user, '/auth/pseudo', (pseudo) => ({ pseudo }));
  return (
    <div className="px-4 py-3 border-b border-[var(--border-color)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-[var(--text-secondary)]">PSEUDO</div>
          <div className="font-bold text-[var(--text-primary)] mt-1">@{user.pseudo}</div>
        </div>
        {!f.open && (
          <button type="button" className={outlineBtn} onClick={() => f.setOpen(true)}>
            Modifier
          </button>
        )}
      </div>
      {f.open ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) =>
            f.submit<{ pseudo: string }>(e, async (r) => {
              await refresh();
              return `Ton pseudo est maintenant @${r.pseudo}.`;
            })
          }
        >
          <input
            type="text"
            aria-label="Nouveau pseudo"
            placeholder="nouveau_pseudo"
            className={inputClass}
            value={f.value}
            onChange={(e) => f.setValue(e.target.value)}
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            title="Lettres, chiffres et underscores uniquement"
            autoComplete="username"
            required
          />
          <SecondFactorFields
            user={user}
            password={f.password}
            setPassword={f.setPassword}
            code={f.code}
            setCode={f.setCode}
            idPrefix="pseudo"
          />
          <p className="text-xs text-[var(--text-secondary)]">
            Le lien de ton profil changera. Tu ne pourras pas modifier ton pseudo à nouveau pendant 30 jours.
          </p>
          <Feedback ok={f.ok} error={f.error} />
          <div className="flex gap-2">
            <button type="submit" disabled={f.busy} className={primaryBtn}>
              {f.busy ? '…' : 'Changer de pseudo'}
            </button>
            <button type="button" className={outlineBtn} onClick={f.reset}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2">
          <Feedback ok={f.ok} error="" />
        </div>
      )}
    </div>
  );
}

export function EmailForm({ user, refresh }: Props) {
  const f = useIdentityForm(user, '/auth/email', (newEmail) => ({ newEmail }));
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-[var(--text-secondary)]">E-MAIL</div>
          <div className="font-bold text-[var(--text-primary)] mt-1 break-all">{user.email}</div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {user.emailVerified
              ? 'Adresse confirmée.'
              : user.mailEnabled
                ? 'Adresse non confirmée : vérifie ta boîte mail.'
                : 'Adresse non confirmée.'}
          </p>
        </div>
        {!f.open && (
          <button type="button" className={outlineBtn} onClick={() => f.setOpen(true)}>
            Modifier
          </button>
        )}
      </div>
      {f.open ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) =>
            f.submit<{ pending: boolean; email: string }>(e, async (r) => {
              await refresh();
              return r.pending
                ? `Un lien de confirmation a été envoyé à ${r.email}. Ton adresse actuelle reste valable jusqu'à la confirmation.`
                : `Ton adresse e-mail est maintenant ${r.email}.`;
            })
          }
        >
          <input
            type="email"
            aria-label="Nouvelle adresse e-mail"
            placeholder="nouvelle@exemple.fr"
            className={inputClass}
            value={f.value}
            onChange={(e) => f.setValue(e.target.value)}
            autoComplete="email"
            required
          />
          <SecondFactorFields
            user={user}
            password={f.password}
            setPassword={f.setPassword}
            code={f.code}
            setCode={f.setCode}
            idPrefix="email"
          />
          <Feedback ok={f.ok} error={f.error} />
          <div className="flex gap-2">
            <button type="submit" disabled={f.busy} className={primaryBtn}>
              {f.busy ? '…' : "Changer d'adresse"}
            </button>
            <button type="button" className={outlineBtn} onClick={f.reset}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2">
          <Feedback ok={f.ok} error="" />
        </div>
      )}
    </div>
  );
}
