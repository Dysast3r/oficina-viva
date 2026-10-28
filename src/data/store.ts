import { useSyncExternalStore } from 'react';
import { bridge } from '../bridge';
import { L, lang } from '../i18n';
import * as logic from './logic';
import type { Action, Fx, Result } from './logic';
import { newUid } from './seed';
import type { Avatar, DeptId, Employee, GameState, Role, Rot } from './types';

/**
 * Store del cliente. El mundo vive en el servidor (`server/`), que lo reparte
 * en vivo por Server-Sent Events. Cada acción se aplica aquí al instante con
 * las mismas reglas que usa el servidor (`logic.ts`) y queda "pendiente" hasta
 * que el servidor la confirma; si la rechaza, se deshace y se avisa.
 */

export type { MissionStatus, Result } from './logic';
export {
  TEAM_DAILY_TARGET,
  achievementValue,
  activeMeetingFor,
  canAward,
  canOpenChest,
  canPlace,
  canSchedule,
  firstName,
  hasAllDecor,
  kudosLeft,
  meetingIncludes,
  meetingWhen,
  missionStatus,
  officeFund,
  officeScore,
  today,
} from './logic';

const EMPTY: GameState = { version: 1, employees: {}, currentUserId: null, feed: [] };

export interface SessionUser {
  id: string;
  username: string;
  mustChange: boolean;
}

export type SessionStatus = 'loading' | 'out' | 'mustChange' | 'in';
export type Connection = 'connecting' | 'online' | 'offline';

interface Pending {
  id: string;
  action: Action;
  /** Revisión del servidor que ya incluye esta acción (llega con la respuesta del POST). */
  ackRev?: number;
}

let base: GameState = EMPTY;
let baseRev = 0;
let pending: Pending[] = [];
let state: GameState = EMPTY;
let user: SessionUser | null = null;
let status: SessionStatus = 'loading';
let connection: Connection = 'connecting';
let events: EventSource | null = null;

const listeners = new Set<() => void>();
const errorListeners = new Set<(message: string) => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

function syncError(message: string): void {
  for (const fn of errorListeners) fn(message);
}

/** Estado visible = lo último del servidor + lo que aún no confirma. */
function recompute(): void {
  const me = user?.id ?? null;
  let s: GameState = { ...base, currentUserId: me };
  if (me !== null) for (const p of pending) s = logic.applyAction(s, me, p.action).state;
  state = s;
  notify();
}

function playFx(fx: Fx[]): void {
  for (const f of fx) {
    if (f.kind === 'coins') bridge.emit('fx:coins', f.id, f.amount);
    else if (f.kind === 'levelup') bridge.emit('fx:levelup', f.id, f.level);
    else if (f.kind === 'kudos') bridge.emit('fx:kudos', f.from, f.to);
    else if (f.kind === 'gift') bridge.emit('fx:gift', f.from, f.to, f.itemId);
    else if (f.kind === 'achievement') bridge.emit('fx:achievement', f.id, f.achievementId);
    else if (f.kind === 'purchase') bridge.emit('fx:purchase', f.id, f.itemId);
    else if (f.kind === 'contribute') bridge.emit('fx:contribute', f.id, f.amount);
    else bridge.emit('fx:expansion', f.level);
  }
}

