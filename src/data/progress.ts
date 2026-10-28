/**
 * Cómo se ganan monedas además del desempeño: misiones diarias y semanales,
 * logros permanentes, cofre diario y premios por nivel. Todo es determinista
 * (mismo resultado en el cliente y en el servidor) para que la respuesta
 * inmediata del cliente coincida con lo que confirma el servidor.
 */

import { bilingual } from '../i18n';

/** Eventos que se cuentan para misiones y logros. */
export type Counter =
  | 'checkin'
  | 'punctual'
  | 'kudos'
  | 'kudosRecv'
  | 'chat'
  | 'dm'
  | 'decor'
  | 'purchase'
  | 'avatar'
  | 'meeting'
  | 'awarded'
  | 'missions'
  | 'gift'
  | 'chest'
  | 'contributed';

export interface MissionDef {
  id: string;
  label: string;
  icon: string;
  counter: Counter;
  target: number;
  reward: number;
  en?: { label: string };
}

/** De aquí salen 3 misiones distintas cada día laboral, distintas para cada persona. */
export const DAILY_POOL: MissionDef[] = [
  { id: 'd_checkin', label: 'Marca tu llegada', icon: '☀️', counter: 'checkin', target: 1, reward: 8, en: { label: 'Check in' } },
  { id: 'd_punctual', label: 'Llega puntual (hasta las 8:30)', icon: '⏰', counter: 'punctual', target: 1, reward: 15, en: { label: 'Arrive on time (by 8:30)' } },
  { id: 'd_kudos1', label: 'Reconoce a un compañero', icon: '💖', counter: 'kudos', target: 1, reward: 10, en: { label: 'Recognize a coworker' } },
  { id: 'd_kudos2', label: 'Reconoce a 2 compañeros', icon: '💞', counter: 'kudos', target: 2, reward: 18, en: { label: 'Recognize 2 coworkers' } },
  { id: 'd_chat3', label: 'Escribe 3 mensajes en el chat general', icon: '💬', counter: 'chat', target: 3, reward: 10, en: { label: 'Write 3 messages in the general chat' } },
  { id: 'd_dm1', label: 'Envía un mensaje privado', icon: '✉️', counter: 'dm', target: 1, reward: 8, en: { label: 'Send a private message' } },
  { id: 'd_decor2', label: 'Coloca o mueve 2 objetos en tu puesto', icon: '🛠️', counter: 'decor', target: 2, reward: 10, en: { label: 'Place or move 2 items at your desk' } },
  { id: 'd_purchase', label: 'Compra algo en la tienda', icon: '🛒', counter: 'purchase', target: 1, reward: 12, en: { label: 'Buy something in the shop' } },
  { id: 'd_avatar', label: 'Renueva el look de tu personaje', icon: '🎨', counter: 'avatar', target: 1, reward: 6, en: { label: 'Refresh your character\'s look' } },
  { id: 'd_chest', label: 'Abre el cofre diario', icon: '🧰', counter: 'chest', target: 1, reward: 5, en: { label: 'Open the daily chest' } },
];

bilingual(DAILY_POOL);

export const DAILY_COUNT = 3;

