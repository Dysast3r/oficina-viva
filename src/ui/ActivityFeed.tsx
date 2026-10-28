import { useEffect, useState } from 'react';
import { bridge } from '../bridge';
import { markNotificationsRead, useNotifications } from '../data/social';
import { useGame } from '../data/store';
import type { ActivityKind, NotificationKind } from '../data/types';
import { Panel, timeAgo, useNow } from './common';

const FEED_ICON: Record<ActivityKind, string> = {
  award: '🏅',
  kudos: '💖',
  purchase: '🛒',
  checkin: '☀️',
  levelup: '⭐',
  decor: '🛠️',
  join: '👋',
  gift: '🎁',
  achievement: '🏆',
  meeting: '🗓️',
  team: '🎉',
  announcement: '📢',
};

export const NOTIFICATION_ICON: Record<NotificationKind, string> = {
  gift: '🎁',
  kudos: '💖',
  award: '🏅',
  levelup: '⭐',
  announcement: '📢',
  meeting: '🗓️',
  achievement: '🏆',
  mission: '🎯',
  team: '🎉',
};

/** Avisos personales ("Para ti") y la actividad de todo el equipo. */
export function NotificationsPanel({ onClose, onOpenAgenda }: { onClose: () => void; onOpenAgenda: () => void }) {
  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  const list = useNotifications();
  const feed = useGame((s) => s.feed);
  const now = useNow();
  const unread = list.filter((n) => !n.read).length;

  // Al mirar la pestaña personal, todo queda leído (con un respiro para que se note qué era nuevo).
  useEffect(() => {
    if (tab !== 'mine' || unread === 0) return;
    const t = window.setTimeout(() => markNotificationsRead('all'), 1500);
    return () => window.clearTimeout(t);
  }, [tab, unread]);

  return (
    <Panel title="Notificaciones" onClose={onClose}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'mine'} className={`tab ${tab === 'mine' ? 'tab-on' : ''}`} onClick={() => setTab('mine')}>
          Para ti {unread > 0 && <span className="tab-count">{unread}</span>}
        </button>
        <button role="tab" aria-selected={tab === 'team'} className={`tab ${tab === 'team' ? 'tab-on' : ''}`} onClick={() => setTab('team')}>
          Actividad del equipo
        </button>
      </div>
      {tab === 'mine' ? (
        <ul className="feed-list">
          {list.length === 0 && <li className="hint">Aquí llegan tus regalos, logros, avisos y reuniones.</li>}
          {list.map((n) => (
            <li key={n.id} className={`feed-item notif ${n.read ? '' : 'notif-new'}`}>
              <button
                onClick={() => {
                  if (n.kind === 'meeting' || n.kind === 'announcement') onOpenAgenda();
                }}
              >
                <span className="feed-icon">{NOTIFICATION_ICON[n.kind]}</span>
                <span className="feed-text">
                  <b>{n.title}</b>
                  {n.body && <span className="notif-body">{n.body}</span>}
                </span>
                <small>{timeAgo(n.ts, now)}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="feed-list">
          {feed.length === 0 && <li className="hint">Aquí aparecen los logros, compras y reconocimientos del equipo.</li>}
          {feed.slice(0, 60).map((f) => (
            <li key={f.id} className={`feed-item feed-${f.kind}`}>
              <button onClick={() => bridge.emit('camera:focus', f.targetId)}>
                <span className="feed-icon">{FEED_ICON[f.kind]}</span>
                <span className="feed-text">{f.text}</span>
                <small>{timeAgo(f.ts, now)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
