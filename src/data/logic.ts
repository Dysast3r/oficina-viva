import {
  AWARDS,
  CHECKIN_COINS,
  COSMETIC_BY_ID,
  DAILY_BONUS,
  FLOOR_BY_ID,
  ITEM_BY_ID,
  KUDOS_COINS,
  KUDOS_PER_DAY,
  ROOMS,
  STREAK_BONUS,
  STREAK_EVERY,
  levelForXp,
} from './catalog';
import {
  EXPANSIONS,
  MAP_H,
  MAP_W,
  PLOTS,
  activeStaticItems,
  canCross,
  footprint,
  inRect,
  isDoorTile,
  plotCount,
  plotRect,
  roomAt,
  setBuiltLevel,
  type Rect,
} from './layout';
import {
  ACHIEVEMENTS,
  LEVEL_REWARD_PER_LEVEL,
  MEETING_REWARD,
  PUNCTUAL_BONUS,
  TEAM_GOAL_REWARD,
  WEEKLY_MISSIONS,
  chestReward,
  dailyMissionsFor,
  weekKey,
  type AchievementDef,
  type Counter,
  type MissionDef,
} from './progress';
import { L } from '../i18n';
import { meetingWhen, msg, spanishText, type Msg } from './messages';
import { TIME_ZONE, checkInBlockedReason, isWorkDay, officeClock, previousWorkDay, shiftOn } from './schedule';
import { makeEmployee, newUid } from './seed';
import type {
  ActivityEvent,
  ActivityKind,
  Avatar,
  DeptId,
  Employee,
  GameState,
  Meeting,
  MissionProgress,
  NotificationKind,
  OfficeFund,
  Role,
  Rot,
} from './types';

/**
 * Reglas del juego, sin efectos secundarios. Las usa el servidor (que tiene la
 * última palabra) y el cliente (que aplica la acción al instante mientras el
 * servidor la confirma). Toda acción recibe quién la hace: nunca se confía en
 * un "usuario actual" global.
 */

const FEED_MAX = 80;
const ANNOUNCEMENTS_MAX = 30;

// Las fechas del juego (racha, misiones, kudos) siguen el día de la oficina, no el del equipo de cada uno.
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Día "AAAA-MM-DD" de un instante, en hora de la oficina. */
export function dayKey(ts: number): string {
  return dayFormat.format(ts);
}

export function today(): string {
  return dayKey(Date.now());
}

export function isToday(ts: number): boolean {
  return dayKey(ts) === today();
}

export function firstName(e: Employee): string {
  return e.name.split(' ')[0];
}

/** Puntaje de estilo del puesto: suma de lo colocado más el piso. */
export function officeScore(e: Employee): number {
  const items = e.placed.reduce((sum, p) => sum + (ITEM_BY_ID[p.itemId]?.style ?? 0), 0);
  const floor = e.floor === 'sala' ? 0 : FLOOR_BY_ID[e.floor]?.style ?? 0;
  return items + floor;
}

export function canAward(actor: Employee | undefined, target: Employee): boolean {
  if (actor === undefined || actor.id === target.id) return false;
  if (actor.role === 'admin' || actor.role === 'gerente') return true;
  return actor.role === 'jefatura' && actor.dept === target.dept;
}

/** Administración tiene todas las decoraciones y adornos gratis y sin nivel mínimo, y puede regalarlos. */
export function hasAllDecor(e: Employee | undefined): boolean {
  return e?.role === 'admin';
}

/** Quién puede agendar reuniones. */
export function canSchedule(e: Employee | undefined): boolean {
  return e !== undefined && e.role !== 'colaborador';
}

export function kudosLeft(e: Employee): number {
  return e.kudosGiven.date === today() ? Math.max(0, KUDOS_PER_DAY - e.kudosGiven.count) : KUDOS_PER_DAY;
}

/** Meta diaria de monedas por desempeño para todo el equipo (barra de productividad). */
export const TEAM_DAILY_TARGET = 400;

export function teamCoinsToday(feed: ActivityEvent[]): number {
  return feed.filter((f) => f.kind === 'award' && isToday(f.ts)).reduce((sum, f) => sum + (f.amount ?? 0), 0);
}

/** ¿Cabe `itemId` en (x,y) relativo al puesto, ignorando el objeto `ignoreUid`? */
/** Salas donde no se puede decorar (salvo quien tiene ahí su propio puesto). */
export const NO_DECOR_ROOMS: readonly string[] = ['gerencia'];

/**
 * ¿Se puede dejar este objeto ahí? `x`, `y` son relativos al puesto de la
 * persona (pueden ser negativos o pasarse del puesto: se decora en cualquier
 * sala menos Gerencia). Devuelve el motivo si no se puede, o null.
 *
 * Fuera del propio puesto el objeto no puede pisar otro puesto, una puerta,
 * otro mueble, ni cortar el paso: todo lo que antes se alcanzaba caminando
 * (incluidas las sillas) se tiene que seguir alcanzando.
 */