export const WEEKLY_MISSIONS: MissionDef[] = [
  { id: 'w_punctual', label: 'Llega puntual 4 días esta semana', icon: '⏰', counter: 'punctual', target: 4, reward: 60, en: { label: 'Arrive on time 4 days this week' } },
  { id: 'w_kudos', label: 'Reconoce a 8 compañeros', icon: '💖', counter: 'kudos', target: 8, reward: 50, en: { label: 'Recognize 8 coworkers' } },
  { id: 'w_missions', label: 'Completa 10 misiones diarias', icon: '🎯', counter: 'missions', target: 10, reward: 80, en: { label: 'Complete 10 daily missions' } },
  { id: 'w_chat', label: 'Participa con 15 mensajes en el chat', icon: '💬', counter: 'chat', target: 15, reward: 30, en: { label: 'Post 15 messages in the chat' } },
  { id: 'w_meeting', label: 'Asiste a una reunión', icon: '🗓️', counter: 'meeting', target: 1, reward: 25, en: { label: 'Attend a meeting' } },
  { id: 'w_fund', label: 'Aporta 100 monedas al fondo de ampliación', icon: '🏗️', counter: 'contributed', target: 100, reward: 35, en: { label: 'Contribute 100 coins to the expansion fund' } },
];
bilingual(WEEKLY_MISSIONS);

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** Contador de toda la vida, o una medida calculada del colaborador. */
  stat: Counter | 'level' | 'style' | 'bestStreak' | 'legendary';
  target: number;
  reward: number;
  /** Adorno del vestuario que se gana además de las monedas. */
  cosmetic?: string;
  en?: { name: string; desc: string };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a_kudos1', name: 'Buena onda', desc: 'Da tu primer reconocimiento', icon: '💖', stat: 'kudos', target: 1, reward: 10, en: { name: 'Good vibes', desc: 'Give your first recognition' } },
  { id: 'a_kudos25', name: 'Corazón de oro', desc: 'Da 25 reconocimientos', icon: '💛', stat: 'kudos', target: 25, reward: 80, en: { name: 'Heart of gold', desc: 'Give 25 recognitions' } },
  { id: 'a_recv10', name: 'Querido por el equipo', desc: 'Recibe 10 reconocimientos', icon: '🤗', stat: 'kudosRecv', target: 10, reward: 60, en: { name: 'Team favorite', desc: 'Receive 10 recognitions' } },
  { id: 'a_streak5', name: 'Constancia', desc: 'Racha de 5 días laborales', icon: '🔥', stat: 'bestStreak', target: 5, reward: 30, en: { name: 'Consistency', desc: '5-workday streak' } },
  { id: 'a_streak20', name: 'Imparable', desc: 'Racha de 20 días laborales', icon: '☄️', stat: 'bestStreak', target: 20, reward: 120, en: { name: 'Unstoppable', desc: '20-workday streak' } },
  { id: 'a_punctual10', name: 'Reloj suizo', desc: 'Llega puntual 10 días', icon: '⏰', stat: 'punctual', target: 10, reward: 60, cosmetic: 'medalla_puntual', en: { name: 'Swiss watch', desc: 'Arrive on time 10 days' } },
  { id: 'a_chat50', name: 'Conversador', desc: 'Escribe 50 mensajes en el chat', icon: '💬', stat: 'chat', target: 50, reward: 40, en: { name: 'Chatterbox', desc: 'Write 50 chat messages' } },
  { id: 'a_level5', name: 'En ascenso', desc: 'Alcanza el nivel 5', icon: '📈', stat: 'level', target: 5, reward: 50, en: { name: 'On the rise', desc: 'Reach level 5' } },
  { id: 'a_level10', name: 'Leyenda en proceso', desc: 'Alcanza el nivel 10', icon: '🌟', stat: 'level', target: 10, reward: 150, en: { name: 'Legend in the making', desc: 'Reach level 10' } },
  { id: 'a_style150', name: 'Decorador', desc: 'Llega a 150 de estilo en tu puesto', icon: '🪴', stat: 'style', target: 150, reward: 60, en: { name: 'Decorator', desc: 'Reach 150 style at your desk' } },
  { id: 'a_style400', name: 'Interiorista', desc: 'Llega a 400 de estilo en tu puesto', icon: '🏛️', stat: 'style', target: 400, reward: 150, en: { name: 'Interior designer', desc: 'Reach 400 style at your desk' } },
  { id: 'a_legend', name: 'Coleccionista legendario', desc: 'Ten un objeto legendario', icon: '✨', stat: 'legendary', target: 1, reward: 100, en: { name: 'Legendary collector', desc: 'Own a legendary item' } },
  { id: 'a_meeting5', name: 'Siempre presente', desc: 'Asiste a 5 reuniones', icon: '🗓️', stat: 'meeting', target: 5, reward: 50, en: { name: 'Always there', desc: 'Attend 5 meetings' } },
  { id: 'a_missions20', name: 'Cumplidor', desc: 'Completa 20 misiones', icon: '🎯', stat: 'missions', target: 20, reward: 100, cosmetic: 'corona_laurel', en: { name: 'Achiever', desc: 'Complete 20 missions' } },
  { id: 'a_awarded10', name: 'Estrella del mes', desc: 'Recibe 10 logros de desempeño', icon: '🏅', stat: 'awarded', target: 10, reward: 100, en: { name: 'Star of the month', desc: 'Receive 10 performance awards' } },
  { id: 'a_builder', name: 'Constructor', desc: 'Aporta 500 monedas al fondo de ampliación', icon: '🏗️', stat: 'contributed', target: 500, reward: 120, cosmetic: 'casco_obra', en: { name: 'Builder', desc: 'Contribute 500 coins to the expansion fund' } },
  { id: 'a_look', name: 'Con estilo', desc: 'Compra tu primer adorno de vestuario', icon: '🎩', stat: 'purchase', target: 1, reward: 15, en: { name: 'Stylish', desc: 'Buy your first wardrobe accessory' } },
];
bilingual(ACHIEVEMENTS);

/** Bonificación extra por llegar hasta la hora de inicio. */
export const PUNCTUAL_BONUS = 5;
/** Premio de asistencia al terminar una reunión. */
export const MEETING_REWARD = 15;
/** Premio para todo el equipo cuando la productividad llega al 100 %. */
export const TEAM_GOAL_REWARD = 15;
/** Monedas extra por subir de nivel: nivel × esto (no suman XP). */
export const LEVEL_REWARD_PER_LEVEL = 10;

// ---------------------------------------------------------------------------

/** Hash simple y estable (FNV-1a) para elegir misiones y premios sin azar real. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Las 3 misiones del día de una persona: sin repetir contador. */
export function dailyMissionsFor(employeeId: string, day: string): MissionDef[] {
  const ranked = [...DAILY_POOL].sort((a, b) => hash(`${day}|${employeeId}|${a.id}`) - hash(`${day}|${employeeId}|${b.id}`));
  const out: MissionDef[] = [];
  for (const m of ranked) {
    if (out.some((o) => o.counter === m.counter)) continue;
    out.push(m);
    if (out.length === DAILY_COUNT) break;
  }
  return out;
}

/** Premio del cofre diario: casi siempre algo modesto, a veces un premio gordo. */
export function chestReward(employeeId: string, day: string): number {
  const roll = hash(`cofre|${day}|${employeeId}`) % 100;
  if (roll < 2) return 120;
  if (roll < 10) return 50;
  if (roll < 35) return 25;
  return 8 + (roll % 10);
}

/** Lunes (AAAA-MM-DD) de la semana de `day`. */
export function weekKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
}
