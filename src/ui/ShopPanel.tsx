import { useState } from 'react';
import {
  CATEGORY_LABEL,
  COSMETIC_BY_ID,
  DEPTS,
  FLOORS,
  ITEM_BY_ID,
  RARITY_LABEL,
  ROOMS,
  SHOP_COSMETICS,
  SHOP_ITEMS,
  SLOT_LABEL,
  levelForXp,
  rarityOf,
  type ItemCategory,
} from '../data/catalog';
import { buyCosmetic, buyFloor, buyItem, giftItem, hasAllDecor, updateAvatar, useGame, type Result } from '../data/store';
import type { Employee } from '../data/types';
import { floorIconURL, itemIconURL } from '../game/pixel/textures';
import { AvatarImg, Coin, Panel, report } from './common';

type Tab = ItemCategory | 'pisos' | 'vestuario';
const TABS: Tab[] = ['legendario', 'premium', 'vestuario', 'muebles', 'plantas', 'tecnologia', 'deco', 'pisos'];

function tabLabel(t: Tab): string {
  if (t === 'pisos') return 'Pisos';
  if (t === 'vestuario') return '🎩 Vestuario';
  if (t === 'legendario') return '✨ Legendario';
  return CATEGORY_LABEL[t];
}

/** Rareza de un adorno según su precio (misma escala que los muebles). */
function cosmeticRarity(price: number): 'comun' | 'raro' | 'epico' | 'legendario' {
  if (price >= 800) return 'legendario';
  if (price >= 300) return 'epico';
  if (price >= 100) return 'raro';
  return 'comun';
}