export function placeProblem(s: GameState, e: Employee, itemId: string, x: number, y: number, rot: Rot, ignoreUid?: string): string | null {
  const def = ITEM_BY_ID[itemId];
  if (def === undefined) return L('Objeto desconocido.', 'Unknown item.');
  // Las salas construidas dependen del fondo; así cliente y servidor ven las mismas.
  setBuiltLevel(officeFund(s).level);
  const own = plotRect(e.dept, e.plot);
  const f = footprint(itemId, own.x + x, own.y + y, rot);
  const tiles: { x: number; y: number }[] = [];
  for (let j = 0; j < f.d; j++) for (let i = 0; i < f.w; i++) tiles.push({ x: f.x + i, y: f.y + j });

  const rooms = new Set<string>();
  const outside = tiles.filter((t) => !inRect(own, t.x, t.y));
  for (const t of tiles) {
    const room = roomAt(t.x, t.y);
    if (room === null) return L('Ahí no hay oficina.', "There's no office there.");
    rooms.add(room.id);
  }
  if (rooms.size > 1) return L('Tiene que quedar dentro de una sola sala.', 'It has to fit inside a single room.');
  for (const t of outside) {
    const room = roomAt(t.x, t.y);
    if (room !== null && NO_DECOR_ROOMS.includes(room.id)) return L(`En ${ROOMS[room.id].name} no se pueden poner adornos.`, `You can't decorate in ${ROOMS[room.id].name}.`);
    if (Object.values(PLOTS).some((list) => list.some((p) => inRect(p, t.x, t.y)))) {
      const owner = Object.values(s.employees).find((o) => inRect(plotRect(o.dept, o.plot), t.x, t.y));
      return owner ? L(`Ese es el puesto de ${firstName(owner)}.`, `That's ${firstName(owner)}'s desk.`) : L('Ese espacio es un puesto de trabajo.', 'That space is a workstation.');
    }
    if (!def.flat && isDoorTile(t.x, t.y)) return L('Taparía una puerta.', 'It would block a door.');
  }

  const hit = (g: Rect) => f.x < g.x + g.w && g.x < f.x + f.w && f.y < g.y + g.h && g.y < f.y + f.d;
  for (const st of activeStaticItems()) {
    if (Boolean(ITEM_BY_ID[st.itemId]?.flat) !== Boolean(def.flat)) continue;
    const g = footprint(st.itemId, st.x, st.y, st.rot);
    if (hit({ x: g.x, y: g.y, w: g.w, h: g.d })) return L('Choca con otro mueble.', 'It overlaps another piece of furniture.');
  }
  for (const o of Object.values(s.employees)) {
    const r = plotRect(o.dept, o.plot);
    for (const p of o.placed) {
      if (p.uid === ignoreUid) continue;
      // Lo plano (alfombras) solo choca con lo plano; los muebles con muebles.
      if (Boolean(ITEM_BY_ID[p.itemId]?.flat) !== Boolean(def.flat)) continue;
      const g = footprint(p.itemId, r.x + p.x, r.y + p.y, p.rot);
      if (hit({ x: g.x, y: g.y, w: g.w, h: g.d })) return o.id === e.id ? L('Choca con otro de tus objetos.', 'It overlaps another of your items.') : L(`Choca con un objeto de ${firstName(o)}.`, `It overlaps one of ${firstName(o)}'s items.`);
    }
  }
  if (!def.flat && outside.length > 0 && blocksTheWay(s, tiles, ignoreUid)) return L('Cortaría el paso.', 'It would block the way.');
  return null;
}

export function canPlace(s: GameState, e: Employee, itemId: string, x: number, y: number, rot: Rot, ignoreUid?: string): boolean {
  return placeProblem(s, e, itemId, x, y, rot, ignoreUid) === null;
}

/**
 * ¿Ocupar `tiles` deja algún lugar sin acceso? Compara lo alcanzable desde
 * una puerta antes y después, y revisa que toda silla siga teniendo un lado
 * libre al que se llega.
 */
function blocksTheWay(s: GameState, tiles: { x: number; y: number }[], ignoreUid?: string): boolean {
  const blocked = new Set<string>();
  const seats: { x: number; y: number }[] = [];
  const mark = (itemId: string, x: number, y: number, rot: Rot) => {
    const def = ITEM_BY_ID[itemId];
    if (def === undefined || def.flat) return;
    if (def.seat) seats.push({ x, y });
    const g = footprint(itemId, x, y, rot);
    for (let j = 0; j < g.d; j++) for (let i = 0; i < g.w; i++) blocked.add(`${g.x + i},${g.y + j}`);
  };
  for (const st of activeStaticItems()) mark(st.itemId, st.x, st.y, st.rot);
  for (const o of Object.values(s.employees)) {
    const r = plotRect(o.dept, o.plot);
    for (const p of o.placed) if (p.uid !== ignoreUid) mark(p.itemId, r.x + p.x, r.y + p.y, p.rot);
  }
  // Partida: una baldosa libre junto a una puerta (las puertas nunca se tapan).
  let start: { x: number; y: number } | null = null;
  for (let y = 0; y < MAP_H && start === null; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (roomAt(x, y) !== null && isDoorTile(x, y) && !blocked.has(`${x},${y}`)) {
        start = { x, y };
        break;
      }
    }
  }
  if (start === null) return false;
  const reach = (extra: Set<string>): Set<string> => {
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const queue = [start];
    while (queue.length > 0) {
      const p = queue.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { x: p.x + dx, y: p.y + dy };
        const k = `${n.x},${n.y}`;
        if (seen.has(k) || blocked.has(k) || extra.has(k) || !canCross(p.x, p.y, n.x, n.y)) continue;
        seen.add(k);
        queue.push(n);
      }
    }
    return seen;
  };
  const added = new Set(tiles.map((t) => `${t.x},${t.y}`));
  const before = reach(new Set());
  const after = reach(added);
  for (const k of before) if (!added.has(k) && !after.has(k)) return true;
  // Cada silla necesita al menos un vecino al que se llegue.
  for (const c of seats) {
    const had = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => before.has(`${c.x + dx},${c.y + dy}`));
    const has = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => after.has(`${c.x + dx},${c.y + dy}`));
    if (had && !has) return true;
  }
  return false;
}

export function freePlot(s: GameState, dept: DeptId): number | null {
  const used = new Set(Object.values(s.employees).filter((e) => e.dept === dept).map((e) => e.plot));
  for (let i = 0; i < plotCount(dept); i++) if (!used.has(i)) return i;
  return null;
}

// ---------------------------------------------------------------------------
// Misiones, logros y reuniones (lectura)
// ---------------------------------------------------------------------------

function period(p: MissionProgress | undefined, key: string): MissionProgress {
  return p?.key === key ? p : { key, counters: {}, done: [] };
}

export interface MissionStatus extends MissionDef {
  progress: number;
  done: boolean;
}

/** Misiones de hoy (vacías fuera de días laborales) y de la semana, con su avance. */
export function missionStatus(e: Employee): { daily: MissionStatus[]; weekly: MissionStatus[] } {
  const day = today();
  const d = period(e.daily, day);
  const w = period(e.weekly, weekKey(day));
  const status = (defs: MissionDef[], p: MissionProgress) =>
    defs.map((m) => ({ ...m, progress: Math.min(m.target, p.counters[m.counter] ?? 0), done: p.done.includes(m.id) }));
  return { daily: isWorkDay(day) ? status(dailyMissionsFor(e.id, day), d) : [], weekly: status(WEEKLY_MISSIONS, w) };
}

export function achievementValue(e: Employee, a: AchievementDef): number {
  switch (a.stat) {
    case 'level':
      return levelForXp(e.xp);
    case 'style':
      return officeScore(e);
    case 'bestStreak':
      return Math.max(e.stats?.bestStreak ?? 0, e.streak);
    case 'legendary': {
      const owned = [...e.placed.map((p) => p.itemId), ...Object.keys(e.inventory)];
      return owned.filter((id) => ITEM_BY_ID[id]?.category === 'legendario').length;
    }
    default:
      return e.stats?.[a.stat] ?? 0;
  }
}

