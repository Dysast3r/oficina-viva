import { useCallback, useEffect, useState } from 'react';
import { DEPTS, ROOMS } from '../data/catalog';
import { plotCount } from '../data/layout';
import {
  addEmployee,
  editEmployee,
  freePlot,
  listAccounts,
  logout,
  removeEmployee,
  resetPassword,
  useGame,
  type AccountInfo,
  type Credentials,
} from '../data/store';
import type { DeptId, Employee, Role } from '../data/types';
import { AvatarImg, Panel, report } from './common';
import { L } from '../i18n';

const ROLE_LABEL: Record<Role, string> = L(
  { colaborador: 'Colaborador/a', jefatura: 'Jefatura', gerente: 'Gerencia', admin: 'Administración' },
  { colaborador: 'Team member', jefatura: 'Team lead', gerente: 'Management', admin: 'Admin' },
);

function RoleSelect({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as Role)}>
      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

/** Usuario y contraseña temporal recién creados: se muestran una sola vez para entregarlos. */
function CredentialsCard({ who, creds, onClose }: { who: string; creds: Credentials; onClose: () => void }) {
  return (
    <div className="credentials" role="status">
      <p>
        {L('Entrégale estos datos a ', 'Give these details to ')}
        <b>{who}</b>
        {L('. Al entrar se le pedirá crear su propia contraseña.', ". They'll be asked to create their own password when they log in.")}
      </p>
      <p>
        {L('Usuario', 'Username')}: <code>{creds.username}</code>
        <br />
        {L('Contraseña temporal', 'Temporary password')}: <code>{creds.password}</code>
      </p>
      <p className="hint">{L('No se vuelve a mostrar: si se pierde, restablécela de nuevo.', "It won't be shown again: if it's lost, reset it again.")}</p>
      <button className="btn btn-small" onClick={onClose}>
        {L('Listo, ya la anoté', "Done, I've written it down")}
      </button>
    </div>
  );
}

