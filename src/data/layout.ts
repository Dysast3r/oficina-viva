import { ITEM_BY_ID } from './catalog';
import type { DeptId, PlacedItem, RoomId, Rot } from './types';

/**
 * Planta de la oficina en coordenadas de baldosa (x crece hacia abajo-derecha
 * en pantalla, y hacia abajo-izquierda).
 *
 *   y 0-10   [ Gerencia 12×11 ][ TI 12×11 ][ Contabilidad 12×11 ]
 *   y 11-27  [ Ventas 24×17               ][ Reuniones 12×8     ][ Mirador* 8×17 ]
 *                                          [ Casino 12×9        ]
 *   y 28-35  [ Terraza* 24×8              ][ Juegos* 12×8       ]
 *
 * * Ampliaciones: se construyen cuando el equipo junta el fondo común.
 */
export const MAP_W = 44;
export const MAP_H = 36;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomLayout {
  id: RoomId;
  rect: Rect;
}

const BASE_ROOMS: RoomLayout[] = [
  { id: 'gerencia', rect: { x: 0, y: 0, w: 12, h: 11 } },
  { id: 'ti', rect: { x: 12, y: 0, w: 12, h: 11 } },
  { id: 'contabilidad', rect: { x: 24, y: 0, w: 12, h: 11 } },
  { id: 'ventas', rect: { x: 0, y: 11, w: 24, h: 17 } },
  { id: 'reuniones', rect: { x: 24, y: 11, w: 12, h: 8 } },
  { id: 'cafeteria', rect: { x: 24, y: 19, w: 12, h: 9 } },
];

export interface Expansion {
  room: RoomLayout;
  /** Monedas acumuladas en el fondo para construirla. */
  cost: number;
  desc: string;
}

/** Ampliaciones en orden: cada una se construye al llegar el fondo a su costo. */
export const EXPANSIONS: Expansion[] = [
  { room: { id: 'terraza', rect: { x: 0, y: 28, w: 24, h: 8 } }, cost: 2500, desc: 'Pasto, quitasoles, hamacas y aire libre.' },
  { room: { id: 'juegos', rect: { x: 24, y: 28, w: 12, h: 8 } }, cost: 5500, desc: 'Ping-pong, pool, taca-taca y rockola.' },
  { room: { id: 'mirador', rect: { x: 36, y: 11, w: 8, h: 17 } }, cost: 9000, desc: 'Un lounge elegante con vista a la ciudad.' },
];

/** Cuántas ampliaciones están construidas (lo fija el estado del juego al cargar y al cambiar). */
let builtLevel = 0;

export function setBuiltLevel(level: number): void {
  builtLevel = Math.max(0, Math.min(EXPANSIONS.length, level));
}

export function getBuiltLevel(): number {
  return builtLevel;
}

/** Salas construidas. */
export function activeRooms(): RoomLayout[] {
  return [...BASE_ROOMS, ...EXPANSIONS.slice(0, builtLevel).map((e) => e.room)];
}

/** Todas las salas posibles (para ubicar estáticos y la obra de la próxima ampliación). */
const ALL_ROOMS = [...BASE_ROOMS, ...EXPANSIONS.map((e) => e.room)];

export const ROOM_BY_ID = Object.fromEntries(ALL_ROOMS.map((r) => [r.id, r])) as Record<RoomId, RoomLayout>;

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

export function roomAt(x: number, y: number): RoomLayout | null {
  return activeRooms().find((r) => inRect(r.rect, x, y)) ?? null;
}

/** Sala a la que pertenece una baldosa, esté construida o no. */
function anyRoomAt(x: number, y: number): RoomLayout | null {
  return ALL_ROOMS.find((r) => inRect(r.rect, x, y)) ?? null;
}

function roomLevel(id: RoomId): number {
  const i = EXPANSIONS.findIndex((e) => e.room.id === id);
  return i < 0 ? 0 : i + 1;
}

// ---------------------------------------------------------------------------
// Puestos
// ---------------------------------------------------------------------------

/**
 * Puestos de cada área, en coordenadas absolutas. En Ventas el primero es la
 * oficina de la jefatura (más amplia, al frente del equipo) y luego los 8
 * puestos de vendedores en dos filas.
 */
