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
import { L, intlLocale } from '../i18n';

type Tab = ItemCategory | 'pisos' | 'vestuario';
const TABS: Tab[] = ['legendario', 'premium', 'vestuario', 'muebles', 'plantas', 'tecnologia', 'deco', 'pisos'];

function tabLabel(t: Tab): string {
  if (t === 'pisos') return L('Pisos', 'Floors');
  if (t === 'vestuario') return L('🎩 Vestuario', '🎩 Wardrobe');
  if (t === 'legendario') return L('✨ Legendario', '✨ Legendary');
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
        <h4>🎁 {L('Regalar', 'Give')} {item?.name ?? cosmetic?.name}</h4>
        <select className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label={L('Para', 'To')}>
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
          placeholder={L('Mensaje (opcional): ¡Felicitaciones por el cierre!', 'Message (optional): Congrats on closing the deal!')}
          maxLength={140}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="row-btns">
          <button className="btn" onClick={onClose}>
            {L('Cancelar', 'Cancel')}
          </button>
          <button
            className="btn btn-primary"
            disabled={!to}
            onClick={() => {
              if (report(giftItem(to, itemId, message))) onClose();
            }}
          >
            {L('Enviar regalo', 'Send gift')}
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
    <Panel title={L('Tienda', 'Shop')} onClose={onClose} wide>
      <div className="shop-wallet">
        {free ? (
          <span>{L('🛡️ Administración: todo gratis y puedes regalarlo.', '🛡️ Admin: everything is free and you can give it as a gift.')}</span>
        ) : (
          <span>
            {L('Tienes', 'You have')} <Coin /> <b>{me.coins.toLocaleString(intlLocale())}</b> · {L('Nivel', 'Level')} {level}
          </span>
        )}
        <button className="btn btn-small" onClick={onDecorate}>
          🛠️ {L('Ir a decorar', 'Go decorate')}
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
        <p className="legend-intro">
          {L(
            'Objetos únicos para los que más brillan. Tienen luces y destellos propios y suman muchísimo estilo a tu puesto.',
            'Unique items for those who shine brightest. They have their own lights and sparkles and add a ton of style to your desk.',
          )}
        </p>
      )}
      {tab === 'vestuario' && (
        <p className="legend-intro">
          {L(
            'Adornos para tu personaje: se ven en la oficina, en el chat y en tu perfil. Al comprarlos te los pones al tiro.',
            "Accessories for your character: they show in the office, in chat and on your profile. You put them on as soon as you buy them.",
          )}
        </p>
      )}

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
                    {wearing ? L('Puesto', 'Wearing') : L('Ponérmelo', 'Put it on')}
                  </button>
                ) : free ? (
                  <div className="card-actions">
                    <button className="btn btn-small btn-buy" onClick={() => buy(c.id, () => buyCosmetic(c.id))}>
                      {L('Obtener', 'Get')}
                    </button>
                    <button className="btn btn-small" onClick={() => setGifting(c.id)}>
                      🎁 {L('Regalar', 'Give')}
                    </button>
                  </div>
                ) : locked ? (
                  <span className="lock">🔒 {L('Nivel', 'Level')} {c.level}</span>
                ) : (
                  <button className="btn btn-small btn-buy" disabled={me.coins < c.price} onClick={() => buy(c.id, () => buyCosmetic(c.id))}>
                    <Coin /> {c.price.toLocaleString(intlLocale())}
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
                <p className="card-meta">✨ +{f.style} {L('estilo', 'style')}</p>
                {owned ? (
                  <button className="btn btn-small" disabled={me.floor === f.id} onClick={() => report(buyFloor(f.id))}>
                    {me.floor === f.id ? L('Instalado', 'Installed') : L('Usar', 'Use')}
                  </button>
                ) : locked ? (
                  <span className="lock">🔒 {L('Nivel', 'Level')} {f.level}</span>
                ) : (
                  <button className="btn btn-small btn-buy" disabled={!free && me.coins < f.price} onClick={() => buy(f.id, () => buyFloor(f.id))}>
                    {free ? (
                      L('Obtener', 'Get')
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
                  ✨ +{i.style} {L('estilo', 'style')}
                  {stock + placed > 0 ? L(` · tienes ${stock + placed}`, ` · you have ${stock + placed}`) : ''}
                </p>
                {!free && !locked && me.coins < i.price && (
                  <div className="save-track" title={L(`Llevas ${me.coins} de ${i.price}`, `You have ${me.coins} of ${i.price}`)}>
                    <div className="save-fill" style={{ width: `${progress}%` }} />
                  </div>
                )}
                {free ? (
                  <div className="card-actions">
                    <button className="btn btn-small btn-buy" onClick={() => buy(i.id, () => buyItem(i.id))}>
                      {L('Obtener', 'Get')}
                    </button>
                    <button className="btn btn-small" onClick={() => setGifting(i.id)}>
                      🎁 {L('Regalar', 'Give')}
                    </button>
                  </div>
                ) : locked ? (
                  <span className="lock">🔒 {L('Nivel', 'Level')} {i.level}</span>
                ) : (
                  <button className="btn btn-small btn-buy" disabled={me.coins < i.price} onClick={() => buy(i.id, () => buyItem(i.id))}>
                    <Coin /> {i.price.toLocaleString(intlLocale())}
                  </button>
                )}
              </article>
            );
          })}
      </div>
    </Panel>
  );
}