function EditRow({ e, username, onDone }: { e: Employee; username: string; onDone: () => void }) {
  const [name, setName] = useState(e.name);
  const [title, setTitle] = useState(e.title);
  const [role, setRole] = useState<Role>(e.role);
  const [user, setUser] = useState(username);
  const [busy, setBusy] = useState(false);

  return (
    <div className="admin-edit">
      <input className="input" aria-label={L('Nombre', 'Name')} value={name} onChange={(ev) => setName(ev.target.value)} />
      <input className="input" aria-label={L('Cargo', 'Job title')} value={title} onChange={(ev) => setTitle(ev.target.value)} />
      <div className="row-fields">
        <input className="input" aria-label={L('Usuario', 'Username')} value={user} onChange={(ev) => setUser(ev.target.value)} />
        <RoleSelect value={role} onChange={setRole} />
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = report(await editEmployee(e.id, { name, title, role, username: user }));
            setBusy(false);
            if (ok) onDone();
          }}
        >
          {L('Guardar', 'Save')}
        </button>
      </div>
    </div>
  );
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const employees = useGame((s) => s.employees);
  const meId = useGame((s) => s.currentUserId);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [dept, setDept] = useState<DeptId>('ventas');
  const [role, setRole] = useState<Role>('colaborador');
  const [body, setBody] = useState<0 | 1>(1);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ who: string; creds: Credentials } | null>(null);

  const refresh = useCallback(() => void listAccounts().then(setAccounts), []);
  useEffect(refresh, [refresh]);

  const list = Object.values(employees);
  const accountOf = (id: string) => accounts.find((a) => a.employeeId === id);

  const add = async () => {
    setBusy(true);
    const r = await addEmployee(name, title, dept, role, body, username || undefined);
    setBusy(false);
    if (!report(r)) return;
    setIssued({ who: name.trim(), creds: r });
    setName('');
    setTitle('');
    setUsername('');
    refresh();
  };

  return (
    <Panel title={L('Administración', 'Admin')} onClose={onClose}>
      {issued && <CredentialsCard who={issued.who} creds={issued.creds} onClose={() => setIssued(null)} />}

      <h4 className="section">{L('Puestos por área', 'Desks by area')}</h4>
      <ul className="plain">
        {DEPTS.map((d) => {
          const used = list.filter((e) => e.dept === d).length;
          return (
            <li key={d}>
              <span className="dept-tag" style={{ background: ROOMS[d].color }}>
                {ROOMS[d].name}
              </span>{' '}
              {L(`${used} de ${plotCount(d)} puestos ocupados`, `${used} of ${plotCount(d)} desks taken`)}
            </li>
          );
        })}
      </ul>

      <h4 className="section">{L('Agregar colaborador', 'Add team member')}</h4>
      <input className="input" placeholder={L('Nombre y apellido', 'First and last name')} value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" placeholder={L('Cargo', 'Job title')} value={title} onChange={(e) => setTitle(e.target.value)} />
      <input
        className="input"
        placeholder={L('Usuario (opcional: nombre.apellido)', 'Username (optional: first.last)')}
        autoCapitalize="none"
        spellCheck={false}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <div className="row-fields">
        <select className="input" value={dept} onChange={(e) => setDept(e.target.value as DeptId)}>
          {DEPTS.map((d) => (
            <option key={d} value={d} disabled={freePlot(d) === null}>
              {ROOMS[d].name}
              {freePlot(d) === null ? L(' (lleno)', ' (full)') : ''}
            </option>
          ))}
        </select>
        <RoleSelect value={role} onChange={setRole} />
        <select className="input" value={body} onChange={(e) => setBody(Number(e.target.value) as 0 | 1)}>
          <option value={1}>{L('Mujer', 'Woman')}</option>
          <option value={0}>{L('Hombre', 'Man')}</option>
        </select>
      </div>
      <button className="btn btn-primary btn-block" disabled={busy || !name.trim()} onClick={add}>
        {busy ? L('Creando…', 'Creating…') : L('Agregar y crear cuenta', 'Add and create account')}
      </button>

      <h4 className="section">{L('Equipo', 'Team')}</h4>
      <p className="hint">
        {L(
          'Para reemplazar a alguien de ejemplo, edita su nombre y usuario y restablece su contraseña.',
          'To replace a sample person, edit their name and username and reset their password.',
        )}
      </p>
      <ul className="admin-list">
        {list.map((e) => {
          const acc = accountOf(e.id);
          return (
            <li key={e.id} style={{ flexWrap: 'wrap' }}>
              <AvatarImg avatar={e.avatar} size={1.2} />
              <span>
                <b>{e.name}</b>
                <small>
                  {e.title} · {ROOMS[e.dept].name} · {ROLE_LABEL[e.role]}
                  <br />
                  {acc ? (
                    <>
                      {L('usuario', 'username')} <b style={{ display: 'inline' }}>{acc.username}</b>
                      {acc.mustChange ? L(' · contraseña temporal', ' · temporary password') : ''}
                    </>
                  ) : (
                    L('sin cuenta', 'no account')
                  )}
                </small>
              </span>
              <button className="btn-icon" aria-label={L(`Editar a ${e.name}`, `Edit ${e.name}`)} title={L('Editar', 'Edit')} onClick={() => setEditing(editing === e.id ? null : e.id)}>
                ✏️
              </button>
              <button
                className="btn-icon"
                aria-label={L(`Restablecer contraseña de ${e.name}`, `Reset ${e.name}'s password`)}
                title={L('Restablecer contraseña', 'Reset password')}
                onClick={async () => {
                  if (!window.confirm(L(`¿Crear una contraseña temporal nueva para ${e.name}? Se cerrarán sus sesiones abiertas.`, `Create a new temporary password for ${e.name}? Their open sessions will be closed.`))) return;
                  const r = await resetPassword(e.id);
                  if (report(r)) {
                    setIssued({ who: e.name, creds: r });
                    refresh();
                  }
                }}
              >
                🔑
              </button>
              {e.id !== meId && (
                <button
                  className="btn-icon"
                  aria-label={L(`Eliminar a ${e.name}`, `Remove ${e.name}`)}
                  title={L('Eliminar', 'Remove')}
                  onClick={async () => {
                    if (window.confirm(L(`¿Eliminar a ${e.name}? Se pierden su puesto, sus monedas y su cuenta.`, `Remove ${e.name}? Their desk, coins and account will be lost.`))) {
                      if (report(await removeEmployee(e.id))) refresh();
                    }
                  }}
                >
                  🗑
                </button>
              )}
              {editing === e.id && acc && (
                <div style={{ flexBasis: '100%' }}>
                  <EditRow
                    e={e}
                    username={acc.username}
                    onDone={() => {
                      setEditing(null);
                      refresh();
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button className="btn btn-block" onClick={logout}>
        {L('Cerrar sesión', 'Log out')}
      </button>
    </Panel>
  );
}
