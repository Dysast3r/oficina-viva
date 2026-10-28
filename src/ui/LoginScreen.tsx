import { useState, type FormEvent } from 'react';
import { changePassword, login, logout, useSession } from '../data/store';
import { L } from '../i18n';
import { LangSwitch } from './common';

const MIN_PASSWORD = 8;

/** Ingreso con usuario y contraseña; si la contraseña es temporal, pide cambiarla antes de entrar. */
export function LoginScreen() {
  const { status, user } = useSession();

  return (
    <div className="login">
      <div className="login-card login-card-narrow">
        <LangSwitch className="login-lang" />
        <h1 className="logo">
          OFICINA <span>VIVA</span>
        </h1>
        <p className="login-sub">{L('Tu desempeño se convierte en monedas. Tus monedas, en tu oficina soñada.', 'Your performance turns into coins. Your coins, into your dream office.')}</p>
        {status === 'loading' && <p className="hint">{L('Conectando…', 'Connecting…')}</p>}
        {status === 'in' && <p className="hint">{L('Cargando tu oficina…', 'Loading your office…')}</p>}
        {status === 'out' && <LoginForm />}
        {status === 'mustChange' && user && <NewPasswordForm username={user.username} />}
      </div>
    </div>
  );
}

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await login(username, password);
    setBusy(false);
    if (!r.ok) setError(r.message);
  };

  return (
    <form className="login-form" onSubmit={submit}>
      <label className="field-label" htmlFor="login-user">
        {L('Usuario', 'Username')}
      </label>
      <input
        id="login-user"
        className="input"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={L('nombre.apellido', 'first.last')}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoFocus
      />
      <label className="field-label" htmlFor="login-pass">
        {L('Contraseña', 'Password')}
      </label>
      <input
        id="login-pass"
        className="input"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy || !username.trim() || !password}>
        {busy ? L('Entrando…', 'Logging in…') : L('Entrar', 'Log in')}
      </button>
      <p className="hint">{L('¿Olvidaste tu contraseña? Pídele a administración que la restablezca.', 'Forgot your password? Ask an admin to reset it.')}</p>
    </form>
  );
}

export function NewPasswordForm({ username, onDone }: { username: string; onDone?: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const forced = onDone === undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < MIN_PASSWORD) return setError(L(`Usa al menos ${MIN_PASSWORD} caracteres.`, `Use at least ${MIN_PASSWORD} characters.`));
    if (next !== repeat) return setError(L('Las contraseñas nuevas no coinciden.', "The new passwords don't match."));
    setBusy(true);
    setError('');
    const r = await changePassword(current, next);
    setBusy(false);
    if (!r.ok) setError(r.message);
    else onDone?.();
  };

  return (
    <form className="login-form" onSubmit={submit}>
      {forced && (
        <p className="login-q">
          {L('Hola, ', 'Hi, ')}
          <b>{username}</b>
          {L('. Crea tu contraseña para entrar.', '. Create your password to log in.')}
        </p>
      )}
      <label className="field-label" htmlFor="pw-current">
        {forced ? L('Contraseña temporal', 'Temporary password') : L('Contraseña actual', 'Current password')}
      </label>
      <input id="pw-current" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <label className="field-label" htmlFor="pw-next">
        {L('Nueva contraseña', 'New password')}
      </label>
      <input id="pw-next" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      <label className="field-label" htmlFor="pw-repeat">
        {L('Repite la nueva contraseña', 'Repeat the new password')}
      </label>
      <input id="pw-repeat" className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy || !current || !next || !repeat}>
        {busy ? L('Guardando…', 'Saving…') : forced ? L('Guardar y entrar', 'Save and log in') : L('Cambiar contraseña', 'Change password')}
      </button>
      {forced && (
        <button type="button" className="btn btn-block" onClick={logout}>
          {L('Volver', 'Back')}
        </button>
      )}
    </form>
  );
}
