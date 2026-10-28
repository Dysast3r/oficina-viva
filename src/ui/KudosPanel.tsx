import { useMemo, useState } from 'react';
import { KUDOS_COINS, KUDOS_PER_DAY } from '../data/catalog';
import { giveKudos, kudosLeft, useGame } from '../data/store';
import type { Employee } from '../data/types';
import { AvatarImg, Panel, report } from './common';
import { L } from '../i18n';

const QUICK = L(
  ['¡Gracias por la ayuda!', 'Gran trabajo en equipo', 'Excelente atención al cliente', 'Siempre con buena onda'],
  ['Thanks for the help!', 'Great teamwork', 'Excellent customer service', 'Always bringing good vibes'],
);

export function KudosPanel({ me, onClose, preselect }: { me: Employee; onClose: () => void; preselect?: string }) {
  const employees = useGame((s) => s.employees);
  const others = useMemo(() => Object.values(employees).filter((e) => e.id !== me.id), [employees, me.id]);
  const [target, setTarget] = useState(preselect && preselect !== me.id ? preselect : others[0]?.id ?? '');
  const [msg, setMsg] = useState('');
  const left = kudosLeft(me);

  return (
    <Panel title={L('Reconocer a un compañero', 'Recognize a coworker')} onClose={onClose}>
      <p className="hint">
        {L('Tienes', 'You have')} <b>{left}</b>{' '}
        {L(
          `de ${KUDOS_PER_DAY} reconocimientos hoy. Cada uno le da ${KUDOS_COINS} monedas a tu compañero y 1 a ti.`,
          `of ${KUDOS_PER_DAY} recognitions left today. Each one gives your coworker ${KUDOS_COINS} coins and you 1.`,
        )}
      </p>
      <div className="who-grid">
        {others.map((e) => (
          <button key={e.id} className={`who ${target === e.id ? 'who-on' : ''}`} onClick={() => setTarget(e.id)} title={e.title}>
            <AvatarImg avatar={e.avatar} size={1.5} />
            <span>{e.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>
      <div className="chips">
        {QUICK.map((q) => (
          <button key={q} className="chip" onClick={() => setMsg(q)}>
            {q}
          </button>
        ))}
      </div>
      <input className="input" maxLength={90} placeholder={L('Escribe un mensaje', 'Write a message')} value={msg} onChange={(ev) => setMsg(ev.target.value)} />
      <button
        className="btn btn-primary btn-block"
        disabled={left === 0 || !target}
        onClick={() => {
          if (report(giveKudos(target, msg))) setMsg('');
        }}
      >
        💖 {L('Enviar reconocimiento', 'Send recognition')}
      </button>
    </Panel>
  );
}
