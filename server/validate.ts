import { ACCESSORIES, AVATAR_HAIR, AVATAR_PANTS, AVATAR_SHIRT, AVATAR_SKIN, DEPTS, HAIR_STYLES } from '../src/data/catalog';
import type { Action } from '../src/data/logic';
import type { Avatar, DeptId, Role } from '../src/data/types';

/**
 * El cliente puede mandar cualquier cosa: aquí se revisa la forma de cada
 * acción antes de pasarla a las reglas del juego, que revisan el resto.
 */

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
const int = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const rot = (v: unknown): v is 0 | 1 => v === 0 || v === 1;
const isRole = (v: unknown): v is Role => v === 'colaborador' || v === 'jefatura' || v === 'gerente' || v === 'admin';
const optId = (v: unknown): v is string | undefined => v === undefined || id(v);

export const NOTE_MAX = 140;
export const CHAT_MAX = 300;

export function parseAvatar(v: unknown): Avatar | null {
  if (!isObj(v)) return null;
  const ok =
    (v.body === 0 || v.body === 1) &&
    int(v.skin, 0, AVATAR_SKIN.length - 1) &&
    int(v.hair, 0, AVATAR_HAIR.length - 1) &&
    int(v.hairStyle, 0, HAIR_STYLES.length - 1) &&
    int(v.shirt, 0, AVATAR_SHIRT.length - 1) &&
    int(v.pants, 0, AVATAR_PANTS.length - 1) &&
    (v.acc === undefined || int(v.acc, 0, ACCESSORIES.length - 1)) &&
    optId(v.hat) &&
    optId(v.face) &&
    optId(v.neck);
  if (!ok) return null;
  const a: Avatar = {
    body: v.body as 0 | 1,
    skin: v.skin as number,
    hair: v.hair as number,
    hairStyle: v.hairStyle as number,
    shirt: v.shirt as number,
    pants: v.pants as number,
    acc: (v.acc as number | undefined) ?? 0,
  };
  // Las reglas del juego revisan que cada adorno exista y sea de quien lo usa.
  if (v.hat !== undefined) a.hat = v.hat as string;
  if (v.face !== undefined) a.face = v.face as string;
  if (v.neck !== undefined) a.neck = v.neck as string;
  return a;
}

/** Devuelve la acción con solo los campos conocidos, o null si viene mal formada. */
export function parseAction(v: unknown): Action | null {
  if (!isObj(v) || typeof v.type !== 'string') return null;
  switch (v.type) {
    case 'award':
      if (!id(v.targetId) || !id(v.awardId) || !str(v.note, NOTE_MAX)) return null;
      if (v.customCoins !== undefined && !int(v.customCoins, 1, 500)) return null;
      return { type: 'award', targetId: v.targetId, awardId: v.awardId, note: v.note, customCoins: v.customCoins as number | undefined };
    case 'kudos':
      if (!id(v.toId) || !str(v.message, NOTE_MAX)) return null;
      return { type: 'kudos', toId: v.toId, message: v.message };
    case 'checkIn':
    case 'claimBonus':
    case 'openChest':
    case 'announceDecor':
      return { type: v.type };
    case 'buyItem':
      return id(v.itemId) ? { type: 'buyItem', itemId: v.itemId } : null;
    case 'buyCosmetic':
      return id(v.cosmeticId) ? { type: 'buyCosmetic', cosmeticId: v.cosmeticId } : null;
    case 'buyFloor':
    case 'setFloor':
      return id(v.floorId) ? { type: v.type, floorId: v.floorId } : null;
    case 'place':
      if (!id(v.uid) || !id(v.itemId) || !int(v.x, -64, 64) || !int(v.y, -64, 64) || !rot(v.rot)) return null;
      return { type: 'place', uid: v.uid, itemId: v.itemId, x: v.x, y: v.y, rot: v.rot };
    case 'move':
      if (!id(v.uid) || !int(v.x, -64, 64) || !int(v.y, -64, 64) || !rot(v.rot)) return null;
      return { type: 'move', uid: v.uid, x: v.x, y: v.y, rot: v.rot };
    case 'store':
      return id(v.uid) ? { type: 'store', uid: v.uid } : null;
    case 'avatar': {
      const avatar = parseAvatar(v.avatar);
      return avatar ? { type: 'avatar', avatar } : null;
    }
    case 'gift':
      if (!id(v.toId) || !id(v.itemId) || !str(v.message, NOTE_MAX)) return null;
      return { type: 'gift', toId: v.toId, itemId: v.itemId, message: v.message };
    case 'scheduleMeeting': {
      if (!id(v.id) || !str(v.title, 80) || !Number.isSafeInteger(v.start) || !int(v.durationMin, 1, 24 * 60)) return null;
      if (!Array.isArray(v.attendees) || v.attendees.length > 100 || !v.attendees.every(id)) return null;
      return { type: 'scheduleMeeting', id: v.id, title: v.title, start: v.start as number, durationMin: v.durationMin, attendees: v.attendees as string[] };
    }
    case 'startMeeting':
    case 'endMeeting':
    case 'cancelMeeting':
    case 'deleteAnnouncement':
      return id(v.id) ? { type: v.type, id: v.id } : null;
    case 'contribute':
      // El mínimo (10) lo revisan las reglas, que explican el motivo.
      return int(v.amount, 1, 100_000) ? { type: 'contribute', amount: v.amount } : null;
    case 'announce':
      if (!id(v.id) || !str(v.title, 100) || !str(v.body, 1000)) return null;
      return { type: 'announce', id: v.id, title: v.title, body: v.body };
    default:
      return null;
  }
}

/** Texto de chat: sin caracteres de control y con largo acotado. */
export function parseChatText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const text = v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
  return text.length > 0 && text.length <= CHAT_MAX ? text : null;
}

export function parseId(v: unknown): string | null {
  return id(v) ? v : null;
}

export interface NewEmployee {
  name: string;
  title: string;
  dept: DeptId;
  role: Role;
  body: 0 | 1;
  username?: string;
}

export interface EmployeeEdit {
  name: string;
  title: string;
  role: Role;
  username: string;
}

export function parseEmployeeEdit(v: unknown): EmployeeEdit | null {
  if (!isObj(v) || !str(v.name, 60) || !str(v.title, 60) || !str(v.username, 40)) return null;
  if (!isRole(v.role)) return null;
  return { name: v.name, title: v.title, role: v.role, username: v.username.trim().toLowerCase() };
}

export function parseNewEmployee(v: unknown): NewEmployee | null {
  if (!isObj(v)) return null;
  if (!str(v.name, 60) || !str(v.title, 60)) return null;
  if (!DEPTS.includes(v.dept as DeptId)) return null;
  if (!isRole(v.role)) return null;
  if (v.body !== 0 && v.body !== 1) return null;
  if (v.username !== undefined && v.username !== '' && !str(v.username, 40)) return null;
  return {
    name: v.name,
    title: v.title,
    dept: v.dept as DeptId,
    role: v.role,
    body: v.body,
    username: typeof v.username === 'string' && v.username.trim() ? v.username.trim().toLowerCase() : undefined,
  };
}