export const PLOTS: Record<DeptId, Rect[]> = {
  gerencia: [{ x: 3, y: 3, w: 6, h: 5 }],
  ti: [{ x: 16, y: 3, w: 4, h: 4 }],
  contabilidad: [{ x: 28, y: 3, w: 4, h: 4 }],
  ventas: [
    { x: 9, y: 23, w: 6, h: 4 },
    ...[1, 7, 13, 19].map((x) => ({ x, y: 12, w: 4, h: 4 })),
    ...[1, 7, 13, 19].map((x) => ({ x, y: 18, w: 4, h: 4 })),
  ],
};

export function plotCount(dept: DeptId): number {
  return PLOTS[dept].length;
}

export function plotRect(dept: DeptId, index: number): Rect {
  return PLOTS[dept][index] ?? PLOTS[dept][0];
}

/** Muebles con los que parte todo puesto; los amplios traen estantería. */
export function defaultPlacement(dept: DeptId, plot: number): Omit<PlacedItem, 'uid'>[] {
  const r = plotRect(dept, plot);
  const extra = r.w >= 6 ? [{ itemId: 'estanteria', x: r.w - 1, y: 0, rot: 0 as Rot }] : [];
  // Silla detrás y escritorio delante: la persona trabaja mirando a la cámara.
  return [
    { itemId: 'silla', x: 1, y: 1, rot: 0 },
    { itemId: 'escritorio', x: 1, y: 2, rot: 0 },
    ...extra,
  ];
}

// ---------------------------------------------------------------------------
// Puertas
// ---------------------------------------------------------------------------

/**
 * Puertas en los muros entre salas. `n`: en el borde norte de la baldosa
 * (entre (x, y-1) y (x, y)); `w`: en el borde oeste (entre (x-1, y) y (x, y)).
 * Todas son de 2 baldosas.
 */
const DOORS: { x: number; y: number; side: 'n' | 'w'; level?: number }[] = [
  { x: 12, y: 5, side: 'w' }, // Gerencia ↔ TI
  { x: 24, y: 5, side: 'w' }, // TI ↔ Contabilidad
  { x: 5, y: 11, side: 'n' }, // Gerencia ↔ Ventas
  { x: 17, y: 11, side: 'n' }, // TI ↔ Ventas
  { x: 29, y: 11, side: 'n' }, // Contabilidad ↔ Reuniones
  { x: 24, y: 16, side: 'w' }, // Ventas ↔ Reuniones
  { x: 29, y: 19, side: 'n' }, // Reuniones ↔ Cafetería
  { x: 24, y: 23, side: 'w' }, // Ventas ↔ Cafetería
  { x: 10, y: 28, side: 'n', level: 1 }, // Ventas ↔ Terraza
  { x: 29, y: 28, side: 'n', level: 2 }, // Cafetería ↔ Juegos
  { x: 24, y: 31, side: 'w', level: 2 }, // Terraza ↔ Juegos
  { x: 36, y: 14, side: 'w', level: 3 }, // Reuniones ↔ Mirador
  { x: 36, y: 21, side: 'w', level: 3 }, // Cafetería ↔ Mirador
];

/** Bordes con puerta (de salas construidas), como "x,y,lado". */
function doorEdges(): Set<string> {
  const edges = new Set<string>();
  for (const d of DOORS) {
    if ((d.level ?? 0) > builtLevel) continue;
    for (let k = 0; k < 2; k++) edges.add(d.side === 'n' ? `${d.x + k},${d.y},n` : `${d.x},${d.y + k},w`);
  }
  return edges;
}

let edgesCache: { level: number; edges: Set<string> } | null = null;

export function hasDoor(x: number, y: number, side: 'n' | 'w'): boolean {
  if (edgesCache?.level !== builtLevel) edgesCache = { level: builtLevel, edges: doorEdges() };
  return edgesCache.edges.has(`${x},${y},${side}`);
}

/** Baldosas a ambos lados de las puertas construidas: no se pueden tapar con muebles. */
export function isDoorTile(x: number, y: number): boolean {
  return hasDoor(x, y, 'n') || hasDoor(x, y + 1, 'n') || hasDoor(x, y, 'w') || hasDoor(x + 1, y, 'w');
}

