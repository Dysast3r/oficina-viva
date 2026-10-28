import { useEffect, useRef, useState } from 'react';
import { bridge } from '../bridge';
import { DAILY_BONUS } from '../data/catalog';
import { feedText } from '../data/messages';
import { TIME_ZONE, checkInBlockedReason, isWorkDay, officeClock, scheduleStatus } from '../data/schedule';
import { useWeather } from '../data/sky';
import { dayPhase, sunTimes, weatherIcon, weatherLabel } from '../data/weather';
import { useNotifications } from '../data/social';
import {
  TEAM_DAILY_TARGET,
  activeMeetingFor,
  canOpenChest,
  checkIn,
  claimDailyBonus,
  endMeeting,
  meetingWhen,
  missionStatus,
  openChest,
  teamCoinsToday,
  today,
  useGame,
  type MissionStatus,
} from '../data/store';
import type { Employee } from '../data/types';
import { AvatarImg, Coins, LevelBar, Progress, report, useNow } from './common';
import { Icon, type IconName } from './icons';
import { L, intlLocale } from '../i18n';

/** Tarjeta superior izquierda: quién eres, fecha, hora, jornada y productividad del equipo. */
export function ClockCard({ me, onProfile }: { me: Employee; onProfile: () => void }) {
  const now = useNow(1000);
  const feed = useGame((s) => s.feed);
  const weather = useWeather();
  const d = new Date(now);
  // Siempre la hora de la oficina (Santiago), aunque el computador esté en otra zona.
  const day = d.toLocaleDateString(intlLocale(), { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
  const time = d.toLocaleTimeString(intlLocale(), { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const clock = officeClock(now);
  const sun = sunTimes(weather, Number(d.toLocaleDateString('en-US', { timeZone: TIME_ZONE, month: 'numeric' })) - 1);
  const phase = dayPhase(clock.minutes, sun.sunrise, sun.sunset);
  const night = phase === 'night' || phase === 'dusk';
  const shift = scheduleStatus(now);
  const pct = Math.min(100, Math.round((teamCoinsToday(feed) / TEAM_DAILY_TARGET) * 100));

  return (
    <section className="hud-card clock-card">
      <button
        className="me-row"
        onClick={() => {
          bridge.emit('camera:focus', me.id);
          onProfile();
        }}
        title={L('Ver mi perfil', 'View my profile')}
      >
        <span className="me-face">
          <AvatarImg avatar={me.avatar} size={1.6} />
        </span>
        <span className="me-info">
          <b>{me.name}</b>
          <LevelBar xp={me.xp} />
        </span>
        <Coins value={me.coins} />
      </button>
      <div className="clock-row">
        <div>
          <div className="clock-day">{day.charAt(0).toUpperCase() + day.slice(1)}</div>
          <div className="clock-time">{time}</div>
          <div className={`clock-shift ${shift.open ? 'shift-open' : ''}`}>{shift.text}</div>
        </div>
        {weather ? (
          <span className={`clock-weather ${night ? 'sky-night' : 'sky-day'}`} title={L(`${weatherLabel(weather.code)} en Santiago · viento ${weather.wind} km/h`, `${weatherLabel(weather.code)} in Santiago · wind ${weather.wind} km/h`)}>
            <span className="weather-icon">{weatherIcon(weather.code, night)}</span>
            <span className="weather-temp num">{weather.temp}°</span>
            <span className="weather-label">{weatherLabel(weather.code)}</span>
          </span>
        ) : (
          <span className={`clock-sky ${night ? 'sky-night' : 'sky-day'}`}>
            <Icon name={night ? 'moon' : 'sun'} size={26} />
          </span>
        )}
      </div>
      <div className="prod">
        <div className="prod-head">
          <span>{L('Productividad del equipo', 'Team productivity')}</span>
          <span className="num">{pct}%</span>
        </div>
        <div className="prod-track">
          <div className={`prod-fill ${pct >= 100 ? 'prod-full' : ''}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </section>
  );
}

function MissionRow({ m, onClick }: { m: MissionStatus; onClick?: () => void }) {
  return (
    <li>
      <button className={`obj ${m.done ? 'obj-done' : ''}`} onClick={onClick} disabled={m.done || onClick === undefined}>
        <span className="obj-box">{m.done ? <Icon name="check" size={14} /> : m.icon}</span>
        <span className="obj-text">
          {m.label}
          {!m.done && m.target > 1 && <Progress value={m.progress} max={m.target} tone="blue" />}
        </span>
        <span className="obj-reward">+{m.reward}</span>
      </button>
    </li>
  );
}

/** Misiones del día (atajos a su acción), cofre diario y bono por completarlas. */
export function Objectives({ me, onOpen, onKudos, onShop, onChat }: { me: Employee; onOpen: () => void; onKudos: () => void; onShop: () => void; onChat: () => void }) {
  const now = useNow(30_000);
  const { daily } = missionStatus(me);
  const allDone = daily.length > 0 && daily.every((m) => m.done);
  const claimed = me.bonusDate === today();
  const checkInBlocked = checkInBlockedReason(now);
  const actionFor = (m: MissionStatus): (() => void) | undefined => {
    switch (m.counter) {
      case 'checkin':
      case 'punctual':
        return checkInBlocked ? undefined : () => report(checkIn());
      case 'kudos':
        return onKudos;
      case 'purchase':
      case 'decor':
        return onShop;
      case 'chat':
      case 'dm':
        return onChat;
      case 'chest':
        return () => report(openChest());
      default:
        return onOpen;
    }
  };

  if (!isWorkDay(today())) {
    return (
      <section className="hud-card objectives">
        <h3>{L('Misiones del día', "Today's missions")}</h3>
        <p className="obj-claimed">{L('Hoy no es día laboral. ¡Disfruta el descanso! 🌴', "Today isn't a workday. Enjoy the break! 🌴")}</p>
        <button className="link-btn" onClick={onOpen}>
          {L('Ver misiones semanales y logros →', 'See weekly missions and achievements →')}
        </button>
      </section>
    );
  }
  return (
    <section className="hud-card objectives">
      <h3>
        {L('Misiones del día', "Today's missions")}
        <button className="link-btn" onClick={onOpen}>
          {L('Ver todo', 'See all')}
        </button>
      </h3>
      {me.lastCheckIn !== today() && (
        <button className="btn btn-small btn-block checkin-btn" disabled={checkInBlocked !== null} onClick={() => report(checkIn())}>
          ☀️ {checkInBlocked ?? L('Marcar mi llegada', 'Check in')}
        </button>
      )}
      <ul>
        {daily.map((m) => (
          <MissionRow key={m.id} m={m} onClick={actionFor(m)} />
        ))}
      </ul>
      {canOpenChest(me) && (
        <button className="btn btn-small btn-block chest-btn" onClick={() => report(openChest())}>
          🧰 {L('Abrir cofre diario', 'Open daily chest')}
        </button>
      )}
      {allDone && !claimed && (
        <button className="btn btn-gold btn-block bonus-btn" onClick={() => report(claimDailyBonus())}>
          🎁 {L('Cobrar bono', 'Claim bonus')} +{DAILY_BONUS}
        </button>
      )}
      {claimed && <p className="obj-claimed">{L('¡Bono de hoy cobrado! Vuelve mañana.', "Today's bonus claimed! Come back tomorrow.")}</p>}
    </section>
  );
}

/** Franja de reunión en curso: todos van a la sala; quien la agendó (o admin) la termina. */
export function MeetingBanner({ me }: { me: Employee }) {
  const meeting = useGame((s) => activeMeetingFor(s, me.id));
  const upcoming = useGame((s) =>
    (s.meetings ?? []).find((m) => m.status === 'scheduled' && (m.attendees.length === 0 || m.attendees.includes(me.id)) && m.start - Date.now() < 10 * 60_000),
  );
  useNow(15_000);
  if (meeting) {
    const canEnd = meeting.createdBy === me.id || me.role === 'admin';
    return (
      <div className="meeting-banner meeting-live" role="status">
        <span className="live-dot" />
        <span>
          <b>{L('Reunión en curso:', 'Meeting in progress:')}</b> {meeting.title}
          <small> · {L(`${meeting.present.length} en la sala`, `${meeting.present.length} in the room`)}</small>
        </span>
        <button className="btn btn-small" onClick={() => bridge.emit('camera:room', 'reuniones')}>
          {L('Ver sala', 'View room')}
        </button>
        {canEnd && (
          <button className="btn btn-small btn-primary" onClick={() => report(endMeeting(meeting.id))}>
            {L('Terminar reunión', 'End meeting')}
          </button>
        )}
      </div>
    );
  }
  if (upcoming) {
    return (
      <div className="meeting-banner" role="status">
        🗓️ <b>{L('Pronto:', 'Coming up:')}</b> {upcoming.title} · {meetingWhen(upcoming.start)}
      </div>
    );
  }
  return null;
}

/** Botón de campana con el número de avisos sin leer (se sacude al llegar uno). */
export function BellButton({ onClick, active }: { onClick: () => void; active: boolean }) {
  const list = useNotifications();
  const unread = list.filter((n) => !n.read).length;
  const [shake, setShake] = useState(false);
  const prev = useRef(unread);
  useEffect(() => {
    if (unread > prev.current) {
      setShake(true);
      const t = window.setTimeout(() => setShake(false), 900);
      prev.current = unread;
      return () => window.clearTimeout(t);
    }
    prev.current = unread;
  }, [unread]);
  return (
    <button className={`hud-round ${active ? 'hud-round-on' : ''} ${shake ? 'shake' : ''}`} onClick={onClick} aria-label={L(`Notificaciones (${unread} sin leer)`, `Notifications (${unread} unread)`)}>
      <Icon name="bell" />
      {unread > 0 && <span className="count-badge">{unread > 99 ? '99+' : unread}</span>}
    </button>
  );
}

/** Última novedad del equipo, que aparece con un pequeño rebote. */
export function Ticker() {
  const latest = useGame((s) => s.feed[0]);
  const [visible, setVisible] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (latest === undefined) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(t);
  }, [latest?.id]);
  if (latest === undefined || !visible) return null;
  return (
    <button key={latest.id} className="ticker" onClick={() => bridge.emit('camera:focus', latest.targetId)}>
      {feedText(latest)}
    </button>
  );
}

export interface NavItem {
  id: string;
  icon: IconName;
  label: string;
  active?: boolean;
  /** Número sobre el ícono (0 = nada). */
  badge?: number;
  onClick: () => void;
}

export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="bottom-nav" aria-label={L('Navegación principal', 'Main navigation')}>
      {items.map((it) => (
        <button key={it.id} className={`nav-btn ${it.active ? 'nav-on' : ''}`} onClick={it.onClick}>
          <Icon name={it.icon} />
          <span>{it.label}</span>
          {(it.badge ?? 0) > 0 && <i className="nav-count">{(it.badge ?? 0) > 99 ? '99+' : it.badge}</i>}
        </button>
      ))}
    </nav>
  );
}
