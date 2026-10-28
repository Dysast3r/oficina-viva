import { useState, type FormEvent } from 'react';
import { changePassword, login, logout, useSession } from '../data/store';

const MIN_PASSWORD = 8;

/** Ingreso con usuario y contraseña; si la contraseña es temporal, pide cambiarla antes de entrar. */
export function LoginScreen() {
  const { status, user } = useSession();

  return (
    <div className="login">
      <div className="login-card login-card-narrow">
        <h1 className="logo">
          OFICINA <span>VIVA</span>
        </h1>
        <p className="login-sub">Tu desempeño se convierte en monedas. Tus monedas, en tu oficina soñada.</p>
        {status === 'loading' && <p className="hint">Conectando…</p>}
        {status === 'in' && <p className="hint">Cargando tu oficina…</p>}
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
        Usuario
      </label>
      <input
        id="login-user"
        className="input"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="nombre.apellido"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoFocus
      />
      <label className="field-label" htmlFor="login-pass">
        Contraseña
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
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="hint">¿Olvidaste tu contraseña? Pídele a administración que la restablezca.</p>
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
    if (next.length < MIN_PASSWORD) return setError(`Usa al menos ${MIN_PASSWORD} caracteres.`);
    if (next !== repeat) return setError('Las contraseñas nuevas no coinciden.');
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
          Hola, <b>{username}</b>. Crea tu contraseña para entrar.
        </p>
      )}
      <label className="field-label" htmlFor="pw-current">
        {forced ? 'Contraseña temporal' : 'Contraseña actual'}
      </label>
      <input id="pw-current" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <label className="field-label" htmlFor="pw-next">
        Nueva contraseña
      </label>
      <input id="pw-next" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      <label className="field-label" htmlFor="pw-repeat">
        Repite la nueva contraseña
      </label>
      <input id="pw-repeat" className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy || !current || !next || !repeat}>
        {busy ? 'Guardando…' : forced ? 'Guardar y entrar' : 'Cambiar contraseña'}
      </button>
      {forced && (
        <button type="button" className="btn btn-block" onClick={logout}>
          Volver
        </button>
      )}
    </form>
  );
}