/** ¿Se puede pasar entre dos baldosas vecinas (4-vecindad)? */
export function canCross(ax: number, ay: number, bx: number, by: number): boolean {
  const ra = roomAt(ax, ay);
  const rb = roomAt(bx, by);
  if (ra === null || rb === null) return false;
  if (ra === rb) return true;
  if (ax === bx) return hasDoor(ax, Math.max(ay, by), 'n');
  return hasDoor(Math.max(ax, bx), ay, 'w');
}

// ---------------------------------------------------------------------------
// Mobiliario fijo (coordenadas relativas a cada sala)
// ---------------------------------------------------------------------------

export interface StaticItem {
  itemId: string;
  x: number;
  y: number;
  rot: Rot;
}

function inRoom(room: RoomId, items: [string, number, number, Rot?][]): StaticItem[] {
  const r = ROOM_BY_ID[room].rect;
  return items.map(([itemId, x, y, rot]) => ({ itemId, x: r.x + x, y: r.y + y, rot: rot ?? 0 }));
}

/** Mobiliario fijo de las salas construidas. */
export function activeStaticItems(): StaticItem[] {
  return ALL_STATIC_ITEMS.filter((s) => {
    const room = anyRoomAt(s.x, s.y);
    return room !== null && roomLevel(room.id) <= builtLevel;
  });
}

const ALL_STATIC_ITEMS: StaticItem[] = [
  // Ninguno pisa un puesto ni una baldosa de puerta (lo verifica layoutProblems()).
  ...inRoom('gerencia', [
    ['alfombra', 2, 8],
    ['arbol', 1, 1], ['monstera', 10, 1], ['sofa', 2, 9], ['sillon', 5, 9], ['mesa_redonda', 4, 9],
    ['planta', 10, 9], ['globo', 1, 7], ['trofeo', 10, 3],
  ]),
  ...inRoom('ti', [
    ['rack', 9, 1], ['rack', 10, 1], ['rack', 10, 3], ['pizarra', 1, 1], ['cactus', 1, 9], ['planta', 10, 9],
  ]),
  ...inRoom('contabilidad', [
    ['archivador', 9, 1], ['archivador', 10, 1], ['archivador', 10, 3], ['estanteria', 1, 3],
    ['planta', 1, 1], ['dispensador', 1, 9], ['monstera', 10, 9],
  ]),
  ...inRoom('ventas', [
    ['pizarra', 0, 2], ['pizarra', 0, 8], ['trofeo', 23, 1], ['trofeo', 23, 2], ['neon', 11, 0],
    ['dispensador', 23, 9], ['monstera', 0, 12], ['monstera', 23, 15], ['planta', 0, 16],
    ['alfombra', 2, 12], ['sillon', 2, 13], ['mesa_redonda', 3, 13], ['sillon', 4, 13], ['planta', 5, 13],
    ['jardinera', 16, 14], ['jardinera', 19, 14],
  ]),
  ...inRoom('reuniones', [
    ['alfombra', 4, 2], ['alfombra', 6, 2], ['alfombra', 4, 4], ['alfombra', 6, 4],
    ['mesa_reuniones', 4, 3],
    ['silla', 4, 2], ['silla', 5, 2], ['silla', 6, 2], ['silla', 7, 2],
    ['silla', 3, 3, 1], ['silla', 3, 4, 1],
    ['monstera', 1, 1], ['planta', 10, 6], ['pizarra', 10, 1],
  ]),
  ...inRoom('cafeteria', [
    ['meson', 1, 1], ['cafetera', 4, 1], ['minirefri', 8, 1], ['arcade', 10, 1], ['arcade', 11, 1],
    // Comedor: dos mesas largas con 12 sillas (la columna x=0 queda libre para la puerta de Ventas).
    ['mesa_comedor', 2, 4], ['silla', 2, 3], ['silla', 3, 3], ['silla', 4, 3], ['silla', 5, 3], ['silla', 1, 4, 1], ['silla', 1, 5, 1],
    ['mesa_comedor', 7, 4], ['silla', 7, 3], ['silla', 8, 3], ['silla', 9, 3], ['silla', 10, 3], ['silla', 6, 4, 1], ['silla', 6, 5, 1],
    ['sofa', 3, 7], ['sillon', 6, 7], ['estatua', 10, 7], ['jardinera', 8, 8, 0],
  ]),
  // Ampliaciones
  ...inRoom('terraza', [
    ['parasol', 3, 2], ['puf', 2, 2], ['puf', 4, 3],
    ['parasol', 15, 2], ['puf', 14, 2], ['puf', 16, 3],
    ['hamaca', 6, 5], ['hamaca', 17, 5],
    ['palmera', 0, 0], ['palmera', 23, 0], ['palmera', 0, 7], ['palmera', 23, 7],
    ['girasoles', 8, 0], ['lavanda', 9, 0], ['girasoles', 20, 0], ['lavanda', 21, 0],
    ['jardinera', 11, 7], ['mesa_centro', 12, 3], ['sillon', 11, 3], ['sillon', 13, 3],
  ]),
  ...inRoom('juegos', [
    ['ping_pong', 1, 1], ['mesa_pool', 7, 1], ['futbolito', 1, 5], ['jukebox', 11, 0],
    ['arcade', 11, 3], ['arcade', 11, 4], ['consola', 8, 6], ['puf', 7, 7], ['puf', 9, 7], ['lampara_lava', 11, 7],
  ]),
  ...inRoom('mirador', [
    ['alfombra', 2, 3], ['sillon_cuero', 2, 2], ['sillon_cuero', 4, 2], ['mesa_centro', 3, 4],
    ['alfombra', 2, 11], ['sofa', 2, 10], ['mesa_centro', 3, 12],
    ['reloj_pie', 7, 0], ['palmera', 7, 16], ['orquidea', 0, 16], ['lampara', 7, 7], ['estatua', 7, 9],
    ['pecera', 0, 7], ['biombo', 0, 0], ['unicornio', 7, 13],
  ]),
];

