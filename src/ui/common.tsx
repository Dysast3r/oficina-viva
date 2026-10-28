import { Component, useEffect, useRef, useState, useSyncExternalStore, type ErrorInfo, type ReactNode } from 'react';
import { LEVEL_TITLES, ROOMS, levelForXp, xpForLevel } from '../data/catalog';
import type { Result } from '../data/store';
import type { Avatar, Employee } from '../data/types';
import { avatarURL, iconURL } from '../game/pixel/textures';
import { L, LANGS, intlLocale, lang, setLang } from '../i18n';

/** Personaje como imagen; `size` multiplica su tamaño de mundo (16×35, con espacio arriba para sombreros). */
export function AvatarImg({ avatar, size = 3, pose = 'front' }: { avatar: Avatar; size?: number; pose?: 'front' | 'back' }) {
  return (
    <img className="pixel" src={avatarURL(avatar, pose === 'back' ? 'back0' : 'front0')} width={16 * size} height={35 * size} alt="" />
  );
}

export function Coin({ size = 2 }: { size?: number }) {
  return <img className="pixel coin-icon" src={iconURL('coin')} width={8 * size} height={8 * size} alt={L('monedas', 'coins')} />;
}

/** Número que corre hasta su nuevo valor (y brilla si sube). */
export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    setFlash(value > start ? 'up' : 'down');
    const t0 = performance.now();
    const dur = Math.min(1200, 300 + Math.abs(value - start) * 6);
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start + (value - start) * eased);
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
      else window.setTimeout(() => setFlash(null), 350);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={flash ? `num-flash num-${flash}` : undefined}>{shown.toLocaleString(intlLocale())}</span>;
}

export function Coins({ value }: { value: number }) {
  return (
    <span className="coins">
      <Coin /> <AnimatedNumber value={value} />
    </span>
  );
}

/** Barra de avance animada. */
export function Progress({ value, max, tone = 'gold' }: { value: number; max: number; tone?: 'gold' | 'green' | 'blue' | 'pink' }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <span className={`progress progress-${tone}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <span className="progress-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function LevelBar({ xp }: { xp: number }) {
  const level = levelForXp(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  const pct = level >= 20 ? 100 : Math.round(((xp - from) / (to - from)) * 100);
  return (
    <div className="levelbar" title={L(`${xp} XP · faltan ${Math.max(0, to - xp)} para nivel ${level + 1}`, `${xp} XP · ${Math.max(0, to - xp)} to level ${level + 1}`)}>
      <span className="levelbar-lv">{L('Nv', 'Lv')} {level}</span>
      <span className="levelbar-track">
        <span className="levelbar-fill" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export function levelTitle(xp: number): string {
  return LEVEL_TITLES[levelForXp(xp) - 1];
}

export function DeptTag({ e }: { e: Employee }) {
  const room = ROOMS[e.dept];
  return (
    <span className="dept-tag" style={{ background: room.color }}>
      {room.name}
    </span>
  );
}

/**
 * Si un panel falla al dibujarse, se muestra un aviso en su lugar en vez de
 * desmontar toda la app (y con ella el juego).
 */
export class SafeBoundary extends Component<{ children: ReactNode; label?: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[ui]', this.props.label ?? 'componente', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="toast toast-err safe-fail" role="alert">
        {L(`Algo falló en ${this.props.label ?? 'esta parte'}.`, `Something went wrong in ${this.props.label ?? 'this section'}.`)}{' '}
        <button className="link-btn" onClick={() => this.setState({ failed: false })}>
          {L('Reintentar', 'Retry')}
        </button>
      </div>
    );
  }
}

export function Panel({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <aside className={`panel ${wide ? 'panel-wide' : ''}`}>
      <header className="panel-head">
        <h2>{title}</h2>
        <button className="btn-icon" onClick={onClose} aria-label={L('Cerrar', 'Close')}>
          ✕
        </button>
      </header>
      <div className="panel-body">
        <SafeBoundary label={L(`el panel ${title}`, `the ${title} panel`)}>{children}</SafeBoundary>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  text: string;
  ok: boolean;
  icon?: string;
  title?: string;
  tone?: 'gold' | 'pink' | 'blue' | 'green';
}

let toasts: Toast[] = [];
let nextId = 1;
const toastListeners = new Set<() => void>();

function pushToast(t: Toast, ms: number): void {
  toasts = [...toasts, t].slice(-4);
  toastListeners.forEach((fn) => fn());
  window.setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((fn) => fn());
  }, ms);
}

export function toast(text: string, ok = true): void {
  if (!text) return;
  pushToast({ id: nextId++, text, ok }, 3200);
}

/** Aviso con ícono y título (notificaciones, misiones, mensajes). */
export function richToast(icon: string, title: string, text = '', tone: Toast['tone'] = 'blue'): void {
  pushToast({ id: nextId++, text, ok: true, icon, title, tone }, 5000);
}

/** Muestra el resultado de una acción del store. */
export function report(r: Result): boolean {
  toast(r.message, r.ok);
  return r.ok;
}

export function Toasts() {
  const list = useSyncExternalStore(
    (fn) => {
      toastListeners.add(fn);
      return () => toastListeners.delete(fn);
    },
    () => toasts,
  );
  return (
    <div className="toasts" role="status">
      {list.map((t) =>
        t.title ? (
          <div key={t.id} className={`toast toast-rich toast-${t.tone ?? 'blue'}`}>
            <span className="toast-icon">{t.icon}</span>
            <span>
              <b>{t.title}</b>
              {t.text && <small>{t.text}</small>}
            </span>
          </div>
        ) : (
          <div key={t.id} className={`toast ${t.ok ? '' : 'toast-err'}`}>
            {t.text}
          </div>
        ),
      )}
    </div>
  );
}

/** Selector de idioma: cambiarlo recarga la página. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const current = lang();
  return (
    <div className={`seg lang-switch ${className}`} role="group" aria-label={L('Idioma', 'Language')}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          lang={l.id}
          className={`seg-btn ${current === l.id ? 'seg-on' : ''}`}
          aria-pressed={current === l.id}
          onClick={() => setLang(l.id)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return L('recién', 'just now');
  const m = Math.round(s / 60);
  if (m < 60) return L(`hace ${m} min`, `${m} min ago`);
  const h = Math.round(m / 60);
  if (h < 24) return L(`hace ${h} h`, `${h} h ago`);
  return L(`hace ${Math.round(h / 24)} d`, `${Math.round(h / 24)} d ago`);
}
