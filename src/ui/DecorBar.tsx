import { useEffect, useState } from 'react';
import { bridge } from '../bridge';
import { FLOOR_BY_ID, ITEM_BY_ID } from '../data/catalog';
import { officeScore, setFloor } from '../data/store';
import type { Employee } from '../data/types';
import { floorIconURL, itemIconURL } from '../game/pixel/textures';
import { report } from './common';
import { L } from '../i18n';

/** Barra inferior del modo decoración: bodega, pisos y acciones. */
export function DecorBar({ me, onShop, onDone }: { me: Employee; onShop: () => void; onDone: () => void }) {
  const [hint, setHint] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [holding, setHolding] = useState<string | null>(null);

  useEffect(() => {
    const offs = [
      bridge.on('decor:hint', setHint),
      bridge.on('decor:holding', (uid) => {
        setHolding(uid);
        if (uid !== null) setPicked(null);
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  // Si se acabó el stock del objeto elegido, se deselecciona.
  useEffect(() => {
    if (picked !== null && (me.inventory[picked] ?? 0) === 0) setPicked(null);
  }, [me.inventory, picked]);

  const stock = Object.entries(me.inventory).filter(([, n]) => n > 0);

  return (
    <div className="decorbar">
      <div className="decor-top">
        <span className="decor-title">
          {L(`🛠️ Decorando la oficina · ✨ ${officeScore(me)} de estilo`, `🛠️ Decorating the office · ✨ ${officeScore(me)} style`)}
        </span>
        <span className="decor-hint">{hint}</span>
        <span className="decor-actions">
          <button className="btn btn-small" onClick={() => bridge.emit('decor:rotate')} disabled={picked === null && holding === null}>
            {L('⟲ Girar (R)', '⟲ Rotate (R)')}
          </button>
          <button className="btn btn-small" onClick={() => bridge.emit('decor:store-held')} disabled={holding === null}>
            {L('📦 A bodega', '📦 To storage')}
          </button>
          <button className="btn btn-small" onClick={onShop}>
            {L('🛒 Tienda', '🛒 Shop')}
          </button>
          <button className="btn btn-small btn-primary" onClick={onDone}>
            {L('✔ Listo', '✔ Done')}
          </button>
        </span>
      </div>
      <div className="decor-shelf">
        <span className="shelf-label">{L('Bodega', 'Storage')}</span>
        {stock.length === 0 && <span className="hint">{L('Vacía. Compra cosas en la tienda con tus monedas.', 'Empty. Buy things in the shop with your coins.')}</span>}
        {stock.map(([id, n]) => (
          <button
            key={id}
            className={`slot ${picked === id ? 'slot-on' : ''}`}
            title={ITEM_BY_ID[id]?.name}
            onClick={() => {
              const next = picked === id ? null : id;
              setPicked(next);
              bridge.emit('decor:pick', next);
            }}
          >
            <img className="pixel" src={itemIconURL(id)} alt={ITEM_BY_ID[id]?.name} />
            <span className="slot-n">×{n}</span>
          </button>
        ))}
        <span className="shelf-label">{L('Piso', 'Floor')}</span>
        <button className={`slot ${me.floor === 'sala' ? 'slot-on' : ''}`} title={L('Piso del área', 'Area floor')} onClick={() => report(setFloor('sala'))}>
          <span className="slot-text">{L('Área', 'Area')}</span>
        </button>
        {me.ownedFloors.map((f) => (
          <button
            key={f}
            className={`slot ${me.floor === f ? 'slot-on' : ''}`}
            title={FLOOR_BY_ID[f]?.name}
            onClick={() => report(setFloor(f))}
          >
            <img className="pixel" src={floorIconURL(FLOOR_BY_ID[f])} alt={FLOOR_BY_ID[f]?.name} />
          </button>
        ))}
      </div>
    </div>
  );
}
