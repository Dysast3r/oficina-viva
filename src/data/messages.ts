import { L, intlLocale, withLang } from '../i18n';
import { AWARDS, COSMETIC_BY_ID, FLOOR_BY_ID, ITEM_BY_ID, ROOMS } from './catalog';
import { ACHIEVEMENTS, DAILY_POOL, WEEKLY_MISSIONS } from './progress';
import { TIME_ZONE } from './schedule';
import type { ActivityEvent, AppNotification, RoomId } from './types';

/**
 * Textos que se guardan (feed de actividad y notificaciones). No se guardan ya
 * escritos sino como clave + datos (`Msg`), y cada persona los lee en su
 * idioma. Los datos llevan ids (objeto, logro, sala), no nombres, para poder
 * traducirlos al mostrarlos. Junto al `Msg` se guarda también el texto en
 * español, que es lo que muestran los avisos antiguos y sirve de respaldo.
 */

const formats = new Map<string, Intl.DateTimeFormat>();

/** "jueves 30 oct 15:00" / "Thursday, Oct 30, 15:00", en hora de la oficina. */
export function meetingWhen(ts: number): string {
  const locale = intlLocale();
  let f = formats.get(locale);
  if (f === undefined) {
    f = new Intl.DateTimeFormat(locale, {
      timeZone: TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formats.set(locale, f);
  }
  return f.format(ts).replace(/\./g, '');
}

const room = (id: string) => ROOMS[id as RoomId]?.name ?? id;
const lower = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);
const thing = (id: string) => ITEM_BY_ID[id]?.name ?? COSMETIC_BY_ID[id]?.name ?? id;
const achievement = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
const mission = (id: string) => [...DAILY_POOL, ...WEEKLY_MISSIONS].find((m) => m.id === id);
const awardLabel = (id: string) => AWARDS.find((a) => a.id === id)?.label ?? L('Reconocimiento especial', 'Special recognition');
const quoted = (note: string) => (note ? ` — “${note}”` : '');
const coins = (n: number) => L(`+${n} monedas`, `+${n} coins`);

const TEXTS = {
  // Texto tal cual (escrito por alguien: un mensaje de reconocimiento, el título de un aviso…).
  raw: (p: { text: string }) => p.text,
  coins: (p: { n: number }) => coins(p.n),

  // --- Feed --------------------------------------------------------------
  levelUp: (p: { name: string; level: number }) => L(`${p.name} subió a nivel ${p.level}`, `${p.name} reached level ${p.level}`),
  achievement: (p: { name: string; id: string }) => {
    const a = achievement(p.id);
    return L(`${p.name} desbloqueó el logro “${a?.name ?? p.id}” ${a?.icon ?? ''}`, `${p.name} unlocked the achievement “${a?.name ?? p.id}” ${a?.icon ?? ''}`).trim();
  },
  award: (p: { name: string; coins: number; award: string; note: string }) =>
    L(`${p.name} ganó ${p.coins} por ${awardLabel(p.award)}`, `${p.name} earned ${p.coins} for ${awardLabel(p.award)}`) + quoted(p.note),
  teamGoal: (p: { coins: number }) =>
    L(`¡El equipo llegó a la meta del día! +${p.coins} monedas para todos`, `The team hit today's goal! +${p.coins} coins for everyone`),
  kudos: (p: { from: string; to: string; message: string }) =>
    L(`${p.from} reconoció a ${p.to}`, `${p.from} recognized ${p.to}`) + (p.message ? `: “${p.message}”` : ''),
  streakBonus: (p: { name: string; streak: number; bonus: number }) =>
    L(`${p.name} lleva ${p.streak} días seguidos: bono de ${p.bonus}`, `${p.name} is on a ${p.streak}-day streak: ${p.bonus} bonus`),
  checkIn: (p: { name: string; punctual: number; streak: number }) =>
    L(
      `${p.name} llegó a la oficina${p.punctual ? ' puntual ⏰' : ''} (racha: ${p.streak})`,
      `${p.name} arrived at the office${p.punctual ? ' on time ⏰' : ''} (streak: ${p.streak})`,
    ),
  dailyDone: (p: { name: string }) => L(`${p.name} completó sus misiones del día`, `${p.name} completed today's missions`),
  chest: (p: { name: string; coins: number }) =>
    L(`${p.name} encontró ${p.coins} monedas en el cofre diario 🧰`, `${p.name} found ${p.coins} coins in the daily chest 🧰`),
  bought: (p: { name: string; item: string }) => L(`${p.name} compró ${thing(p.item)}`, `${p.name} bought ${thing(p.item)}`),
  boughtFloor: (p: { name: string; floor: string }) => {
    const floor = FLOOR_BY_ID[p.floor]?.name ?? p.floor;
    return L(`${p.name} instaló piso de ${floor.toLowerCase()}`, `${p.name} installed ${lower(floor)} flooring`);
  },
  boughtCosmetic: (p: { name: string; cosmetic: string }) => {
    const name = COSMETIC_BY_ID[p.cosmetic]?.name ?? p.cosmetic;
    return L(`${p.name} estrena ${name.toLowerCase()}`, `${p.name} is sporting a new ${lower(name)}`);
  },
  redecorated: (p: { name: string; style: number }) =>
    L(`${p.name} remodeló su puesto (estilo ${p.style})`, `${p.name} redecorated their desk (style ${p.style})`),
  gave: (p: { from: string; to: string; item: string }) =>
    L(`${p.from} le regaló ${thing(p.item)} a ${p.to}`, `${p.from} gave ${thing(p.item)} to ${p.to}`),
  meetingScheduled: (p: { name: string; title: string; start: number }) =>
    L(`${p.name} agendó “${p.title}” para ${meetingWhen(p.start)}`, `${p.name} scheduled “${p.title}” for ${meetingWhen(p.start)}`),
  meetingBegan: (p: { title: string }) => L(`Comenzó la reunión “${p.title}”`, `The meeting “${p.title}” has started`),
  meetingFinished: (p: { title: string; count: number }) =>
    L(
      `Terminó la reunión “${p.title}” (${p.count} asistentes)`,
      `The meeting “${p.title}” ended (${p.count} ${p.count === 1 ? 'attendee' : 'attendees'})`,
    ),
  announcement: (p: { title: string }) => L(`📢 Aviso: ${p.title}`, `📢 Announcement: ${p.title}`),
  expansion: (p: { room: string }) => L(`🏗️ ¡La oficina creció! Se inauguró: ${room(p.room)}`, `🏗️ The office grew! Now open: ${room(p.room)}`),
  contributed: (p: { name: string; amount: number }) =>
    L(`${p.name} aportó ${p.amount} monedas al fondo de ampliación 🏗️`, `${p.name} put ${p.amount} coins into the expansion fund 🏗️`),
  welcome: (p: { name: string; body: number; dept: string }) =>
    L(`¡${p.body === 1 ? 'Bienvenida' : 'Bienvenido'} ${p.name} a ${room(p.dept)}!`, `Welcome ${p.name} to ${room(p.dept)}!`),

  // --- Notificaciones ----------------------------------------------------
  levelUpTitle: (p: { level: number }) => L(`¡Subiste a nivel ${p.level}!`, `You reached level ${p.level}!`),
  levelUpBody: (p: { bonus: number }) =>
    L(`Premio de nivel: +${p.bonus} monedas. Revisa la tienda: hay cosas nuevas.`, `Level reward: +${p.bonus} coins. Check the shop: there's new stuff.`),
  missionDone: (p: { id: string }) => L(`Misión cumplida: ${mission(p.id)?.label ?? p.id}`, `Mission complete: ${mission(p.id)?.label ?? p.id}`),
  achievementTitle: (p: { id: string }) => {
    const a = achievement(p.id);
    return L(`Logro desbloqueado: ${a?.name ?? p.id} ${a?.icon ?? ''}`, `Achievement unlocked: ${a?.name ?? p.id} ${a?.icon ?? ''}`).trim();
  },
  achievementBody: (p: { id: string }) => {
    const a = achievement(p.id);
    if (a === undefined) return '';
    const extra = a.cosmetic ? L(` y ${COSMETIC_BY_ID[a.cosmetic]?.name ?? 'un adorno'} para tu personaje`, ` and ${COSMETIC_BY_ID[a.cosmetic]?.name ?? 'an accessory'} for your character`) : '';
    return L(`${a.desc}. +${a.reward} monedas${extra}.`, `${a.desc}. +${a.reward} coins${extra}.`);
  },
  awardTitle: (p: { award: string; coins: number }) => `${awardLabel(p.award)} (+${p.coins})`,
  awardBody: (p: { by: string; note: string }) => L(`${p.by} registró tu logro`, `${p.by} logged your achievement`) + quoted(p.note),
  teamGoalTitle: () => L('¡Meta del equipo cumplida! 🎉', 'Team goal reached! 🎉'),
  teamGoalBody: (p: { coins: number }) =>
    L(`La productividad llegó al 100 %. +${p.coins} monedas para todos.`, `Productivity hit 100%. +${p.coins} coins for everyone.`),
  kudosTitle: (p: { by: string }) => L(`${p.by} te reconoció 💖`, `${p.by} recognized you 💖`),
  giftTitle: (p: { item: string }) => L(`¡Recibiste un regalo: ${thing(p.item)}!`, `You got a gift: ${thing(p.item)}!`),
  meetingNew: (p: { title: string }) => L(`Nueva reunión: ${p.title}`, `New meeting: ${p.title}`),
  meetingNewBody: (p: { start: number }) => L(`${meetingWhen(p.start)} · sala de reuniones`, `${meetingWhen(p.start)} · meeting room`),
  meetingStarted: (p: { title: string }) => L(`Comenzó la reunión: ${p.title}`, `Meeting started: ${p.title}`),
  meetingStartedBody: () => L('Todos a la sala de reuniones 🗓️', 'Everyone to the meeting room 🗓️'),
  meetingCancelled: (p: { title: string }) => L(`Se canceló la reunión: ${p.title}`, `Meeting cancelled: ${p.title}`),
  meetingTime: (p: { start: number }) => meetingWhen(p.start),
  meetingEnded: (p: { title: string }) => L(`Terminó la reunión: ${p.title}`, `Meeting ended: ${p.title}`),
  meetingEndedBody: (p: { coins: number }) => L(`¡Gracias por asistir! +${p.coins} monedas`, `Thanks for attending! +${p.coins} coins`),
  meetingSoon: (p: { title: string }) => L(`En 10 minutos: ${p.title}`, `In 10 minutes: ${p.title}`),
  meetingSoonBody: () => L('Prepárate para ir a la sala de reuniones.', 'Get ready to head to the meeting room.'),
  expansionTitle: (p: { room: string }) => L(`¡Nueva zona: ${room(p.room)}! 🎉`, `New area: ${room(p.room)}! 🎉`),
  expansionBody: () => L('El equipo juntó el fondo de ampliación. ¡Ven a conocerla!', 'The team filled the expansion fund. Come check it out!'),
};

type Texts = typeof TEXTS;
export type MsgKey = keyof Texts;
type ParamsOf<K extends MsgKey> = Parameters<Texts[K]> extends [infer P] ? P : Record<string, never>;

/** Texto guardado: clave + datos. */
export type Msg = { [K in MsgKey]: { k: K; p: ParamsOf<K> } }[MsgKey];

export function msg<K extends MsgKey>(k: K, ...p: Parameters<Texts[K]> extends [infer P] ? [P] : []): Msg {
  return { k, p: p[0] ?? {} } as Msg;
}

/** Texto en el idioma actual, o null si no se reconoce (avisos de otra versión). */
export function msgText(m: Msg | undefined): string | null {
  if (m === undefined || !Object.hasOwn(TEXTS, m.k)) return null;
  try {
    return (TEXTS[m.k] as (p: unknown) => string)(m.p ?? {});
  } catch {
    return null;
  }
}

/** Respaldo en español que se guarda junto al `Msg`. */
export function spanishText(m: Msg): string {
  return withLang('es', () => msgText(m) ?? '');
}

/** Texto de un evento del feed en el idioma actual. */
export function feedText(e: ActivityEvent): string {
  return msgText(e.msg) ?? e.text;
}

/** Título y cuerpo de una notificación en el idioma actual. */
export function notificationText(n: AppNotification): { title: string; body?: string } {
  const title = msgText(n.msg?.title) ?? n.title;
  const body = n.msg?.body ? msgText(n.msg.body) ?? n.body : n.body;
  return body ? { title, body } : { title };
}