export function getState(): GameState {
  return state;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useGame<T>(selector: (s: GameState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export function useSession(): { status: SessionStatus; user: SessionUser | null; connection: Connection } {
  const st = useSyncExternalStore(subscribe, () => status);
  const u = useSyncExternalStore(subscribe, () => user);
  const c = useSyncExternalStore(subscribe, () => connection);
  return { status: st, user: u, connection: c };
}

/** Errores de sincronización (acción rechazada, sin conexión) para mostrarlos como aviso. */
export function onSyncError(fn: (message: string) => void): () => void {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
}

export function currentUser(): Employee | undefined {
  return state.currentUserId === null ? undefined : state.employees[state.currentUserId];
}

export function teamCoinsToday(feed = state.feed): number {
  return logic.teamCoinsToday(feed);
}

export function freePlot(dept: DeptId): number | null {
  return logic.freePlot(state, dept);
}

// ---------------------------------------------------------------------------
// Red
// ---------------------------------------------------------------------------

/** Eventos del servidor que escuchan otros módulos (chat, avisos, presencia). */
const serverHandlers = new Map<string, Set<(data: unknown) => void>>();
const sessionHooks = new Set<(userId: string | null) => void>();

export function onServerEvent<T>(name: string, fn: (data: T) => void): () => void {
  let set = serverHandlers.get(name);
  if (set === undefined) {
    set = new Set();
    serverHandlers.set(name, set);
    if (events !== null) attach(events, name);
  }
  set.add(fn as (data: unknown) => void);
  return () => set.delete(fn as (data: unknown) => void);
}

/** Se llama al conectar (con el id de la persona) y al salir (null). */
export function onSessionChange(fn: (userId: string | null) => void): () => void {
  sessionHooks.add(fn);
  return () => sessionHooks.delete(fn);
}

function attach(es: EventSource, name: string): void {
  es.addEventListener(name, ((e: MessageEvent<string>) => {
    if (events !== es) return;
    const data: unknown = JSON.parse(e.data);
    for (const fn of serverHandlers.get(name) ?? []) fn(data);
  }) as EventListener);
}

export async function api<T = Result>(path: string, body?: unknown): Promise<T & { ok: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? { 'X-Lang': lang() } : { 'Content-Type': 'application/json', 'X-Oficina-Viva': '1', 'X-Lang': lang() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; message?: string };
    if (res.status === 401 && path !== 'login' && path !== 'password') sessionLost();
    return { ...data, ok: res.ok && data.ok !== false, message: data.message ?? (res.ok ? '' : L('Error del servidor.', 'Server error.')) };
  } catch {
    return { ok: false, message: L('Sin conexión con el servidor.', 'No connection to the server.') } as T & { ok: boolean; message: string };
  }
}

function applyServer(msg: { rev: number; state: GameState; fx?: Fx[]; actionId?: string }): void {
  if (msg.rev < baseRev) return;
  const mine = msg.actionId !== undefined && pending.some((p) => p.id === msg.actionId);
  base = msg.state;
  baseRev = msg.rev;
  pending = pending.filter((p) => p.id !== msg.actionId && !(p.ackRev !== undefined && p.ackRev <= msg.rev));
  // Los efectos de mis propias acciones ya se vieron al hacer clic.
  if (!mine && msg.fx) playFx(msg.fx);
  recompute();
}

function connect(): void {
  events?.close();
  connection = 'connecting';
  notify();
  const es = new EventSource('/api/events');
  events = es;
  const onData = (e: MessageEvent<string>) => {
    if (events !== es) return;
    connection = 'online';
    applyServer(JSON.parse(e.data));
  };
  es.addEventListener('snapshot', ((e: MessageEvent<string>) => {
    const wasOffline = connection !== 'online';
    onData(e);
    // Al (re)conectar se recargan avisos y chats: pudo llegar algo mientras no estábamos.
    if (wasOffline) for (const fn of sessionHooks) fn(user?.id ?? null);
  }) as EventListener);
  es.addEventListener('update', onData as EventListener);
  for (const name of serverHandlers.keys()) attach(es, name);
  es.onerror = () => {
    if (events !== es) return;
    connection = 'offline';
    notify();
    // Si el servidor se reinicia, el navegador reintenta solo. Si respondió con
    // error (sesión vencida, contraseña restablecida), la conexión queda cerrada:
    // se revisa la sesión y, si sigue válida, se reintenta.
    if (es.readyState !== EventSource.CLOSED) return;
    void api<{ user: SessionUser | null }>('session').then((r) => {
      if (events !== es) return;
      if (r.ok && r.user === null) sessionLost();
      else if (r.ok && r.user?.mustChange) setUser(r.user);
      else window.setTimeout(() => events === es && connect(), 3000);
    });
  };
}

function disconnect(): void {
  events?.close();
  events = null;
  base = EMPTY;
  baseRev = 0;
  pending = [];
}

function setUser(u: SessionUser | null): void {
  user = u;
  status = u === null ? 'out' : u.mustChange ? 'mustChange' : 'in';
  if (status === 'in') connect();
  else {
    disconnect();
    for (const fn of sessionHooks) fn(null);
  }
  recompute();
}

function sessionLost(): void {
  if (user === null) return;
  bridge.emit('decor:mode', null);
  setUser(null);
  syncError(L('Tu sesión terminó. Vuelve a entrar.', 'Your session ended. Please log in again.'));
}

/** Al cargar la página: ¿hay una sesión abierta? */
async function restoreSession(): Promise<void> {
  const r = await api<{ user: SessionUser | null }>('session');
  if (!r.ok) syncError(r.message || L('Sin conexión con el servidor.', 'No connection to the server.'));
  setUser(r.ok ? r.user : null);
}

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

export async function login(username: string, password: string): Promise<Result> {
  const r = await api<{ user?: SessionUser }>('login', { username, password });
  if (!r.ok || r.user === undefined) return { ok: false, message: r.message || L('No se pudo entrar.', "Couldn't log in.") };
  setUser(r.user);
  return { ok: true, message: L(`Hola, ${r.user.username}`, `Hi, ${r.user.username}`) };
}

export function logout(): void {
  bridge.emit('decor:mode', null);
  void api('logout', {});
  setUser(null);
}

export async function changePassword(current: string, next: string): Promise<Result> {
  const r = await api<{ user?: SessionUser }>('password', { current, next });
  if (!r.ok) return { ok: false, message: r.message || L('No se pudo cambiar.', "Couldn't change it.") };
  if (r.user) setUser(r.user);
  return { ok: true, message: r.message || L('Contraseña actualizada.', 'Password updated.') };
}

// ---------------------------------------------------------------------------
// Acciones del juego: se aplican ya y se confirman con el servidor
// ---------------------------------------------------------------------------

function act(action: Action): Result {
  const me = user?.id;
  if (me === undefined || status !== 'in') return { ok: false, message: L('Inicia sesión primero.', 'Log in first.') };
  const out = logic.applyAction(state, me, action);
  if (!out.result.ok) return out.result;
  const p: Pending = { id: newUid('q'), action };
  pending.push(p);
  playFx(out.fx);
  recompute();
  void api<{ rev?: number }>('action', { id: p.id, action }).then((r) => {
    if (!pending.includes(p)) return;
    if (r.ok && r.rev !== undefined) {
      p.ackRev = r.rev;
      if (r.rev <= baseRev) pending = pending.filter((x) => x !== p);
    } else {
      // El servidor no la aceptó (otra persona se adelantó, sin conexión…): se deshace.
      pending = pending.filter((x) => x !== p);
      syncError(r.message || L('No se pudo guardar el cambio.', "Couldn't save the change."));
    }
    recompute();
  });
  return out.result;
}

export const award = (targetId: string, awardId: string, note: string, customCoins?: number) =>
  act({ type: 'award', targetId, awardId, note: note.slice(0, 140), customCoins });
export const giveKudos = (toId: string, message: string) => act({ type: 'kudos', toId, message: message.slice(0, 140) });
export const checkIn = () => act({ type: 'checkIn' });
export const claimDailyBonus = () => act({ type: 'claimBonus' });
export const buyItem = (itemId: string) => act({ type: 'buyItem', itemId });
export const buyFloor = (floorId: string) => act({ type: 'buyFloor', floorId });
export const setFloor = (floorId: string) => act({ type: 'setFloor', floorId });
export const placeFromInventory = (itemId: string, x: number, y: number, rot: Rot) =>
  act({ type: 'place', uid: newUid('i'), itemId, x, y, rot });
export const moveItem = (uid: string, x: number, y: number, rot: Rot) => act({ type: 'move', uid, x, y, rot });
export const storeItem = (uid: string) => act({ type: 'store', uid });

/** Avisa en el feed que alguien remodeló; se llama al cerrar una sesión de decoración con cambios. */
export function announceDecor(employeeId: string): void {
  if (employeeId === user?.id) act({ type: 'announceDecor' });
}

export function updateAvatar(avatar: Avatar): void {
  act({ type: 'avatar', avatar });
}

export const giftItem = (toId: string, itemId: string, message: string) => act({ type: 'gift', toId, itemId, message: message.slice(0, 140) });
export const buyCosmetic = (cosmeticId: string) => act({ type: 'buyCosmetic', cosmeticId });
export const openChest = () => act({ type: 'openChest' });
export const contribute = (amount: number) => act({ type: 'contribute', amount: Math.floor(amount) });
export const scheduleMeeting = (title: string, start: number, durationMin: number, attendees: string[]) =>
  act({ type: 'scheduleMeeting', id: newUid('r'), title: title.slice(0, 80), start, durationMin, attendees });
export const startMeeting = (id: string) => act({ type: 'startMeeting', id });
export const endMeeting = (id: string) => act({ type: 'endMeeting', id });
export const cancelMeeting = (id: string) => act({ type: 'cancelMeeting', id });
export const announce = (title: string, body: string) => act({ type: 'announce', id: newUid('v'), title: title.slice(0, 100), body: body.slice(0, 1000) });
export const deleteAnnouncement = (id: string) => act({ type: 'deleteAnnouncement', id });

// ---------------------------------------------------------------------------
// Administración (sin aplicación inmediata: también tocan las cuentas)
// ---------------------------------------------------------------------------

export interface AccountInfo {
  employeeId: string;
  username: string;
  mustChange: boolean;
}

export type Credentials = Result & { username?: string; password?: string };

export async function listAccounts(): Promise<AccountInfo[]> {
  try {
    const res = await fetch('/api/admin/accounts', { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as AccountInfo[]) : [];
  } catch {
    return [];
  }
}

export async function addEmployee(
  name: string,
  title: string,
  dept: DeptId,
  role: Role,
  body: 0 | 1,
  username?: string,
): Promise<Credentials> {
  const r = await api<{ username?: string; password?: string }>('admin/employees', { name, title, dept, role, body, username });
  return { ...r, message: r.message ?? '' } as Credentials;
}

export async function editEmployee(id: string, edit: { name: string; title: string; role: Role; username: string }): Promise<Result> {
  const r = await api(`admin/employees/${encodeURIComponent(id)}`, edit);
  return { ok: r.ok, message: r.message ?? '' } as Result;
}

export async function removeEmployee(id: string): Promise<Result> {
  const r = await api(`admin/employees/${encodeURIComponent(id)}/delete`, {});
  return { ok: r.ok, message: r.message ?? '' } as Result;
}

export async function resetPassword(id: string): Promise<Credentials> {
  const r = await api<{ username?: string; password?: string }>(`admin/employees/${encodeURIComponent(id)}/password`, {});
  return { ...r, message: r.message ?? '' } as Credentials;
}

void restoreSession();