/** Elegir a quién regalarle un objeto o adorno (solo administración). */
function GiftForm({ me, itemId, onClose }: { me: Employee; itemId: string; onClose: () => void }) {
  const employees = useGame((s) => s.employees);
  const others = Object.values(employees).filter((e) => e.id !== me.id);
  const [to, setTo] = useState(others[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const item = ITEM_BY_ID[itemId];
  const cosmetic = COSMETIC_BY_ID[itemId];
  const target = employees[to];

  return (
    <div className="gift-form">
      {item ? (
        <img className="pixel" src={itemIconURL(itemId)} alt="" />
      ) : (
        target && cosmetic && <AvatarImg avatar={{ ...target.avatar, [cosmetic.slot]: cosmetic.id }} size={2.2} />
      )}
      <div>
        <h4>🎁 Regalar {item?.name ?? cosmetic?.name}</h4>
        <select className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Para">
          {DEPTS.map((d) => (
            <optgroup key={d} label={ROOMS[d].name}>
              {others
                .filter((e) => e.dept === d)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <input
          className="input"
          placeholder="Mensaje (opcional): ¡Felicitaciones por el cierre!"
          maxLength={140}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="row-btns">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            disabled={!to}
            onClick={() => {
              if (report(giftItem(to, itemId, message))) onClose();
            }}
          >
            Enviar regalo
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShopPanel({ me, onClose, onDecorate }: { me: Employee; onClose: () => void; onDecorate: () => void }) {
  const [tab, setTab] = useState<Tab>('legendario');
  const [gifting, setGifting] = useState<string | null>(null);
  const [bought, setBought] = useState<string | null>(null);
  const level = levelForXp(me.xp);
  const free = hasAllDecor(me);

  /** Compra con un pequeño festejo en la tarjeta. */
  const buy = (id: string, fn: () => Result) => {
    if (!report(fn())) return;
    setBought(id);
    window.setTimeout(() => setBought((b) => (b === id ? null : b)), 1100);
  };
  const cardClass = (id: string, extra = '') => `card ${extra} ${bought === id ? 'card-bought' : ''}`;

  return (
    <Panel title="Tienda" onClose={onClose} wide>
      <div className="shop-wallet">
        {free ? (
          <span>🛡️ Administración: todo gratis y puedes regalarlo.</span>
        ) : (
          <span>
            Tienes <Coin /> <b>{me.coins.toLocaleString('es-CL')}</b> · Nivel {level}
          </span>
        )}
        <button className="btn btn-small" onClick={onDecorate}>
          🛠️ Ir a decorar
        </button>
      </div>
      {gifting && <GiftForm me={me} itemId={gifting} onClose={() => setGifting(null)} />}
      <div className="tabs tabs-scroll" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab ${tab === t ? 'tab-on' : ''} ${t === 'legendario' ? 'tab-legend' : ''}`}
            onClick={() => setTab(t)}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      {tab === 'legendario' && (
        <p className="legend-intro">Objetos únicos para los que más brillan. Tienen luces y destellos propios y suman muchísimo estilo a tu puesto.</p>
      )}
      {tab === 'vestuario' && <p className="legend-intro">Adornos para tu personaje: se ven en la oficina, en el chat y en tu perfil. Al comprarlos te los pones al tiro.</p>}

      <div className="shop-grid">
        {tab === 'vestuario' &&
          SHOP_COSMETICS.map((c) => {
            const owned = me.wardrobe?.includes(c.id) ?? false;
            const wearing = me.avatar[c.slot] === c.id;
            const locked = !free && level < c.level;
            const rarity = cosmeticRarity(c.price);
            return (
              <article key={c.id} className={cardClass(c.id, `rarity-${rarity} ${locked ? 'card-locked' : ''}`)}>
                <span className="rarity-badge">{SLOT_LABEL[c.slot]}</span>
                <div className="card-art card-art-avatar">
                  <AvatarImg avatar={{ ...me.avatar, [c.slot]: c.id }} size={2.4} />
                </div>
                <h3>{c.name}</h3>
                <p className="card-desc">{c.desc}</p>
                {owned || (free && wearing) ? (
                  <button
                    className="btn btn-small"
                    disabled={wearing}
                    onClick={() => {
                      updateAvatar({ ...me.avatar, [c.slot]: c.id });
                      setBought(c.id);
                    }}
                  >
                    {wearing ? 'Puesto' : 'Ponérmelo'}
                  </button>
                ) : free ? (
                  <div className="card-actions">
                    <button className="btn btn-small btn-buy" onClick={() => buy(c.id, () => buyCosmetic(c.id))}>
                      Obtener
                    </button>
                    <button className="btn btn-small" onClick={() => setGifting(c.id)}>
                      🎁 Regalar
                    </button>
                  </div>
                ) : locked ? (
                  <span className="lock">🔒 Nivel {c.level}</span>
                ) : (
                  <button className="btn btn-small btn-buy" disabled={me.coins < c.price} onClick={() => buy(c.id, () => buyCosmetic(c.id))}>
                    <Coin /> {c.price.toLocaleString('es-CL')}
                  </button>
                )}
              </article>
            );
          })}

        {tab === 'pisos' &&
          FLOORS.filter((f) => !f.roomOnly && f.price > 0).map((f) => {
            const owned = me.ownedFloors.includes(f.id);
            const locked = !free && level < f.level;
            return (
              <article key={f.id} className={cardClass(f.id, locked ? 'card-locked' : '')}>
                <div className="card-art">
                  <img className="pixel" src={floorIconURL(f)} width={128} height={64} alt="" />
                </div>
                <h3>{f.name}</h3>
                <p className="card-meta">✨ +{f.style} estilo</p>
                {owned ? (
                  <button className="btn btn-small" disabled={me.floor === f.id} onClick={() => report(buyFloor(f.id))}>
                    {me.floor === f.id ? 'Instalado' : 'Usar'}
                  </button>
                ) : locked ? (
                  <span className="lock">🔒 Nivel {f.level}</span>
                ) : (
                  <button className="btn btn-small btn-buy" disabled={!free && me.coins < f.price} onClick={() => buy(f.id, () => buyFloor(f.id))}>
                    {free ? (
                      'Obtener'
                    ) : (
                      <>
                        <Coin /> {f.price}
                      </>
                    )}
                  </button>
                )}
              </article>
            );
          })}

        {tab !== 'pisos' &&
          tab !== 'vestuario' &&
          SHOP_ITEMS.filter((i) => i.category === tab).map((i) => {
            const locked = !free && level < i.level;
            const stock = me.inventory[i.id] ?? 0;
            const placed = me.placed.filter((p) => p.itemId === i.id).length;
            const rarity = rarityOf(i);
            const progress = Math.min(100, Math.round((me.coins / i.price) * 100));
            return (
              <article key={i.id} className={cardClass(i.id, `rarity-${rarity} ${locked ? 'card-locked' : ''}`)}>
                <span className="rarity-badge">{RARITY_LABEL[rarity]}</span>
                <div className="card-art">
                  <img className="pixel" src={itemIconURL(i.id)} alt="" />
                </div>
                <h3>{i.name}</h3>
                <p className="card-desc">{i.desc}</p>
                <p className="card-meta">
                  ✨ +{i.style} estilo{stock + placed > 0 ? ` · tienes ${stock + placed}` : ''}
                </p>
                {!free && !locked && me.coins < i.price && (
                  <div className="save-track" title={`Llevas ${me.coins} de ${i.price}`}>
                    <div className="save-fill" style={{ width: `${progress}%` }} />
                  </div>
                )}
                {free ? (
                  <div className="card-actions">
                    <button className="btn btn-small btn-buy" onClick={() => buy(i.id, () => buyItem(i.id))}>
                      Obtener
                    </button>
                    <button className="btn btn-small" onClick={() => setGifting(i.id)}>
                      🎁 Regalar
                    </button>
                  </div>
                ) : locked ? (
                  <span className="lock">🔒 Nivel {i.level}</span>
                ) : (
                  <button className="btn btn-small btn-buy" disabled={me.coins < i.price} onClick={() => buy(i.id, () => buyItem(i.id))}>
                    <Coin /> {i.price.toLocaleString('es-CL')}
                  </button>
                )}
              </article>
            );
          })}
      </div>
    </Panel>
  );
}
