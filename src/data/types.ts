export type DeptId = 'gerencia' | 'ventas' | 'contabilidad' | 'ti';
export type RoomId = DeptId | 'reuniones' | 'cafeteria' | 'terraza' | 'juegos' | 'mirador';

/** Fondo común para ampliar la oficina. */
export interface OfficeFund {
  /** Monedas aportadas en total (nunca baja). */
  total: number;
  /** Ampliaciones ya construidas (0 = oficina original). */
  level: number;
  /** Aporte de cada persona. */
  contributors: Record<string, number>;
}

/**
 * colaborador: decora y da reconocimientos · jefatura: además registra desempeño de su área ·
 * gerente: registra desempeño de todos · admin: cuentas, todas las decoraciones gratis y regalos.
 */
export type Role = 'colaborador' | 'jefatura' | 'gerente' | 'admin';

/** Progreso de misiones de un período (día o semana). */
export interface MissionProgress {
  /** Día "AAAA-MM-DD" o lunes de la semana. */
  key: string;
  counters: Record<string, number>;
  /** Misiones ya completadas (y pagadas) en el período. */
  done: string[];
}

export interface Meeting {
  id: string;
  title: string;
  /** Inicio (ms). */
  start: number;
  durationMin: number;
  createdBy: string;
  /** Vacío = todo el equipo. */
  attendees: string[];
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  startedAt?: number;
  endedAt?: number;
  /** Quienes estuvieron conectados durante la reunión (reciben el premio de asistencia). */
  present: string[];
  reminded?: boolean;
}

export interface Announcement {
  id: string;
  ts: number;
  by: string;
  title: string;
  body: string;
}

export type NotificationKind =
  | 'gift'
  | 'kudos'
  | 'award'
  | 'levelup'
  | 'announcement'
  | 'meeting'
  | 'achievement'
  | 'mission'
  | 'team';

/** Mensaje de chat. Sin `to` es del chat general; con `to`, privado. */
export interface ChatMessage {
  id: string;
  ts: number;
  from: string;
  to?: string;
  text: string;
}

/** Aviso personal; vive en el servidor (tabla propia) y solo lo recibe su destinatario. */
export interface AppNotification {
  id: string;
  ts: number;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** Datos para mostrarlo: itemId del regalo, id de la reunión, etc. */
  data?: Record<string, string | number>;
  read: boolean;
}

/** Índices dentro de las paletas de `catalog.ts` (AVATAR_*). */
export interface Avatar {
  /** 0 = hombre, 1 = mujer: cambia rasgos de la cara (pestañas, labios). */
  body: 0 | 1;
  skin: number;
  hair: number;
  hairStyle: number;
  shirt: number;
  pants: number;
  /** 0 nada · 1 lentes · 2 audífonos · 3 ambos. */
  acc?: number;
  /** Adornos del vestuario (ids de `COSMETICS`), uno por zona. */
  hat?: string;
  face?: string;
  neck?: string;
}

/** Rotación de un objeto: 0 = como se dibujó, 1 = espejado (ancho y fondo intercambiados). */
export type Rot = 0 | 1;

/** Objeto colocado dentro del puesto; x/y son relativos a la esquina del puesto. */
export interface PlacedItem {
  uid: string;
  itemId: string;
  x: number;
  y: number;
  rot: Rot;
}

export interface Employee {
  id: string;
  name: string;
  title: string;
  dept: DeptId;
  role: Role;
  avatar: Avatar;
  coins: number;
  /** Monedas ganadas en total (nunca baja al comprar): define el nivel. */
  xp: number;
  /** itemId -> cantidad en bodega (comprada y no colocada). */
  inventory: Record<string, number>;
  placed: PlacedItem[];
  floor: string;
  ownedFloors: string[];
  lastCheckIn: string | null;
  streak: number;
  kudosGiven: { date: string; count: number };
  /** Día en que cobró el bono por completar los objetivos diarios. */
  bonusDate?: string;
  /** Índice del puesto dentro del área de su departamento. */
  plot: number;
  /** Ya eligió su personaje (se pide al entrar por primera vez). */
  avatarSet?: boolean;
  /** Adornos del personaje que posee. */
  wardrobe?: string[];
  /** Contadores de toda la vida (logros). */
  stats?: Record<string, number>;
  achievements?: string[];
  daily?: MissionProgress;
  weekly?: MissionProgress;
  /** Día en que abrió el cofre diario. */
  chestDate?: string;
}

export type ActivityKind =
  | 'award'
  | 'kudos'
  | 'purchase'
  | 'checkin'
  | 'levelup'
  | 'decor'
  | 'join'
  | 'gift'
  | 'achievement'
  | 'meeting'
  | 'team'
  | 'announcement';

export interface ActivityEvent {
  id: string;
  ts: number;
  kind: ActivityKind;
  targetId: string;
  actorId?: string;
  amount?: number;
  text: string;
}

export interface GameState {
  version: 1;
  employees: Record<string, Employee>;
  currentUserId: string | null;
  feed: ActivityEvent[];
  meetings?: Meeting[];
  announcements?: Announcement[];
  fund?: OfficeFund;
}
