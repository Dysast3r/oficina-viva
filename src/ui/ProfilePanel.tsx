import { useState } from 'react';
import {
  ACCESSORIES,
  AVATAR_HAIR,
  AVATAR_PANTS,
  AVATAR_SHIRT,
  AVATAR_SKIN,
  COSMETICS,
  HAIR_STYLES,
  ITEM_BY_ID,
  SLOT_LABEL,
  levelForXp,
  type CosmeticSlot,
} from '../data/catalog';
import { ACHIEVEMENTS } from '../data/progress';
import { canAward, currentUser, hasAllDecor, officeScore, updateAvatar, useGame, useSession } from '../data/store';
import type { Avatar } from '../data/types';
import { AvatarImg, Coins, DeptTag, LevelBar, Panel, levelTitle, timeAgo, toast, useNow } from './common';
import { NewPasswordForm } from './LoginScreen';

export function ProfilePanel({
  id,
  onClose,
  onKudos,
  onAward,
  onMessage,
}: {
  id: string;
  onClose: () => void;
  onKudos: (id: string) => void;
  onAward: (id: string) => void;
  onMessage: (id: string) => void;
}) {
  const e = useGame((s) => s.employees[id]);
  const meId = useGame((s) => s.currentUserId);
  const feed = useGame((s) => s.feed);
  const [editing, setEditing] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const { user } = useSession();
  const now = useNow();
  if (e === undefined) return null;
  const isMe = meId === e.id;
  const me = currentUser();
  const mine = feed.filter((f) => f.targetId === e.id).slice(0, 6);
  const topItems = [...e.placed]
    .map((p) => ITEM_BY_ID[p.itemId])
    .filter((d) => d && d.style > 1)
    .sort((a, b) => b.style - a.style)
    .slice(0, 6);

  return (
    <Panel title={isMe ? 'Mi perfil' : 'Perfil'} onClose={onClose}>
      <div className="profile-head">
        <div className="profile-avatar">
          <AvatarImg avatar={e.avatar} size={4} />
        </div>
        <div>
          <h3 className="profile-name">{e.name}</h3>
          <p className="profile-title">{e.title}</p>
          <DeptTag e={e} />
          <p className="profile-rank">{levelTitle(e.xp)}</p>
        </div>
      </div>
      <LevelBar xp={e.xp} />
      <div className="stats">
        <div>
          <Coins value={e.coins} />
          <small>monedas</small>
        </div>
        <div>
          <b>✨ {officeScore(e)}</b>
          <small>estilo del puesto</small>
        </div>
        <div>
          <b>🔥 {e.streak}</b>
          <small>días de racha</small>
        </div>
      </div>

      {isMe ? (
        <button className="btn btn-block" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Listo' : '🎨 Personalizar mi personaje'}
        </button>
      ) : (
        <div className="row-btns">
          <button className="btn" onClick={() => onKudos(e.id)}>
            💖 Reconocer
          </button>
          <button className="btn" onClick={() => onMessage(e.id)}>
            💬 Mensaje
          </button>
          {me && canAward(me, e) && (
            <button className="btn btn-primary" onClick={() => onAward(e.id)}>
              🏅 Registrar logro
            </button>
          )}
        </div>
      )}

      {isMe && editing && <AvatarEditor avatar={e.avatar} owned={hasAllDecor(e) ? 'all' : e.wardrobe ?? []} />}

      {(e.achievements?.length ?? 0) > 0 && (
        <>
          <h4 className="section">Logros</h4>
          <div className="badge-row">
            {ACHIEVEMENTS.filter((a) => e.achievements?.includes(a.id)).map((a) => (
              <span key={a.id} className="ach-badge" title={`${a.name}: ${a.desc}`}>
                {a.icon}
              </span>
            ))}
          </div>
        </>
      )}

      {isMe && user && (
        <>
          <button className="btn btn-block" style={{ marginTop: 6 }} onClick={() => setChangingPw((v) => !v)}>
            {changingPw ? 'Cancelar' : '🔒 Cambiar contraseña'}
          </button>
          {changingPw && (
            <NewPasswordForm
              username={user.username}
              onDone={() => {
                setChangingPw(false);
                toast('Contraseña actualizada.');
              }}
            />
          )}
        </>
      )}

      {topItems.length > 0 && (
        <>
          <h4 className="section">Lo mejor de su puesto</h4>
          <p className="hint">{topItems.map((d) => d.name).join(' · ')}</p>
        </>
      )}

      <h4 className="section">Últimos logros</h4>
      {mine.length === 0 ? (
        <p className="hint">Todavía nada por aquí.</p>
      ) : (
        <ul className="mini-feed">
          {mine.map((f) => (
            <li key={f.id}>
              {f.text} <small>{timeAgo(f.ts, now)}</small>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">Nivel {levelForXp(e.xp)} · {e.xp} XP</p>
    </Panel>
  );
}

function Swatches({ colors, value, onPick, label }: { colors: string[]; value: number; onPick: (i: number) => void; label: string }) {
  return (
    <div className="swatch-row">
      <span className="field-label">{label}</span>
      <div className="swatches">
        {colors.map((c, i) => (
          <button
            key={c}
            className={`swatch ${value === i ? 'swatch-on' : ''}`}
            style={{ background: c }}
            onClick={() => onPick(i)}
            aria-label={`${label} ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Adornos del vestuario que la persona tiene, por zona (o todos para administración). */
function WardrobeRow({ slot, avatar, owned, set }: { slot: CosmeticSlot; avatar: Avatar; owned: string[] | 'all'; set: (p: Partial<Avatar>) => void }) {
  const list = COSMETICS.filter((c) => c.slot === slot && (owned === 'all' || owned.includes(c.id)));
  if (list.length === 0) return null;
  const current = avatar[slot];
  return (
    <div className="swatch-row">
      <span className="field-label">{SLOT_LABEL[slot]}</span>
      <div className="seg">
        <button className={`seg-btn ${current === undefined ? 'seg-on' : ''}`} onClick={() => set({ [slot]: undefined })}>
          Nada
        </button>
        {list.map((c) => (
          <button key={c.id} className={`seg-btn ${current === c.id ? 'seg-on' : ''}`} onClick={() => set({ [slot]: c.id })}>
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Editor de personaje. Sin `onChange`, guarda cada cambio de inmediato (perfil). */
export function AvatarEditor({
  avatar,
  onChange,
  preview = true,
  owned = [],
}: {
  avatar: Avatar;
  onChange?: (a: Avatar) => void;
  preview?: boolean;
  owned?: string[] | 'all';
}) {
  const set = (patch: Partial<Avatar>) => {
    const next = { ...avatar, ...patch };
    // Sin la clave (y no `undefined`), para que el servidor no lo vea como un adorno vacío.
    for (const k of ['hat', 'face', 'neck'] as const) if (next[k] === undefined) delete next[k];
    (onChange ?? updateAvatar)(next);
  };
  return (
    <div className="avatar-editor">
      {preview && (
        <div className="avatar-preview">
          <AvatarImg avatar={avatar} size={4} />
          <AvatarImg avatar={avatar} size={4} pose="back" />
        </div>
      )}
      <div className="swatch-row">
        <span className="field-label">Cuerpo</span>
        <div className="seg">
          {(['Hombre', 'Mujer'] as const).map((n, i) => (
            <button key={n} className={`seg-btn ${avatar.body === i ? 'seg-on' : ''}`} onClick={() => set({ body: i as 0 | 1 })}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="swatch-row">
        <span className="field-label">Peinado</span>
        <div className="seg">
          {HAIR_STYLES.map((n, i) => (
            <button key={n} className={`seg-btn ${avatar.hairStyle === i ? 'seg-on' : ''}`} onClick={() => set({ hairStyle: i })}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="swatch-row">
        <span className="field-label">Accesorios</span>
        <div className="seg">
          {ACCESSORIES.map((n, i) => (
            <button key={n} className={`seg-btn ${(avatar.acc ?? 0) === i ? 'seg-on' : ''}`} onClick={() => set({ acc: i })}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <Swatches label="Piel" colors={AVATAR_SKIN} value={avatar.skin} onPick={(i) => set({ skin: i })} />
      <Swatches label="Pelo" colors={AVATAR_HAIR} value={avatar.hair} onPick={(i) => set({ hair: i })} />
      <Swatches label="Chaqueta" colors={AVATAR_SHIRT} value={avatar.shirt} onPick={(i) => set({ shirt: i })} />
      <Swatches label="Pantalón" colors={AVATAR_PANTS} value={avatar.pants} onPick={(i) => set({ pants: i })} />
      {(['hat', 'face', 'neck'] as const).map((slot) => (
        <WardrobeRow key={slot} slot={slot} avatar={avatar} owned={owned} set={set} />
      ))}
      {owned !== 'all' && owned.length === 0 && <p className="hint">🎩 Compra sombreros, barbas, lentes y más en la tienda (pestaña Vestuario).</p>}
    </div>
  );
}