export function canOpenChest(e: Employee): boolean {
  const day = today();
  return isWorkDay(day) && e.chestDate !== day;
}

export function meetingIncludes(m: Meeting, id: string): boolean {
  return m.attendees.length === 0 || m.attendees.includes(id);
}

/** Reunión en curso a la que debe ir `id`, si la hay. */
export function activeMeetingFor(s: GameState, id: string): Meeting | undefined {
  return (s.meetings ?? []).find((m) => m.status === 'active' && meetingIncludes(m, id));
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

export type Result = { ok: true; message: string } | { ok: false; message: string };

/** Efectos visuales que provoca una acción; el servidor los reparte a todos los conectados. */
export type Fx =
  | { kind: 'coins'; id: string; amount: number }
  | { kind: 'levelup'; id: string; level: number }
  | { kind: 'kudos'; from: string; to: string }
  | { kind: 'gift'; from: string; to: string; itemId: string }
  | { kind: 'achievement'; id: string; achievementId: string }
  /** Compra: el objeto (o adorno) aparece sobre la cabeza de quien lo compró. */
  | { kind: 'purchase'; id: string; itemId: string }
  /** Aporte al fondo: monedas que vuelan hacia la obra. */
  | { kind: 'contribute'; id: string; amount: number }
  /** Se construyó una ampliación. */
  | { kind: 'expansion'; level: number };

/** Aviso personal que el servidor guarda y entrega solo a sus destinatarios. */
export interface NotifyReq {
  to: string[] | 'all';
  kind: NotificationKind;
  title: Msg;
  body?: Msg;
  data?: Record<string, string | number>;
}

/** Lo que un colaborador puede hacer en el mundo. Lo administrativo de cuentas va aparte. */
export type Action =
  | { type: 'award'; targetId: string; awardId: string; note: string; customCoins?: number }
  | { type: 'kudos'; toId: string; message: string }
  | { type: 'checkIn' }
  | { type: 'claimBonus' }
  | { type: 'openChest' }
  | { type: 'buyItem'; itemId: string }
  | { type: 'buyFloor'; floorId: string }
  | { type: 'buyCosmetic'; cosmeticId: string }
  | { type: 'setFloor'; floorId: string }
  | { type: 'place'; uid: string; itemId: string; x: number; y: number; rot: Rot }
  | { type: 'move'; uid: string; x: number; y: number; rot: Rot }
  | { type: 'store'; uid: string }
  | { type: 'announceDecor' }
  | { type: 'avatar'; avatar: Avatar }
  | { type: 'gift'; toId: string; itemId: string; message: string }
  | { type: 'scheduleMeeting'; id: string; title: string; start: number; durationMin: number; attendees: string[] }
  | { type: 'startMeeting'; id: string }
  | { type: 'endMeeting'; id: string }
  | { type: 'cancelMeeting'; id: string }
  | { type: 'announce'; id: string; title: string; body: string }
  | { type: 'deleteAnnouncement'; id: string }
  | { type: 'contribute'; amount: number };

export interface Outcome {
  state: GameState;
  result: Result;
  fx: Fx[];
  notify: NotifyReq[];
}

function event(kind: ActivityKind, targetId: string, m: Msg, extra: Partial<ActivityEvent> = {}): ActivityEvent {
  return { id: newUid('a'), ts: Date.now(), kind, targetId, text: spanishText(m), msg: m, ...extra };
}

/**
 * Estado de trabajo de una acción: acumula cambios, efectos, avisos y eventos
 * del feed. Al terminar revisa misiones y logros de quienes cambiaron, que a su
 * vez pueden dar monedas (y subir de nivel, y desbloquear otro logro…).
 */
class Ctx {
  s: GameState;
  fx: Fx[] = [];
  notify: NotifyReq[] = [];
  events: ActivityEvent[] = [];
  private touched = new Set<string>();

  constructor(s: GameState) {
    this.s = s;
  }

  emp(id: string): Employee {
    return this.s.employees[id];
  }

  patch(id: string, p: Partial<Employee>): void {
    this.s = { ...this.s, employees: { ...this.s.employees, [id]: { ...this.s.employees[id], ...p } } };
    this.touched.add(id);
  }

  feed(kind: ActivityKind, targetId: string, m: Msg, extra: Partial<ActivityEvent> = {}): void {
    this.events.push(event(kind, targetId, m, extra));
  }

  tell(to: string[] | 'all', kind: NotificationKind, title: Msg, body?: Msg, data?: Record<string, string | number>): void {
    this.notify.push({ to, kind, title, ...(body ? { body } : {}), ...(data ? { data } : {}) });
  }

  /** Suma monedas (y XP, salvo `xp: false`). Subir de nivel da un premio extra en monedas. */
  grant(id: string, amount: number, xp = true): void {
    const e = this.emp(id);
    if (e === undefined || amount <= 0) return;
    const before = levelForXp(e.xp);
    const nextXp = xp ? e.xp + amount : e.xp;
    const after = levelForXp(nextXp);
    this.patch(id, { coins: e.coins + amount, xp: nextXp });
    this.fx.push({ kind: 'coins', id, amount });
    if (after > before) {
      const bonus = after * LEVEL_REWARD_PER_LEVEL;
      this.fx.push({ kind: 'levelup', id, level: after });
      this.feed('levelup', id, msg('levelUp', { name: e.name, level: after }));
      this.tell([id], 'levelup', msg('levelUpTitle', { level: after }), msg('levelUpBody', { bonus }));
      this.grant(id, bonus, false);
    }
  }

  /** Cuenta un evento para misiones y logros. */
  bump(id: string, counter: Counter, n = 1): void {
    const e = this.emp(id);
    if (e === undefined) return;
    const day = today();
    const d = period(e.daily, day);
    const w = period(e.weekly, weekKey(day));
    this.patch(id, {
      stats: { ...e.stats, [counter]: (e.stats?.[counter] ?? 0) + n },
      daily: { ...d, counters: { ...d.counters, [counter]: (d.counters[counter] ?? 0) + n } },
      weekly: { ...w, counters: { ...w.counters, [counter]: (w.counters[counter] ?? 0) + n } },
    });
    this.payMissions(id);
  }

  private payMissions(id: string): void {
    const e = this.emp(id);
    const day = today();
    const pay = (which: 'daily' | 'weekly', defs: MissionDef[], key: string) => {
      for (const m of defs) {
        // Se relee en cada vuelta: pagar una misión cambia el progreso (contador "missions").
        const p = period(this.emp(id)[which], key);
        if (p.done.includes(m.id) || (p.counters[m.counter] ?? 0) < m.target) continue;
        const next = { ...p, done: [...p.done, m.id] };
        this.patch(id, which === 'daily' ? { daily: next } : { weekly: next });
        this.grant(id, m.reward);
        this.tell([id], 'mission', msg('missionDone', { id: m.id }), msg('coins', { n: m.reward }), { icon: m.icon });
        if (which === 'daily') this.bump(id, 'missions');
      }
    };
    if (isWorkDay(day)) pay('daily', dailyMissionsFor(e.id, day), day);
    pay('weekly', WEEKLY_MISSIONS, weekKey(day));
  }

  /** Logros nuevos de quienes cambiaron (puede encadenar: un logro da monedas que suben de nivel…). */
  private checkAchievements(): void {
    for (let pass = 0; pass < 4 && this.touched.size > 0; pass++) {
      const ids = [...this.touched];
      this.touched.clear();
      for (const id of ids) {
        const e = this.emp(id);
        if (e === undefined) continue;
        for (const a of ACHIEVEMENTS) {
          const cur = this.emp(id);
          if (cur.achievements?.includes(a.id) || achievementValue(cur, a) < a.target) continue;
          const wardrobe = a.cosmetic && !cur.wardrobe?.includes(a.cosmetic) ? [...(cur.wardrobe ?? []), a.cosmetic] : cur.wardrobe;
          this.patch(id, { achievements: [...(cur.achievements ?? []), a.id], wardrobe });
          this.fx.push({ kind: 'achievement', id, achievementId: a.id });
          this.feed('achievement', id, msg('achievement', { name: firstName(cur), id: a.id }));
          this.tell([id], 'achievement', msg('achievementTitle', { id: a.id }), msg('achievementBody', { id: a.id }), { achievementId: a.id });
          this.grant(id, a.reward);
        }
      }
    }
  }

  finish(result: Result): Outcome {
    this.checkAchievements();
    const s = this.events.length > 0 ? { ...this.s, feed: [...this.events.reverse(), ...this.s.feed].slice(0, FEED_MAX) } : this.s;
    return { state: s, result, fx: this.fx, notify: this.notify };
  }
}

const MAX_MEETING_MIN = 8 * 60;

/** Aplica `a` hecha por `actorId`. Si falla, devuelve el mismo estado sin tocar. */
export function applyAction(state: GameState, actorId: string, a: Action): Outcome {
  const fail = (message: string): Outcome => ({ state, result: { ok: false, message }, fx: [], notify: [] });
  const me = state.employees[actorId];
  if (me === undefined) return fail(L('Inicia sesión primero.', 'Log in first.'));
  const c = new Ctx(state);
  const ok = (message: string) => c.finish({ ok: true, message });

  switch (a.type) {
    case 'award': {
      const target = state.employees[a.targetId];
      if (target === undefined) return fail(L('Colaborador no encontrado.', 'Team member not found.'));
      if (!canAward(me, target)) return fail(L('No tienes permiso para registrar desempeño de esta persona.', "You don't have permission to log performance for this person."));
      const def = AWARDS.find((d) => d.id === a.awardId);
      const coins = def?.coins ?? Math.round(a.customCoins ?? 0);
      if (!(coins > 0 && coins <= 500)) return fail(L('El monto debe estar entre 1 y 500 monedas.', 'The amount must be between 1 and 500 coins.'));
      const teamBefore = teamCoinsToday(state.feed);
      c.grant(target.id, coins);
      c.bump(target.id, 'awarded');
      const note = a.note.trim();
      c.feed('award', target.id, msg('award', { name: target.name, coins, award: a.awardId, note }), { actorId: me.id, amount: coins });
      c.tell([target.id], 'award', msg('awardTitle', { award: a.awardId, coins }), msg('awardBody', { by: me.name, note }));
      // Meta del equipo: al cruzar el 100 % de productividad, todos ganan.
      if (teamBefore < TEAM_DAILY_TARGET && teamBefore + coins >= TEAM_DAILY_TARGET) {
        for (const id of Object.keys(c.s.employees)) c.grant(id, TEAM_GOAL_REWARD);
        c.feed('team', target.id, msg('teamGoal', { coins: TEAM_GOAL_REWARD }));
        c.tell('all', 'team', msg('teamGoalTitle'), msg('teamGoalBody', { coins: TEAM_GOAL_REWARD }));
      }
      return ok(L(`+${coins} monedas para ${firstName(target)}`, `+${coins} coins for ${firstName(target)}`));
    }

    case 'kudos': {
      const to = state.employees[a.toId];
      if (to === undefined) return fail(L('Colaborador no encontrado.', 'Team member not found.'));
      if (me.id === to.id) return fail(L('Los reconocimientos son para tus compañeros.', 'Recognitions are for your coworkers.'));
      if (kudosLeft(me) <= 0) return fail(L(`Ya diste tus ${KUDOS_PER_DAY} reconocimientos de hoy.`, `You already gave your ${KUDOS_PER_DAY} recognitions today.`));
      const date = today();
      c.patch(me.id, { kudosGiven: { date, count: (me.kudosGiven.date === date ? me.kudosGiven.count : 0) + 1 } });
      c.grant(to.id, KUDOS_COINS);
      // Reconocer también suma: una moneda para quien reconoce.
      c.grant(me.id, 1);
      c.fx.push({ kind: 'kudos', from: me.id, to: to.id });
      c.bump(me.id, 'kudos');
      c.bump(to.id, 'kudosRecv');
      const message = a.message.trim();
      c.feed('kudos', to.id, msg('kudos', { from: firstName(me), to: firstName(to), message }), { actorId: me.id, amount: KUDOS_COINS });
      c.tell([to.id], 'kudos', msg('kudosTitle', { by: me.name }), message ? msg('raw', { text: message }) : msg('coins', { n: KUDOS_COINS }), { fromId: me.id });
      return ok(L(`Reconocimiento enviado a ${firstName(to)}`, `Recognition sent to ${firstName(to)}`));
    }

    case 'checkIn': {
      const date = today();
      if (me.lastCheckIn === date) return fail(L('Ya marcaste asistencia hoy.', 'You already checked in today.'));
      const now = Date.now();
      const blocked = checkInBlockedReason(now);
      if (blocked !== null) return fail(blocked);
      // El fin de semana no corta la racha: cuenta el día laboral anterior.
      const streak = me.lastCheckIn === previousWorkDay(date) ? me.streak + 1 : 1;
      const bonus = streak % STREAK_EVERY === 0 ? STREAK_BONUS : 0;
      const clock = officeClock(now);
      const punctual = clock.minutes <= (shiftOn(clock.weekday)?.start ?? 0);
      const total = CHECKIN_COINS + bonus + (punctual ? PUNCTUAL_BONUS : 0);
      c.patch(me.id, { lastCheckIn: date, streak, stats: { ...me.stats, bestStreak: Math.max(me.stats?.bestStreak ?? 0, streak) } });
      c.grant(me.id, total);
      c.bump(me.id, 'checkin');
      if (punctual) c.bump(me.id, 'punctual');
      const text = bonus
        ? msg('streakBonus', { name: firstName(me), streak, bonus })
        : msg('checkIn', { name: firstName(me), punctual: punctual ? 1 : 0, streak });
      c.feed('checkin', me.id, text, { amount: total });
      return ok(L(`+${total} monedas${punctual ? ' · ¡puntual!' : ''} · racha ${streak}`, `+${total} coins${punctual ? ' · on time!' : ''} · streak ${streak}`));
    }

    case 'claimBonus': {
      if (me.bonusDate === today()) return fail(L('Ya cobraste el bono de hoy.', 'You already claimed today\'s bonus.'));
      if (!isWorkDay(today())) return fail(L('El bono diario es solo en días laborales.', 'The daily bonus is only on workdays.'));
      if (!missionStatus(me).daily.every((m) => m.done)) return fail(L('Completa las tres misiones del día primero.', "Complete today's three missions first."));
      c.patch(me.id, { bonusDate: today() });
      c.grant(me.id, DAILY_BONUS);
      c.feed('checkin', me.id, msg('dailyDone', { name: firstName(me) }), { amount: DAILY_BONUS });
      return ok(L(`¡Misiones cumplidas! +${DAILY_BONUS} monedas`, `Missions complete! +${DAILY_BONUS} coins`));
    }

    case 'openChest': {
      if (!isWorkDay(today())) return fail(L('El cofre se abre en días laborales.', 'The chest opens on workdays.'));
      if (me.chestDate === today()) return fail(L('Ya abriste el cofre de hoy. ¡Vuelve mañana!', 'You already opened today\'s chest. Come back tomorrow!'));
      const reward = chestReward(me.id, today());
      c.patch(me.id, { chestDate: today() });
      c.grant(me.id, reward);
      c.bump(me.id, 'chest');
      if (reward >= 50) c.feed('purchase', me.id, msg('chest', { name: firstName(me), coins: reward }));
      return ok(L(`🧰 ¡El cofre traía ${reward} monedas!`, `🧰 The chest had ${reward} coins!`));
    }

    case 'buyItem': {
      const def = ITEM_BY_ID[a.itemId];
      if (def === undefined || def.hidden) return fail(L('No disponible.', 'Not available.'));
      const free = hasAllDecor(me);
      if (!free && levelForXp(me.xp) < def.level) return fail(unlocksAt(def.level));
      if (!free && me.coins < def.price) return fail(missingCoins(def.price - me.coins));
      c.patch(me.id, {
        coins: free ? me.coins : me.coins - def.price,
        inventory: { ...me.inventory, [a.itemId]: (me.inventory[a.itemId] ?? 0) + 1 },
      });
      c.fx.push({ kind: 'purchase', id: me.id, itemId: def.id });
      if (!free) {
        c.bump(me.id, 'purchase');
        c.feed('purchase', me.id, msg('bought', { name: firstName(me), item: def.id }), { amount: -def.price });
      }
      return ok(free ? L(`${def.name} quedó en tu bodega.`, `${def.name} is in your storage.`) : L(`${def.name} quedó en tu bodega. ¡A decorar!`, `${def.name} is in your storage. Time to decorate!`));
    }

    case 'buyFloor': {
      const def = FLOOR_BY_ID[a.floorId];
      if (def === undefined || def.roomOnly) return fail(L('No disponible.', 'Not available.'));
      if (me.ownedFloors.includes(a.floorId)) return applyAction(state, actorId, { type: 'setFloor', floorId: a.floorId });
      const free = hasAllDecor(me);
      if (!free && levelForXp(me.xp) < def.level) return fail(unlocksAt(def.level));
      if (!free && me.coins < def.price) return fail(missingCoins(def.price - me.coins));
      c.patch(me.id, { coins: free ? me.coins : me.coins - def.price, ownedFloors: [...me.ownedFloors, a.floorId], floor: a.floorId });
      if (!free) {
        c.bump(me.id, 'purchase');
        c.feed('purchase', me.id, msg('boughtFloor', { name: firstName(me), floor: def.id }), { amount: -def.price });
      }
      return ok(L(`Instalado: ${def.name}.`, `Installed: ${def.name}.`));
    }

    case 'buyCosmetic': {
      const def = COSMETIC_BY_ID[a.cosmeticId];
      if (def === undefined || def.special) return fail(L('No disponible.', 'Not available.'));
      if (me.wardrobe?.includes(def.id)) return fail(L('Ya lo tienes en tu vestuario.', 'You already have it in your wardrobe.'));
      const free = hasAllDecor(me);
      if (!free && levelForXp(me.xp) < def.level) return fail(unlocksAt(def.level));
      if (!free && me.coins < def.price) return fail(missingCoins(def.price - me.coins));
      // Se lo pone al tiro: es lo que uno quiere al comprarlo.
      c.patch(me.id, {
        coins: free ? me.coins : me.coins - def.price,
        wardrobe: [...(me.wardrobe ?? []), def.id],
        avatar: { ...me.avatar, [def.slot]: def.id },
      });
      c.fx.push({ kind: 'purchase', id: me.id, itemId: def.id });
      if (!free) {
        c.bump(me.id, 'purchase');
        c.feed('purchase', me.id, msg('boughtCosmetic', { name: firstName(me), cosmetic: def.id }), { amount: -def.price });
      }
      return ok(L(`¡${def.name} puesto! Lo puedes cambiar en tu perfil.`, `${def.name} on! You can change it in your profile.`));
    }

    case 'setFloor': {
      if (a.floorId !== 'sala' && !me.ownedFloors.includes(a.floorId)) return fail(L('Primero compra ese piso.', 'Buy that floor first.'));
      c.patch(me.id, { floor: a.floorId });
      return ok(L('Piso cambiado.', 'Floor changed.'));
    }

    case 'place': {
      if ((me.inventory[a.itemId] ?? 0) <= 0) return fail(L('No tienes ese objeto en bodega.', "You don't have that item in storage."));
      if (me.placed.some((p) => p.uid === a.uid)) return fail(L('Ese objeto ya está colocado.', 'That item is already placed.'));
      const placeErr = placeProblem(state, me, a.itemId, a.x, a.y, a.rot);
      if (placeErr !== null) return fail(placeErr);
      const inventory = { ...me.inventory, [a.itemId]: me.inventory[a.itemId] - 1 };
      if (inventory[a.itemId] === 0) delete inventory[a.itemId];
      c.patch(me.id, { inventory, placed: [...me.placed, { uid: a.uid, itemId: a.itemId, x: a.x, y: a.y, rot: a.rot }] });
      c.bump(me.id, 'decor');
      return ok(L(`Listo, quedó en su lugar: ${ITEM_BY_ID[a.itemId].name}.`, `Done, it's in place: ${ITEM_BY_ID[a.itemId].name}.`));
    }

    case 'move': {
      const item = me.placed.find((p) => p.uid === a.uid);
      if (item === undefined) return fail(L('Objeto no encontrado.', 'Item not found.'));
      const moveErr = placeProblem(state, me, item.itemId, a.x, a.y, a.rot, a.uid);
      if (moveErr !== null) return fail(moveErr);
      c.patch(me.id, { placed: me.placed.map((p) => (p.uid === a.uid ? { ...p, x: a.x, y: a.y, rot: a.rot } : p)) });
      c.bump(me.id, 'decor');
      return ok(L('Movido.', 'Moved.'));
    }

    case 'store': {
      const item = me.placed.find((p) => p.uid === a.uid);
      if (item === undefined) return fail(L('Objeto no encontrado.', 'Item not found.'));
      c.patch(me.id, {
        placed: me.placed.filter((p) => p.uid !== a.uid),
        inventory: { ...me.inventory, [item.itemId]: (me.inventory[item.itemId] ?? 0) + 1 },
      });
      return ok(L(`${ITEM_BY_ID[item.itemId]?.name ?? 'El objeto'} volvió a tu bodega.`, `${ITEM_BY_ID[item.itemId]?.name ?? 'The item'} went back to your storage.`));
    }

    case 'announceDecor':
      c.feed('decor', me.id, msg('redecorated', { name: firstName(me), style: officeScore(me) }));
      return ok(L('Cambios guardados.', 'Changes saved.'));

    case 'avatar': {
      for (const slot of ['hat', 'face', 'neck'] as const) {
        const id = a.avatar[slot];
        if (id === undefined) continue;
        const def = COSMETIC_BY_ID[id];
        if (def === undefined || def.slot !== slot) return fail(L('Adorno no válido.', 'Invalid accessory.'));
        if (!hasAllDecor(me) && !me.wardrobe?.includes(id)) return fail(L(`Primero consigue ${def.name}.`, `Get ${def.name} first.`));
      }
      const changed = JSON.stringify(a.avatar) !== JSON.stringify(me.avatar);
      c.patch(me.id, { avatar: a.avatar, avatarSet: true });
      if (changed && me.avatarSet) c.bump(me.id, 'avatar');
      return ok(L('Avatar actualizado.', 'Avatar updated.'));
    }

    case 'gift': {
      if (!hasAllDecor(me)) return fail(L('Solo administración puede regalar.', 'Only admins can give gifts.'));
      const to = state.employees[a.toId];
      if (to === undefined) return fail(L('Colaborador no encontrado.', 'Team member not found.'));
      if (to.id === me.id) return fail(L('Para ti, usa "Obtener".', 'For yourself, use "Get".'));
      const item = ITEM_BY_ID[a.itemId];
      const cosmetic = COSMETIC_BY_ID[a.itemId];
      const message = a.message.trim();
      let name: string;
      if (item !== undefined && !item.hidden) {
        c.patch(to.id, { inventory: { ...to.inventory, [item.id]: (to.inventory[item.id] ?? 0) + 1 } });
        name = item.name;
      } else if (cosmetic !== undefined) {
        if (to.wardrobe?.includes(cosmetic.id)) return fail(L(`${firstName(to)} ya tiene ${cosmetic.name}.`, `${firstName(to)} already has ${cosmetic.name}.`));
        c.patch(to.id, { wardrobe: [...(to.wardrobe ?? []), cosmetic.id] });
        name = cosmetic.name;
      } else {
        return fail(L('No disponible.', 'Not available.'));
      }
      c.fx.push({ kind: 'gift', from: me.id, to: to.id, itemId: item ? a.itemId : '' });
      c.bump(to.id, 'gift');
      c.feed('gift', to.id, msg('gave', { from: firstName(me), to: firstName(to), item: a.itemId }), { actorId: me.id });
      c.tell([to.id], 'gift', msg('giftTitle', { item: a.itemId }), message ? msg('raw', { text: message }) : undefined, {
        itemId: a.itemId,
        fromId: me.id,
        kind: item ? 'item' : 'cosmetic',
      });
      return ok(L(`Listo: le enviaste ${name} a ${firstName(to)}. Le llegará una notificación.`, `Done: you sent ${name} to ${firstName(to)}. They'll get a notification.`));
    }

    case 'scheduleMeeting': {
      if (!canSchedule(me)) return fail(L('Solo jefaturas, gerencia y administración agendan reuniones.', 'Only team leads, management and admins can schedule meetings.'));
      const title = a.title.trim();
      if (!title) return fail(L('Ponle un título a la reunión.', 'Give the meeting a title.'));
      if (!(a.start > Date.now() - 5 * 60_000)) return fail(L('La hora de inicio ya pasó.', 'The start time has already passed.'));
      if (!(a.durationMin >= 5 && a.durationMin <= MAX_MEETING_MIN)) return fail(L('La duración debe estar entre 5 minutos y 8 horas.', 'The duration must be between 5 minutes and 8 hours.'));
      if ((state.meetings ?? []).some((m) => m.id === a.id)) return fail(L('Esa reunión ya existe.', 'That meeting already exists.'));
      const attendees = [...new Set(a.attendees.filter((id) => state.employees[id] !== undefined))];
      const meeting: Meeting = {
        id: a.id,
        title,
        start: a.start,
        durationMin: a.durationMin,
        createdBy: me.id,
        attendees,
        status: 'scheduled',
        present: [],
      };
      c.s = { ...c.s, meetings: [...pruneMeetings(c.s.meetings ?? []), meeting].sort((x, y) => x.start - y.start) };
      const when = meetingWhen(a.start);
      c.feed('meeting', me.id, msg('meetingScheduled', { name: firstName(me), title, start: a.start }));
      c.tell(attendees.length ? attendees : 'all', 'meeting', msg('meetingNew', { title }), msg('meetingNewBody', { start: a.start }), { meetingId: a.id });
      return ok(L(`Reunión agendada para ${when}. Todos recibieron el aviso.`, `Meeting scheduled for ${when}. Everyone was notified.`));
    }

    case 'startMeeting':
    case 'endMeeting':
    case 'cancelMeeting': {
      const m = (state.meetings ?? []).find((x) => x.id === a.id);
      if (m === undefined) return fail(L('Reunión no encontrada.', 'Meeting not found.'));
      if (m.createdBy !== me.id && me.role !== 'admin') return fail(L('Solo quien la agendó o administración puede hacerlo.', 'Only whoever scheduled it or an admin can do that.'));
      const people = m.attendees.length ? m.attendees : ('all' as const);
      if (a.type === 'startMeeting') {
        if (m.status !== 'scheduled') return fail(L('La reunión no está pendiente.', 'The meeting is not pending.'));
        setMeeting(c, { ...m, status: 'active', startedAt: Date.now() });
        c.tell(people, 'meeting', msg('meetingStarted', { title: m.title }), msg('meetingStartedBody'), { meetingId: m.id });
        return ok(L('Reunión iniciada: el equipo va a la sala.', 'Meeting started: the team is heading to the room.'));
      }
      if (a.type === 'cancelMeeting') {
        if (m.status !== 'scheduled') return fail(L('Solo se cancelan reuniones pendientes.', 'Only pending meetings can be cancelled.'));
        setMeeting(c, { ...m, status: 'cancelled' });
        c.tell(people, 'meeting', msg('meetingCancelled', { title: m.title }), msg('meetingTime', { start: m.start }), { meetingId: m.id });
        return ok(L('Reunión cancelada.', 'Meeting cancelled.'));
      }
      if (m.status !== 'active') return fail(L('La reunión no está en curso.', 'The meeting is not in progress.'));
      setMeeting(c, { ...m, status: 'ended', endedAt: Date.now() });
      for (const id of m.present) {
        if (c.s.employees[id] === undefined) continue;
        c.grant(id, MEETING_REWARD);
        c.bump(id, 'meeting');
      }
      c.feed('meeting', me.id, msg('meetingFinished', { title: m.title, count: m.present.length }));
      c.tell(m.present, 'meeting', msg('meetingEnded', { title: m.title }), msg('meetingEndedBody', { coins: MEETING_REWARD }), { meetingId: m.id });
      return ok(L('Reunión terminada. Cada asistente recibió su premio.', 'Meeting ended. Each attendee got their reward.'));
    }

    case 'announce': {
      if (me.role !== 'admin') return fail(L('Solo administración publica avisos.', 'Only admins post announcements.'));
      const title = a.title.trim();
      const body = a.body.trim();
      if (!title) return fail(L('El aviso necesita un título.', 'The announcement needs a title.'));
      if ((state.announcements ?? []).some((x) => x.id === a.id)) return fail(L('Ese aviso ya existe.', 'That announcement already exists.'));
      c.s = { ...c.s, announcements: [{ id: a.id, ts: Date.now(), by: me.id, title, body }, ...(c.s.announcements ?? [])].slice(0, ANNOUNCEMENTS_MAX) };
      c.feed('announcement', me.id, msg('announcement', { title }));
      // Quien lo publica ya lo leyó.
      const others = Object.keys(state.employees).filter((id) => id !== me.id);
      c.tell(others, 'announcement', msg('raw', { text: title }), body ? msg('raw', { text: body }) : undefined, { announcementId: a.id, byId: me.id });
      return ok(L('Aviso publicado: le aparece a todo el equipo.', 'Announcement posted: the whole team will see it.'));
    }

    case 'deleteAnnouncement': {
      if (me.role !== 'admin') return fail(L('Solo administración.', 'Admins only.'));
      c.s = { ...c.s, announcements: (c.s.announcements ?? []).filter((x) => x.id !== a.id) };
      return ok(L('Aviso eliminado.', 'Announcement deleted.'));
    }

    case 'contribute': {
      const fund = officeFund(state);
      if (fund.level >= EXPANSIONS.length) return fail(L('¡La oficina ya está completa! Gracias por aportar.', 'The office is already complete! Thanks for contributing.'));
      const amount = Math.floor(a.amount);
      if (!(amount >= 10)) return fail(L('El aporte mínimo es de 10 monedas.', 'The minimum contribution is 10 coins.'));
      if (me.coins < amount) return fail(L(`Solo tienes ${me.coins} monedas.`, `You only have ${me.coins} coins.`));
      c.patch(me.id, { coins: me.coins - amount });
      const total = fund.total + amount;
      let level = fund.level;
      while (level < EXPANSIONS.length && total >= EXPANSIONS[level].cost) level++;
      c.s = {
        ...c.s,
        fund: { total, level, contributors: { ...fund.contributors, [me.id]: (fund.contributors[me.id] ?? 0) + amount } },
      };
      c.fx.push({ kind: 'contribute', id: me.id, amount });
      c.bump(me.id, 'contributed', amount);
      if (level > fund.level) {
        const room = ROOMS[EXPANSIONS[level - 1].room.id];
        c.fx.push({ kind: 'expansion', level });
        c.feed('team', me.id, msg('expansion', { room: room.id }));
        c.tell('all', 'team', msg('expansionTitle', { room: room.id }), msg('expansionBody'), { expansion: level });
        return ok(L(`¡Tu aporte completó la meta! Se construyó ${room.name}.`, `Your contribution hit the goal! ${room.name} was built.`));
      }
      if (amount >= 100) c.feed('team', me.id, msg('contributed', { name: firstName(me), amount }));
      return ok(L(`Aportaste ${amount} monedas. ¡Gracias por construir la oficina!`, `You contributed ${amount} coins. Thanks for building the office!`));
    }
  }
}

/** Fondo de ampliación (con valores por defecto si el mundo es anterior a la función). */
// Siempre el mismo objeto: los selectores de React (useSyncExternalStore) entran en bucle si cambia en cada llamada.
const EMPTY_FUND: OfficeFund = Object.freeze({ total: 0, level: 0, contributors: Object.freeze({}) });

export function officeFund(s: GameState): OfficeFund {
  return s.fund ?? EMPTY_FUND;
}

export { meetingWhen };

function unlocksAt(level: number): string {
  return L(`Se desbloquea en nivel ${level}.`, `Unlocks at level ${level}.`);
}

function missingCoins(n: number): string {
  return L(`Te faltan ${n} monedas.`, `You need ${n} more coins.`);
}

function setMeeting(c: Ctx, m: Meeting): void {
  c.s = { ...c.s, meetings: (c.s.meetings ?? []).map((x) => (x.id === m.id ? m : x)) };
}

/** Las reuniones terminadas o canceladas se olvidan a la semana. */
function pruneMeetings(list: Meeting[]): Meeting[] {
  const cutoff = Date.now() - 7 * 86_400_000;
  return list.filter((m) => m.status === 'scheduled' || m.status === 'active' || (m.endedAt ?? m.start) > cutoff);
}

/**
 * Paso del reloj de reuniones (lo corre el servidor cada pocos segundos):
 * recordatorio 10 minutos antes, inicio automático a la hora y registro de
 * quiénes están conectados mientras dura. Devuelve null si no cambió nada.
 */
export function tickMeetings(state: GameState, online: Set<string>, now = Date.now()): Outcome | null {
  const meetings = state.meetings ?? [];
  if (!meetings.some((m) => m.status === 'scheduled' || m.status === 'active')) return null;
  const c = new Ctx(state);
  let changed = false;
  for (const m of meetings) {
    const people = m.attendees.length ? m.attendees : ('all' as const);
    if (m.status === 'scheduled' && !m.reminded && m.start - now <= 10 * 60_000 && m.start > now) {
      setMeeting(c, { ...m, reminded: true });
      c.tell(people, 'meeting', msg('meetingSoon', { title: m.title }), msg('meetingSoonBody'), { meetingId: m.id });
      changed = true;
    } else if (m.status === 'scheduled' && m.start <= now) {
      setMeeting(c, { ...m, status: 'active', startedAt: now });
      c.tell(people, 'meeting', msg('meetingStarted', { title: m.title }), msg('meetingStartedBody'), { meetingId: m.id });
      c.feed('meeting', m.createdBy, msg('meetingBegan', { title: m.title }));
      changed = true;
    }
  }
  for (const m of c.s.meetings ?? []) {
    if (m.status !== 'active') continue;
    const arrived = [...online].filter((id) => meetingIncludes(m, id) && !m.present.includes(id) && state.employees[id]);
    if (arrived.length > 0) {
      setMeeting(c, { ...m, present: [...m.present, ...arrived] });
      changed = true;
    }
  }
  return changed ? c.finish({ ok: true, message: '' }) : null;
}

/**
 * Actividad que no pasa por una acción del mundo (mensajes del chat): solo
 * cuenta para misiones y logros. Devuelve null si ya no aporta nada, para no
 * reescribir el mundo con cada mensaje.
 */
export function recordActivity(state: GameState, id: string, counter: Counter): Outcome | null {
  const e = state.employees[id];
  if (e === undefined) return null;
  const missions = missionStatus(e);
  const pendingMission = [...missions.daily, ...missions.weekly].some((m) => m.counter === counter && !m.done);
  const pendingAchievement = ACHIEVEMENTS.some((a) => a.stat === counter && !e.achievements?.includes(a.id));
  if (!pendingMission && !pendingAchievement) return null;
  const c = new Ctx(state);
  c.bump(id, counter);
  return c.finish({ ok: true, message: '' });
}

// ---------------------------------------------------------------------------
// Administración (solo la usa el servidor, que además maneja las cuentas)
// ---------------------------------------------------------------------------

export function addEmployee(
  state: GameState,
  actorId: string,
  name: string,
  title: string,
  dept: DeptId,
  role: Role,
  body: 0 | 1,
): { state: GameState; result: Result; id?: string } {
  const fail = (message: string) => ({ state, result: { ok: false as const, message } });
  if (state.employees[actorId]?.role !== 'admin') return fail(L('Solo administradores.', 'Admins only.'));
  if (!name.trim()) return fail(L('Falta el nombre.', 'The name is missing.'));
  const plot = freePlot(state, dept);
  if (plot === null) return fail(L(`No quedan puestos libres en ${ROOMS[dept].name}.`, `There are no free desks left in ${ROOMS[dept].name}.`));
  const id = newUid('e');
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const avatar: Avatar = { body, skin: rnd(5), hair: rnd(8), hairStyle: rnd(5), shirt: rnd(9), pants: rnd(5), acc: rnd(4) };
  const emp = makeEmployee(id, name.trim(), title.trim() || L('Colaborador', 'Team member'), dept, role, plot, avatar);
  const s = { ...state, employees: { ...state.employees, [id]: emp } };
  const welcome = event('join', id, msg('welcome', { name: emp.name, body, dept }));
  return {
    state: { ...s, feed: [welcome, ...s.feed].slice(0, FEED_MAX) },
    result: { ok: true, message: L(`${emp.name} tiene puesto en ${ROOMS[dept].name}.`, `${emp.name} now has a desk in ${ROOMS[dept].name}.`) },
    id,
  };
}

/** Nombre, cargo y rol. El área no se cambia aquí: implicaría mover su puesto y su decoración. */
export function editEmployee(
  state: GameState,
  actorId: string,
  id: string,
  edit: { name: string; title: string; role: Role },
): { state: GameState; result: Result } {
  const fail = (message: string) => ({ state, result: { ok: false as const, message } });
  if (state.employees[actorId]?.role !== 'admin') return fail(L('Solo administradores.', 'Admins only.'));
  const e = state.employees[id];
  if (e === undefined) return fail(L('Colaborador no encontrado.', 'Team member not found.'));
  if (!edit.name.trim()) return fail(L('Falta el nombre.', 'The name is missing.'));
  if (id === actorId && edit.role !== 'admin') return fail(L('No puedes quitarte el rol de administrador.', "You can't remove your own admin role."));
  const employees = { ...state.employees, [id]: { ...e, name: edit.name.trim(), title: edit.title.trim() || e.title, role: edit.role } };
  return { state: { ...state, employees }, result: { ok: true, message: L(`Datos de ${edit.name.trim()} guardados.`, `${edit.name.trim()}'s details saved.`) } };
}

export function removeEmployee(state: GameState, actorId: string, id: string): { state: GameState; result: Result } {
  const fail = (message: string) => ({ state, result: { ok: false as const, message } });
  if (state.employees[actorId]?.role !== 'admin') return fail(L('Solo administradores.', 'Admins only.'));
  if (actorId === id) return fail(L('No puedes eliminarte a ti mismo.', "You can't remove yourself."));
  if (state.employees[id] === undefined) return fail(L('Colaborador no encontrado.', 'Team member not found.'));
  const employees = { ...state.employees };
  delete employees[id];
  return { state: { ...state, employees, feed: state.feed.filter((f) => f.targetId !== id) }, result: { ok: true, message: L('Colaborador eliminado.', 'Team member removed.') } };
}
