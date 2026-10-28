import { useMemo, useState } from 'react';
import { AWARDS } from '../data/catalog';
import { award, canAward, useGame } from '../data/store';
import type { Employee } from '../data/types';
import { AvatarImg, Coin, Panel, report } from './common';

/** Registro de desempeño: solo jefatura (su área) y administración (todos). */
export function AwardPanel({ me, onClose, preselect }: { me: Employee; onClose: () => void; preselect?: string }) {
  const employees = useGame((s) => s.employees);
  const team = useMemo(() => Object.values(employees).filter((e) => canAward(me, e)), [employees, me]);
  const [target, setTarget] = useState(preselect && team.some((t) => t.id === preselect) ? preselect : team[0]?.id ?? '');
  const [awardId, setAwardId] = useState(AWARDS[0].id);
  const [custom, setCustom] = useState(25);
  const [note, setNote] = useState('');

  if (team.length === 0) {
    return (
      <Panel title="Registrar desempeño" onClose={onClose}>
        <p className="hint">No tienes personas a cargo para registrar desempeño.</p>
      </Panel>
    );
  }

  const submit = () => {
    if (report(award(target, awardId, note, awardId === 'custom' ? custom : undefined))) setNote('');
  };

  return (
    <Panel title="Registrar desempeño" onClose={onClose}>
      <p className="hint">Cada logro registrado le da monedas a la persona, que las usa para mejorar su puesto.</p>
      <label className="field-label">¿Quién?</label>
      <div className="who-grid">
        {team.map((e) => (
          <button key={e.id} className={`who ${target === e.id ? 'who-on' : ''}`} onClick={() => setTarget(e.id)} title={e.title}>
            <AvatarImg avatar={e.avatar} size={1.5} />
            <span>{e.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      <label className="field-label">¿Qué logró?</label>
      <div className="award-list">
        {AWARDS.map((a) => (
          <button key={a.id} className={`award ${awardId === a.id ? 'award-on' : ''}`} onClick={() => setAwardId(a.id)}>
            <span className="award-icon">{a.icon}</span>
            <span className="award-label">{a.label}</span>
            <span className="award-coins">
              <Coin size={1.5} /> {a.coins}
            </span>
          </button>
        ))}
        <button className={`award ${awardId === 'custom' ? 'award-on' : ''}`} onClick={() => setAwardId('custom')}>
          <span className="award-icon">⭐</span>
          <span className="award-label">Reconocimiento especial</span>
          {awardId === 'custom' ? (
            <input
              className="input input-num"
              type="number"
              min={1}
              max={500}
              value={custom}
              onClick={(ev) => ev.stopPropagation()}
              onChange={(ev) => setCustom(Number(ev.target.value))}
            />
          ) : (
            <span className="award-coins">a elección</span>
          )}
        </button>
      </div>

      <label className="field-label" htmlFor="award-note">
        Comentario (aparece en la actividad)
      </label>
      <input
        id="award-note"
        className="input"
        maxLength={90}
        placeholder="Ej: cerró el contrato con cliente nuevo"
        value={note}
        onChange={(ev) => setNote(ev.target.value)}
      />
      <button className="btn btn-primary btn-block" onClick={submit}>
        Entregar monedas
      </button>
    </Panel>
  );
}
