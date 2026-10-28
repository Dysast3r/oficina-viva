import { useState } from 'react';
import { bridge } from '../bridge';
import { ROOMS } from '../data/catalog';
import { EXPANSIONS } from '../data/layout';
import { contribute, officeFund, useGame } from '../data/store';
import type { Employee } from '../data/types';
import { AvatarImg, Coin, Panel, Progress, report } from './common';

const QUICK = [10, 50, 100, 250, 500];

/** Fondo común: todos aportan y, al llegar a la meta, se construye una zona nueva para el equipo. */
export function FundPanel({ me, onClose }: { me: Employee; onClose: () => void }) {
  const fund = useGame((s) => officeFund(s));
  const employees = useGame((s) => s.employees);
  const [amount, setAmount] = useState(50);
  const next = EXPANSIONS[fund.level];
  const prevCost = fund.level === 0 ? 0 : EXPANSIONS[fund.level - 1].cost;
  const top = Object.entries(fund.contributors)
    .filter(([id]) => employees[id] !== undefined)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <Panel title="Ampliar la oficina" onClose={onClose}>
      {next ? (
        <div className="fund-hero">
          <span className="fund-badge" style={{ background: ROOMS[next.room.id].color }}>
            Próxima zona
          </span>
          <h3>{ROOMS[next.room.id].name}</h3>
          <p>{next.desc}</p>
          <Progress value={fund.total - prevCost} max={next.cost - prevCost} tone="gold" />
          <p className="fund-numbers">
            <Coin /> <b>{fund.total.toLocaleString('es-CL')}</b> de {next.cost.toLocaleString('es-CL')} · faltan{' '}
            <b>{(next.cost - fund.total).toLocaleString('es-CL')}</b>
          </p>
          <button className="btn btn-small" onClick={() => bridge.emit('camera:room', next.room.id)}>
            👀 Ver la obra
          </button>
        </div>
      ) : (
        <div className="fund-hero">
          <h3>¡Oficina completa! 🎉</h3>
          <p>El equipo construyó todas las ampliaciones. Gracias a cada aporte.</p>
        </div>
      )}

      {next && (
        <div className="form-card">
          <h4 className="section">Tu aporte</h4>
          <p className="hint">Las monedas que aportas son para todos: cuando el fondo llega a la meta, la zona nueva aparece en el mapa.</p>
          <div className="chips">
            {QUICK.map((q) => (
              <button key={q} className={`chip ${amount === q ? 'chip-on' : ''}`} disabled={me.coins < q} onClick={() => setAmount(q)}>
                {q}
              </button>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              className="input"
              type="number"
              min={10}
              max={me.coins}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              aria-label="Monto a aportar"
            />
            <button className="btn btn-gold" disabled={amount < 10 || amount > me.coins} onClick={() => report(contribute(amount))}>
              🏗️ Aportar
            </button>
          </div>
          <p className="hint">Tienes {me.coins.toLocaleString('es-CL')} monedas.</p>
        </div>
      )}

      <h4 className="section">Zonas</h4>
      <ul className="expansion-list">
        {EXPANSIONS.map((x, i) => {
          const status = i < fund.level ? 'built' : i === fund.level ? 'building' : 'locked';
          return (
            <li key={x.room.id} className={`exp-${status}`}>
              <span className="exp-dot" style={{ background: ROOMS[x.room.id].color }} />
              <span>
                <b>{ROOMS[x.room.id].name}</b>
                <small>{x.desc}</small>
              </span>
              <span className="exp-state">{status === 'built' ? '✅ Construida' : status === 'building' ? '🚧 En obra' : `🔒 ${x.cost.toLocaleString('es-CL')}`}</span>
              {status === 'built' && (
                <button className="btn btn-small" onClick={() => bridge.emit('camera:room', x.room.id)}>
                  Ir
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {top.length > 0 && (
        <>
          <h4 className="section">Quienes más han aportado</h4>
          <ol className="contrib-list">
            {top.map(([id, value], i) => (
              <li key={id}>
                <span className="contrib-pos">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
                <span className="chat-face">
                  <AvatarImg avatar={employees[id].avatar} size={1.4} />
                </span>
                <b>{employees[id].name}</b>
                <span className="coins">
                  <Coin /> {value.toLocaleString('es-CL')}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}
