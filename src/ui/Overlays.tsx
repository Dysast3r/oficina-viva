import { useEffect, useState } from 'react';
import { bridge } from '../bridge';
import { COSMETIC_BY_ID, ITEM_BY_ID, ROOMS } from '../data/catalog';
import { EXPANSIONS } from '../data/layout';
import { ACHIEVEMENTS } from '../data/progress';
import { isWorkDay } from '../data/schedule';
import { markNotificationsRead, useNotifications } from '../data/social';
import { meetingWhen, missionStatus, officeFund, today, useGame } from '../data/store';
import type { AppNotification, Employee } from '../data/types';
import { itemIconURL } from '../game/pixel/textures';
import { AvatarImg, timeAgo, useNow } from './common';

function GiftIcon({ n }: { n: AppNotification }) {
  const id = String(n.data?.itemId ?? '');
  if (ITEM_BY_ID[id]) return <img className="pixel" src={itemIconURL(id)} alt="" />;
  const slot = COSMETIC_BY_ID[id]?.slot;
  return <span className="gift-emoji">{slot === 'hat' ? '🎩' : slot === 'face' ? '🕶️' : slot === 'neck' ? '🎀' : '🎁'}</span>;
}

/** Regalos recibidos: aparece en vivo o al entrar, hasta que la persona lo cierra. */
export function GiftNotice({ onPlace }: { onPlace: () => void }) {
  const list = useNotifications();
  const employees = useGame((s) => s.employees);
  const now = useNow();
  const gifts = list.filter((n) => n.kind === 'gift' && !n.read);
  // Primero los avisos generales; los regalos esperan su turno.
  if (gifts.length === 0 || list.some((n) => n.kind === 'announcement' && !n.read)) return null;
  const close = () => markNotificationsRead(gifts.map((g) => g.id));

  return (
    <div className="modal-veil">
      <div className="gift-notice" role="alertdialog" aria-labelledby="gift-title">
        <div className="gift-burst" aria-hidden="true">
          🎁
        </div>
        <h3 id="gift-title">{gifts.length === 1 ? '¡Recibiste un regalo!' : `¡Recibiste ${gifts.length} regalos!`}</h3>
        <ul>
          {gifts.map((n) => {
            const from = employees[String(n.data?.fromId ?? '')];
            return (
              <li key={n.id}>
                <GiftIcon n={n} />
                <span>
                  <b>{n.title.replace('¡Recibiste un regalo: ', '').replace(/!$/, '')}</b>
                  <small>
                    de {from?.name ?? 'Administración'} · {timeAgo(n.ts, now)}
                  </small>
                  {n.body && <q>{n.body}</q>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="hint">Las decoraciones quedan en tu bodega y los adornos, en tu vestuario.</p>
        <div className="row-btns">
          <button className="btn" onClick={close}>
            ¡Gracias!
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              close();
              onPlace();
            }}
          >
            🛠️ Colocarlo ahora
          </button>
        </div>
      </div>
    </div>
  );
}

/** Aviso general de administración: en pantalla para todos, de a uno, hasta que se marca como leído. */
export function AnnouncementOverlay() {
  const list = useNotifications();
  const employees = useGame((s) => s.employees);
  const pending = list.filter((n) => n.kind === 'announcement' && !n.read).sort((a, b) => a.ts - b.ts);
  const n = pending[0];
  if (n === undefined) return null;
  const by = employees[String(n.data?.byId ?? '')];
  return (
    <div className="modal-veil">
      <div className="announce-modal" role="alertdialog" aria-labelledby="announce-title">
        <div className="announce-head">
          <span className="announce-icon">📢</span>
          <span>
            <small>Aviso general{by ? ` de ${by.name}` : ''}</small>
            <h3 id="announce-title">{n.title}</h3>
          </span>
        </div>
        {n.body && <p className="announce-body">{n.body}</p>}
        <div className="row-btns">
          <button className="btn btn-primary" onClick={() => markNotificationsRead([n.id])}>
            Entendido {pending.length > 1 ? `(${pending.length - 1} más)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

type Celebration = { id: number; kind: 'level' | 'achievement' | 'expansion'; icon: string; title: string; text: string };

/** Momentos grandes a pantalla completa: nivel, logro y oficina ampliada. */
export function Celebrations({ meId }: { meId: string }) {
  const [list, setList] = useState<Celebration[]>([]);
  useEffect(() => {
    let seq = 1;
    const push = (c: Omit<Celebration, 'id'>) => {
      const item = { ...c, id: seq++ };
      setList((l) => [...l, item]);
      window.setTimeout(() => setList((l) => l.filter((x) => x.id !== item.id)), c.kind === 'expansion' ? 6500 : 4200);
    };
    const offs = [
      bridge.on('fx:levelup', (id, level) => {
        if (id === meId) push({ kind: 'level', icon: '⭐', title: `¡Nivel ${level}!`, text: 'Se desbloquearon cosas nuevas en la tienda.' });
      }),
      bridge.on('fx:achievement', (id, achId) => {
        const a = ACHIEVEMENTS.find((x) => x.id === achId);
        if (id === meId && a) push({ kind: 'achievement', icon: a.icon, title: `Logro: ${a.name}`, text: `${a.desc} · +${a.reward} monedas` });
      }),
      bridge.on('fx:expansion', (level) => {
        const x = EXPANSIONS[level - 1];
        if (x) push({ kind: 'expansion', icon: '🏗️', title: `¡La oficina creció!`, text: `Nueva zona: ${ROOMS[x.room.id].name}. ${x.desc}` });
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [meId]);

  const c = list[0];
  if (c === undefined) return null;
  return (
    <div className={`celebration celebration-${c.kind}`} key={c.id} aria-live="polite">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <i key={i} style={{ '--i': i, left: `${(i * 37) % 100}%` } as React.CSSProperties} />
        ))}
      </div>
      <div className="celebration-card">
        <span className="celebration-icon">{c.icon}</span>
        <h2>{c.title}</h2>
        <p>{c.text}</p>
      </div>
    </div>
  );
}

const WELCOME_KEY = 'iw:welcome';

/** Bienvenida del día: resumen de lo pendiente al entrar (una vez por día y persona). */
export function WelcomeCard({ me, onMissions, onAgenda, onFund }: { me: Employee; onMissions: () => void; onAgenda: () => void; onFund: () => void }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_KEY) !== `${me.id}:${today()}`;
    } catch {
      return true;
    }
  });
  const notifs = useNotifications();
  const meeting = useGame((s) => (s.meetings ?? []).find((m) => m.status !== 'ended' && m.status !== 'cancelled' && (m.attendees.length === 0 || m.attendees.includes(me.id))));
  const fund = useGame((s) => officeFund(s));
  // Avisos y regalos pendientes van antes que la bienvenida.
  if (!open || notifs.some((n) => (n.kind === 'announcement' || n.kind === 'gift') && !n.read)) return null;
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(WELCOME_KEY, `${me.id}:${today()}`);
    } catch {
      // Sin almacenamiento: se vuelve a mostrar en la próxima visita, no pasa nada.
    }
  };
  const { daily } = missionStatus(me);
  const pendingMissions = daily.filter((m) => !m.done).length;
  const unread = notifs.filter((n) => !n.read).length;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const next = EXPANSIONS[fund.level];
  const prevCost = fund.level === 0 ? 0 : EXPANSIONS[fund.level - 1].cost;
  const fundPct = next ? Math.round(((fund.total - prevCost) / (next.cost - prevCost)) * 100) : 100;

  return (
    <div className="modal-veil" onClick={close}>
      <div className="welcome-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="welcome-title">
        <div className="welcome-avatar">
          <AvatarImg avatar={me.avatar} size={3} />
        </div>
        <h2 id="welcome-title">
          {hello}, {me.name.split(' ')[0]} 👋
        </h2>
        <ul className="welcome-list">
          {isWorkDay(today()) && (
            <li>
              <button onClick={() => (close(), onMissions())}>
                🎯 {pendingMissions > 0 ? `Tienes ${pendingMissions} misiones nuevas hoy` : 'Misiones del día completas'}
              </button>
            </li>
          )}
          {unread > 0 && <li>🔔 {unread} notificaciones sin leer</li>}
          {meeting && (
            <li>
              <button onClick={() => (close(), onAgenda())}>
                🗓️ {meeting.status === 'active' ? 'Reunión en curso' : 'Próxima reunión'}: {meeting.title}
                {meeting.status === 'scheduled' ? ` · ${meetingWhen(meeting.start)}` : ''}
              </button>
            </li>
          )}
          {next && (
            <li>
              <button onClick={() => (close(), onFund())}>
                🏗️ Fondo de ampliación: {fundPct}% para {ROOMS[next.room.id].name}
              </button>
            </li>
          )}
        </ul>
        <button className="btn btn-primary btn-block" onClick={close}>
          ¡A trabajar!
        </button>
      </div>
    </div>
  );
}
