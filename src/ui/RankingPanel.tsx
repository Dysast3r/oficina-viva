import { useMemo, useState } from 'react';
import { bridge } from '../bridge';
import { levelForXp } from '../data/catalog';
import { usePresence } from '../data/social';
import { officeScore, useGame } from '../data/store';
import { AvatarImg, Coin, DeptTag, Panel } from './common';
import { L } from '../i18n';

type Mode = 'desempeno' | 'oficina';

export function RankingPanel({ onClose, onOpen, onKudos }: { onClose: () => void; onOpen: (id: string) => void; onKudos: () => void }) {
  const employees = useGame((s) => s.employees);
  const me = useGame((s) => s.currentUserId);
  const online = usePresence();
  const [mode, setMode] = useState<Mode>('desempeno');

  const rows = useMemo(() => {
    const list = Object.values(employees);
    return mode === 'desempeno'
      ? list.sort((a, b) => b.xp - a.xp).map((e) => ({ e, value: e.xp }))
      : list.sort((a, b) => officeScore(b) - officeScore(a)).map((e) => ({ e, value: officeScore(e) }));
  }, [employees, mode]);

  const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;

  return (
    <Panel title={L('Equipo', 'Team')} onClose={onClose}>
      <button className="btn btn-primary btn-block" onClick={onKudos}>
        💖 {L('Reconocer a un compañero', 'Recognize a coworker')}
      </button>
      <p className="hint">
        {online.length}{' '}
        {online.length === 1 ? L('persona conectada ahora.', 'person online now.') : L('personas conectadas ahora.', 'people online now.')}
      </p>
      <div className="tabs">
        <button className={`tab ${mode === 'desempeno' ? 'tab-on' : ''}`} onClick={() => setMode('desempeno')}>
          🏆 {L('Desempeño', 'Performance')}
        </button>
        <button className={`tab ${mode === 'oficina' ? 'tab-on' : ''}`} onClick={() => setMode('oficina')}>
          ✨ {L('Mejor puesto', 'Best desk')}
        </button>
      </div>
      <p className="hint">
        {mode === 'desempeno'
          ? L('Monedas ganadas en total (lo gastado en decoración no resta).', "Total coins earned (spending on decor doesn't count against it).")
          : L('Puntos de estilo de lo que cada uno tiene en su puesto.', 'Style points from what each person has at their desk.')}
      </p>
      <ol className="ranking">
        {rows.map(({ e, value }, i) => (
          <li key={e.id} className={`rank-row ${e.id === me ? 'rank-me' : ''}`}>
            <span className="rank-pos">{medal(i)}</span>
            <button
              className="rank-who"
              onClick={() => {
                bridge.emit('camera:focus', e.id);
                onOpen(e.id);
              }}
            >
              <span className="contact-face">
                <AvatarImg avatar={e.avatar} size={1.5} />
                <i className={`presence ${online.includes(e.id) ? 'presence-on' : ''}`} />
              </span>
              <span>
                <b>{e.name}</b>
                <small>
                  <DeptTag e={e} /> {L('Nv', 'Lv')} {levelForXp(e.xp)}
                </small>
              </span>
            </button>
            <span className="rank-val">
              {mode === 'desempeno' ? <Coin size={1.5} /> : '✨'} {value}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