/** Estáticos de todas las salas (para validar el mapa completo). */
export const STATIC_ITEMS = ALL_STATIC_ITEMS;

/**
 * Chequeo de datos del mapa: mobiliario fijo que pisa un puesto, una puerta
 * o queda fuera de su sala. Se ejecuta en desarrollo al cargar.
 */
export function layoutProblems(): string[] {
  const problems: string[] = [];
  const doorTiles = new Set<string>();
  const roomAt = anyRoomAt;
  for (const d of DOORS) {
    for (let k = 0; k < 2; k++) {
      if (d.side === 'n') doorTiles.add(`${d.x + k},${d.y}`).add(`${d.x + k},${d.y - 1}`);
      else doorTiles.add(`${d.x},${d.y + k}`).add(`${d.x - 1},${d.y + k}`);
    }
  }
  const plots = Object.values(PLOTS).flat();
  for (const s of STATIC_ITEMS) {
    const def = ITEM_BY_ID[s.itemId];
    const f = footprint(s.itemId, s.x, s.y, s.rot);
    const room = roomAt(s.x, s.y);
    for (let j = 0; j < f.d; j++) {
      for (let i = 0; i < f.w; i++) {
        const x = f.x + i;
        const y = f.y + j;
        if (roomAt(x, y) !== room) problems.push(`${s.itemId} en (${s.x},${s.y}) sale de su sala`);
        if (def.flat) continue;
        if (doorTiles.has(`${x},${y}`)) problems.push(`${s.itemId} en (${s.x},${s.y}) tapa una puerta`);
        if (plots.some((p) => inRect(p, x, y))) problems.push(`${s.itemId} en (${s.x},${s.y}) pisa un puesto`);
      }
    }
  }
  return problems;
}

export interface Footprint {
  x: number;
  y: number;
  w: number;
  d: number;
}

/** Huella absoluta de un objeto colocado con su rotación. */
export function footprint(itemId: string, x: number, y: number, rot: Rot): Footprint {
  const def = ITEM_BY_ID[itemId];
  return rot === 0 ? { x, y, w: def.w, d: def.d } : { x, y, w: def.d, d: def.w };
}
