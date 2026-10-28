import { useSyncExternalStore } from 'react';
import { bridge } from '../bridge';
import { api, getState, onServerEvent, onSessionChange, type Result } from './store';
import type { AppNotification, ChatMessage } from './types';

/**
 * Lo social que no es parte del mundo compartido: avisos personales, chat
 * general, mensajes privados y quién está conectado. Llega por el mismo canal
 * en vivo que el mundo, pero cada persona recibe solo lo suyo.
 */

function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T): void {
      value = next;
      for (const fn of listeners) fn();
    },
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

const meId = () => getState().currentUserId;

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------

const notifications = createStore<AppNotification[]>([]);
const arrivals = new Set<(n: AppNotification) => void>();

export function useNotifications(): AppNotification[] {
  return useSyncExternalStore(notifications.subscribe, notifications.get);
}

/** Para mostrar un aviso flotante cuando llega algo nuevo. */
export function onNotification(fn: (n: AppNotification) => void): () => void {
  arrivals.add(fn);
  return () => arrivals.delete(fn);
}

export function markNotificationsRead(ids: string[] | 'all'): void {
  const list = notifications.get();
  const target = ids === 'all' ? list.filter((n) => !n.read).map((n) => n.id) : ids;
  if (target.length === 0) return;
  notifications.set(list.map((n) => (target.includes(n.id) ? { ...n, read: true } : n)));
  void api('notifications/read', { ids: ids === 'all' ? 'all' : target });
}

onServerEvent<AppNotification>('notify', (n) => {
  notifications.set([n, ...notifications.get()].slice(0, 100));
  for (const fn of arrivals) fn(n);
});

// ---------------------------------------------------------------------------
// Presencia
// ---------------------------------------------------------------------------

const presence = createStore<string[]>([]);

export function usePresence(): string[] {
  return useSyncExternalStore(presence.subscribe, presence.get);
}

onServerEvent<{ online: string[] }>('presence', (d) => {
  presence.set(d.online);
  bridge.emit('presence', d.online);
});

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatState {
  general: ChatMessage[];
  /** Conversaciones privadas cargadas, por id de la otra persona. */
  dms: Record<string, ChatMessage[]>;
  /** Por contacto: no leídos y hora del último mensaje. */
  summary: Record<string, { unread: number; last: number }>;
  generalUnread: number;
}

const EMPTY_CHAT: ChatState = { general: [], dms: {}, summary: {}, generalUnread: 0 };
const chat = createStore<ChatState>(EMPTY_CHAT);
const dmArrivals = new Set<(m: ChatMessage) => void>();

/** Qué está mirando la persona en el chat: no cuenta como "no leído". */
let focus: 'general' | string | null = null;

export function useChat(): ChatState {
  return useSyncExternalStore(chat.subscribe, chat.get);
}

export function onPrivateMessage(fn: (m: ChatMessage) => void): () => void {
  dmArrivals.add(fn);
  return () => dmArrivals.delete(fn);
}

export function setChatFocus(f: 'general' | string | null): void {
  focus = f;
  const s = chat.get();
  if (f === 'general' && s.generalUnread > 0) chat.set({ ...s, generalUnread: 0 });
  if (f !== null && f !== 'general') void openConversation(f);
}

const MAX_KEEP = 200;

onServerEvent<ChatMessage>('chat', (m) => {
  const s = chat.get();
  const mine = m.from === meId();
  chat.set({
    ...s,
    general: [...s.general, m].slice(-MAX_KEEP),
    generalUnread: focus === 'general' || mine ? s.generalUnread : s.generalUnread + 1,
  });
  bridge.emit('chat:say', m.from, m.text);
});

onServerEvent<ChatMessage>('dm', (m) => {
  const me = meId();
  const other = m.from === me ? m.to : m.from;
  if (other === undefined) return;
  const s = chat.get();
  const loaded = s.dms[other];
  const fromOther = m.from !== me;
  const reading = focus === other;
  const prev = s.summary[other] ?? { unread: 0, last: 0 };
  chat.set({
    ...s,
    dms: loaded ? { ...s.dms, [other]: [...loaded, m].slice(-MAX_KEEP) } : s.dms,
    summary: { ...s.summary, [other]: { last: m.ts, unread: fromOther && !reading ? prev.unread + 1 : prev.unread } },
  });
  if (fromOther && reading) void api('chat/read', { with: other });
  if (fromOther && !reading) for (const fn of dmArrivals) fn(m);
});

export async function openConversation(other: string): Promise<void> {
  const s = chat.get();
  if (s.dms[other] === undefined) {
    const res = await fetch(`/api/chat/dm/${encodeURIComponent(other)}`, { credentials: 'same-origin' });
    const list = res.ok ? ((await res.json()) as ChatMessage[]) : [];
    const cur = chat.get();
    chat.set({ ...cur, dms: { ...cur.dms, [other]: list } });
  }
  const cur = chat.get();
  if ((cur.summary[other]?.unread ?? 0) > 0) {
    chat.set({ ...cur, summary: { ...cur.summary, [other]: { ...cur.summary[other], unread: 0 } } });
  }
  void api('chat/read', { with: other });
}

export async function sendChat(text: string, to?: string): Promise<Result> {
  const clean = text.trim();
  if (!clean) return { ok: false, message: 'Escribe algo primero.' };
  const r = await api('chat', { text: clean.slice(0, 300), ...(to ? { to } : {}) });
  return r.ok ? { ok: true, message: '' } : { ok: false, message: r.message || 'No se pudo enviar.' };
}

export function unreadDms(s: ChatState): number {
  return Object.values(s.summary).reduce((sum, x) => sum + x.unread, 0);
}

// ---------------------------------------------------------------------------
// Carga al entrar / limpieza al salir
// ---------------------------------------------------------------------------

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`/api/${path}`, { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

onSessionChange((id) => {
  if (id === null) {
    notifications.set([]);
    chat.set(EMPTY_CHAT);
    presence.set([]);
    focus = null;
    return;
  }
  void getJson<AppNotification[]>('notifications', []).then((list) => notifications.set(list));
  void Promise.all([
    getJson<ChatMessage[]>('chat/general', []),
    getJson<ChatState['summary']>('chat/summary', {}),
  ]).then(([general, summary]) => {
    const cur = chat.get();
    // Las conversaciones abiertas se recargan al volver a mirarlas.
    chat.set({ ...cur, general, summary, dms: {} });
    if (focus !== null && focus !== 'general') void openConversation(focus);
  });
});
