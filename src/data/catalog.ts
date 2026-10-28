import type { DeptId, RoomId } from './types';

// ---------------------------------------------------------------------------
// Departamentos y salas
// ---------------------------------------------------------------------------

export interface RoomDef {
  id: RoomId;
  name: string;
  /** Color de identidad: letrero, piso por defecto y acentos de UI. */
  color: string;
  floor: string;
}

export const ROOMS: Record<RoomId, RoomDef> = {
  gerencia: { id: 'gerencia', name: 'Gerencia', color: '#e0a64a', floor: 'parquet_oscuro' },
  ventas: { id: 'ventas', name: 'Ventas', color: '#f08a3c', floor: 'porcelanato' },
  contabilidad: { id: 'contabilidad', name: 'Contabilidad', color: '#3fbf7f', floor: 'porcelanato_claro' },
  ti: { id: 'ti', name: 'TI', color: '#2cb8c4', floor: 'alfombra_oscura' },
  reuniones: { id: 'reuniones', name: 'Reuniones', color: '#7c8cf0', floor: 'parquet' },
  cafeteria: { id: 'cafeteria', name: 'Casino', color: '#d9824a', floor: 'porcelanato' },
  terraza: { id: 'terraza', name: 'Terraza', color: '#5fbf6a', floor: 'cesped' },
  juegos: { id: 'juegos', name: 'Sala de juegos', color: '#e86fa8', floor: 'ajedrez' },
  mirador: { id: 'mirador', name: 'Mirador', color: '#7fc8f0', floor: 'marmol' },
};

export const DEPTS: DeptId[] = ['gerencia', 'ventas', 'contabilidad', 'ti'];

// ---------------------------------------------------------------------------
// Pisos
// ---------------------------------------------------------------------------

export interface FloorDef {
  id: string;
  name: string;
  price: number;
  level: number;
  /** Puntos de estilo que suma al puesto. */
  style: number;
  pattern: 'carpet' | 'wood' | 'checker' | 'marble' | 'grass' | 'tile';
  colors: [string, string];
  /** Solo para salas, no se vende. */
  roomOnly?: boolean;
}

export const FLOORS: FloorDef[] = [
  { id: 'parquet', name: 'Parquet', price: 120, level: 2, style: 6, pattern: 'wood', colors: ['#9a6a44', '#8c5f3c'] },
  { id: 'alfombra_azul', name: 'Alfombra corporativa', price: 150, level: 2, style: 7, pattern: 'carpet', colors: ['#34497a', '#2e416e'] },
  { id: 'cesped', name: 'Pasto sintético', price: 220, level: 3, style: 10, pattern: 'grass', colors: ['#4f9a40', '#448a37'] },
  { id: 'ajedrez', name: 'Baldosa ajedrez', price: 260, level: 4, style: 12, pattern: 'checker', colors: ['#d8d2c4', '#2e2d36'] },
  { id: 'parquet_oscuro', name: 'Parquet nogal', price: 320, level: 5, style: 15, pattern: 'wood', colors: ['#6e4630', '#623e2a'] },
  { id: 'marmol', name: 'Mármol', price: 450, level: 6, style: 22, pattern: 'marble', colors: ['#e2e1e8', '#c7c6d2'] },
  { id: 'oro', name: 'Piso de oro', price: 1400, level: 10, style: 60, pattern: 'tile', colors: ['#d9a83a', '#c4922a'] },
  { id: 'porcelanato', name: 'Porcelanato', price: 0, level: 1, style: 0, pattern: 'tile', colors: ['#6f6862', '#655f59'], roomOnly: true },
  { id: 'porcelanato_claro', name: 'Porcelanato claro', price: 0, level: 1, style: 0, pattern: 'tile', colors: ['#8a847c', '#807a72'], roomOnly: true },
  { id: 'alfombra_oscura', name: 'Alfombra grafito', price: 0, level: 1, style: 0, pattern: 'carpet', colors: ['#3f4552', '#383e4a'], roomOnly: true },
];

export const FLOOR_BY_ID: Record<string, FloorDef> = Object.fromEntries(FLOORS.map((f) => [f.id, f]));

/** Piso que trae cada puesto nuevo: el de su sala. */
export const DEFAULT_PLOT_FLOOR = 'sala';

// ---------------------------------------------------------------------------
// Objetos de decoración
// ---------------------------------------------------------------------------

export type ItemCategory = 'muebles' | 'plantas' | 'tecnologia' | 'deco' | 'premium' | 'legendario';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  price: number;
  level: number;
  style: number;
  /** Huella en baldosas (a lo largo de x y de y) con rot 0. */
  w: number;
  d: number;
  /** Plano en el piso (alfombras): se puede caminar encima. */
  flat?: boolean;
  /** Silla: el colaborador se sienta aquí a trabajar. */
  seat?: boolean;
  /** Mobiliario de áreas comunes: no aparece en la tienda. */
  hidden?: boolean;
  desc: string;
}

export const ITEMS: ItemDef[] = [
  // Muebles
  { id: 'escritorio', name: 'Escritorio básico', category: 'muebles', price: 0, level: 1, style: 1, w: 2, d: 1, desc: 'Tu escritorio de siempre, con su PC.' },
  { id: 'silla', name: 'Silla de oficina', category: 'muebles', price: 0, level: 1, style: 1, w: 1, d: 1, seat: true, desc: 'Cumple. Gira un poco.' },
  { id: 'archivador', name: 'Archivador', category: 'muebles', price: 45, level: 1, style: 2, w: 1, d: 1, desc: 'Orden ante todo.' },
  { id: 'puf', name: 'Puf', category: 'muebles', price: 70, level: 2, style: 4, w: 1, d: 1, desc: 'Para pensar con calma.' },
  { id: 'estanteria', name: 'Estantería', category: 'muebles', price: 120, level: 2, style: 7, w: 1, d: 1, desc: 'Libros, manuales y normas técnicas.' },
  { id: 'silla_ergo', name: 'Silla ergonómica', category: 'muebles', price: 180, level: 3, style: 9, w: 1, d: 1, seat: true, desc: 'Tu espalda te lo agradece.' },
  { id: 'sofa', name: 'Sofá', category: 'muebles', price: 230, level: 3, style: 12, w: 2, d: 1, desc: 'Para recibir visitas con estilo.' },
  { id: 'escritorio_pro', name: 'Escritorio pro', category: 'muebles', price: 320, level: 4, style: 16, w: 2, d: 1, desc: 'Doble monitor y madera noble.' },
  { id: 'mesa_centro', name: 'Mesa de centro', category: 'muebles', price: 90, level: 2, style: 5, w: 1, d: 1, desc: 'Revistas, café y buenas ideas.' },
  { id: 'biombo', name: 'Biombo japonés', category: 'muebles', price: 110, level: 2, style: 6, w: 1, d: 1, desc: 'Privacidad con estilo zen.' },
  { id: 'sillon_cuero', name: 'Sillón de cuero', category: 'muebles', price: 200, level: 3, style: 11, w: 1, d: 1, desc: 'Cuero café, de directorio.' },
  { id: 'escritorio_pie', name: 'Escritorio de pie', category: 'muebles', price: 280, level: 4, style: 14, w: 2, d: 1, desc: 'Trabaja de pie y estira las piernas.' },
  // Plantas
  { id: 'cactus', name: 'Cactus', category: 'plantas', price: 30, level: 1, style: 2, w: 1, d: 1, desc: 'Poco riego, mucha actitud.' },
  { id: 'planta', name: 'Planta de interior', category: 'plantas', price: 40, level: 1, style: 3, w: 1, d: 1, desc: 'Un poco de verde al puesto.' },
  { id: 'monstera', name: 'Monstera', category: 'plantas', price: 95, level: 2, style: 6, w: 1, d: 1, desc: 'Hojas grandes, vibra tropical.' },
  { id: 'bonsai', name: 'Bonsái', category: 'plantas', price: 160, level: 3, style: 10, w: 1, d: 1, desc: 'Paciencia hecha planta.' },
  { id: 'arbol', name: 'Árbol de interior', category: 'plantas', price: 260, level: 5, style: 14, w: 1, d: 1, desc: 'Casi un parque propio.' },
  { id: 'suculentas', name: 'Suculentas', category: 'plantas', price: 35, level: 1, style: 3, w: 1, d: 1, desc: 'Tres macetitas que no piden nada.' },
  { id: 'lavanda', name: 'Lavanda', category: 'plantas', price: 55, level: 1, style: 4, w: 1, d: 1, desc: 'Huele a calma.' },
  { id: 'girasoles', name: 'Girasoles', category: 'plantas', price: 75, level: 2, style: 5, w: 1, d: 1, desc: 'Siempre mirando hacia la meta.' },
  { id: 'orquidea', name: 'Orquídea', category: 'plantas', price: 120, level: 3, style: 8, w: 1, d: 1, desc: 'Elegante y delicada.' },
  { id: 'palmera', name: 'Palmera', category: 'plantas', price: 230, level: 4, style: 13, w: 1, d: 1, desc: 'Vacaciones permanentes.' },
  // Tecnología
  { id: 'dispensador', name: 'Dispensador de agua', category: 'tecnologia', price: 100, level: 2, style: 5, w: 1, d: 1, desc: 'Hidratación de alto rendimiento.' },
  { id: 'cafetera', name: 'Cafetera espresso', category: 'tecnologia', price: 150, level: 3, style: 8, w: 1, d: 1, desc: 'El motor de la productividad.' },
  { id: 'minirefri', name: 'Mini refri', category: 'tecnologia', price: 210, level: 4, style: 10, w: 1, d: 1, desc: 'Colaciones siempre frías.' },
  { id: 'arcade', name: 'Máquina arcade', category: 'tecnologia', price: 520, level: 6, style: 26, w: 1, d: 1, desc: 'Para la pausa activa (de verdad).' },
  { id: 'impresora', name: 'Impresora', category: 'tecnologia', price: 70, level: 1, style: 4, w: 1, d: 1, desc: 'Imprime las cotizaciones que cierras.' },
  { id: 'parlante', name: 'Parlante inteligente', category: 'tecnologia', price: 85, level: 2, style: 5, w: 1, d: 1, desc: 'Lo-fi para concentrarse.' },
  { id: 'pantalla_kpi', name: 'Pantalla de KPIs', category: 'tecnologia', price: 260, level: 4, style: 14, w: 1, d: 1, desc: 'Tus números, siempre a la vista.' },
  { id: 'consola', name: 'Rincón gamer', category: 'tecnologia', price: 340, level: 5, style: 18, w: 1, d: 1, desc: 'Tele, consola y un puf para la hora de almuerzo.' },
  { id: 'dron', name: 'Dron', category: 'tecnologia', price: 450, level: 6, style: 22, w: 1, d: 1, desc: 'Para inspecciones aéreas de terreno.' },
  // Deco
  { id: 'alfombra', name: 'Alfombra', category: 'deco', price: 80, level: 1, style: 5, w: 2, d: 2, flat: true, desc: 'Une todo el puesto.' },
  { id: 'lampara', name: 'Lámpara de pie', category: 'deco', price: 60, level: 1, style: 4, w: 1, d: 1, desc: 'Luz cálida para tardes largas.' },
  { id: 'pizarra', name: 'Pizarra', category: 'deco', price: 90, level: 2, style: 5, w: 1, d: 1, desc: 'Para las grandes ideas.' },
  { id: 'globo', name: 'Globo terráqueo', category: 'deco', price: 110, level: 2, style: 6, w: 1, d: 1, desc: 'Proyectos en todo el mundo.' },
  { id: 'cuadro', name: 'Cuadro en atril', category: 'deco', price: 140, level: 3, style: 8, w: 1, d: 1, desc: 'Arte original del equipo.' },
  { id: 'trofeo', name: 'Vitrina de trofeos', category: 'deco', price: 260, level: 4, style: 14, w: 1, d: 1, desc: 'Muestra tus logros.' },
  { id: 'pecera', name: 'Pecera', category: 'deco', price: 65, level: 1, style: 4, w: 1, d: 1, desc: 'Un pez naranjo que te saluda.' },
  { id: 'lampara_lava', name: 'Lámpara de lava', category: 'deco', price: 120, level: 3, style: 7, w: 1, d: 1, desc: 'Burbujas hipnóticas de colores.' },
  { id: 'parasol', name: 'Quitasol', category: 'deco', price: 160, level: 3, style: 9, w: 1, d: 1, desc: 'Mesa con quitasol, modo terraza.' },
  { id: 'reloj_pie', name: 'Reloj de pie', category: 'deco', price: 240, level: 4, style: 12, w: 1, d: 1, desc: 'Para no llegar nunca tarde.' },
  { id: 'gato', name: 'Gato dormilón', category: 'deco', price: 300, level: 4, style: 15, w: 1, d: 1, desc: 'Mascota oficial: duerme en su cojín.' },
  { id: 'perro', name: 'Perrito', category: 'deco', price: 320, level: 5, style: 16, w: 1, d: 1, desc: 'Fiel compañero de jornada.' },
  // Premium
  { id: 'acuario', name: 'Acuario', category: 'premium', price: 420, level: 5, style: 22, w: 2, d: 1, desc: 'Peces que trabajan en equipo.' },
  { id: 'neon', name: 'Letrero neón', category: 'premium', price: 380, level: 5, style: 19, w: 1, d: 1, desc: 'Tu puesto, iluminado.' },
  { id: 'estatua', name: 'Estatua dorada', category: 'premium', price: 950, level: 8, style: 48, w: 1, d: 1, desc: 'Solo para leyendas de la oficina.' },
  { id: 'hamaca', name: 'Hamaca', category: 'premium', price: 480, level: 5, style: 24, w: 2, d: 1, desc: 'Siesta corta, ideas largas.' },
  { id: 'futbolito', name: 'Taca-taca', category: 'premium', price: 560, level: 6, style: 28, w: 2, d: 1, desc: 'El clásico de la oficina chilena.' },
  { id: 'jukebox', name: 'Rockola', category: 'premium', price: 650, level: 7, style: 32, w: 1, d: 1, desc: 'Luces de neón y clásicos de siempre.' },
  { id: 'ping_pong', name: 'Mesa de ping-pong', category: 'premium', price: 720, level: 7, style: 34, w: 2, d: 2, desc: 'Torneo de los viernes asegurado.' },
  { id: 'mesa_pool', name: 'Mesa de pool', category: 'premium', price: 780, level: 8, style: 38, w: 2, d: 2, desc: 'Paño verde y tacos listos.' },
  // Legendarios: metas grandes, para presumir en el puesto.
  { id: 'bola_disco', name: 'Bola disco', category: 'legendario', price: 1100, level: 7, style: 55, w: 1, d: 1, desc: 'Cada viernes es fiesta en tu puesto.' },
  { id: 'trono', name: 'Trono dorado', category: 'legendario', price: 1250, level: 8, style: 62, w: 1, d: 1, seat: true, desc: 'Trabaja como la realeza de las ventas.' },
  { id: 'cofre', name: 'Cofre del tesoro', category: 'legendario', price: 1350, level: 8, style: 66, w: 1, d: 1, desc: 'Rebosa de monedas bien ganadas.' },
  { id: 'piano', name: 'Piano de cola', category: 'legendario', price: 1600, level: 9, style: 80, w: 2, d: 2, desc: 'Música para cerrar negocios.' },
  { id: 'robot', name: 'Robot asistente', category: 'legendario', price: 1700, level: 10, style: 85, w: 1, d: 1, desc: 'Te trae el café y te alienta.' },
  { id: 'fuente', name: 'Fuente de mármol', category: 'legendario', price: 1900, level: 10, style: 95, w: 2, d: 2, desc: 'Agua que corre, metas que se cumplen.' },
  { id: 'cohete', name: 'Cohete espacial', category: 'legendario', price: 2400, level: 12, style: 120, w: 1, d: 1, desc: 'Tus ventas, directo a la luna.' },
  { id: 'trex', name: 'Esqueleto de T-Rex', category: 'legendario', price: 3200, level: 14, style: 160, w: 2, d: 2, desc: 'La pieza más imponente de la oficina.' },
  { id: 'unicornio', name: 'Unicornio dorado', category: 'legendario', price: 2100, level: 11, style: 105, w: 1, d: 1, desc: 'Para quien hace posible lo imposible.' },
  { id: 'dragon', name: 'Dragón de jade', category: 'legendario', price: 2800, level: 13, style: 140, w: 2, d: 2, desc: 'Guardián de las grandes cuentas.' },
  { id: 'portal', name: 'Portal galáctico', category: 'legendario', price: 3600, level: 15, style: 180, w: 1, d: 1, desc: 'Lleva tus ideas a otra dimensión.' },
  // Áreas comunes
  { id: 'mesa_reuniones', name: 'Mesa de reuniones', category: 'muebles', price: 0, level: 1, style: 0, w: 4, d: 2, hidden: true, desc: '' },
  { id: 'mesa_comedor', name: 'Mesa de comedor', category: 'muebles', price: 0, level: 1, style: 0, w: 4, d: 2, hidden: true, desc: '' },
  { id: 'meson', name: 'Mesón', category: 'muebles', price: 0, level: 1, style: 0, w: 3, d: 1, hidden: true, desc: '' },
  { id: 'mesa_redonda', name: 'Mesa redonda', category: 'muebles', price: 0, level: 1, style: 0, w: 1, d: 1, hidden: true, desc: '' },
  { id: 'meson_recepcion', name: 'Mesón de recepción', category: 'muebles', price: 0, level: 1, style: 0, w: 3, d: 1, hidden: true, desc: '' },
  { id: 'rack', name: 'Rack de servidores', category: 'tecnologia', price: 0, level: 1, style: 0, w: 1, d: 1, hidden: true, desc: '' },
  { id: 'jardinera', name: 'Jardinera', category: 'plantas', price: 0, level: 1, style: 0, w: 3, d: 1, hidden: true, desc: '' },
  { id: 'sillon', name: 'Sillón', category: 'muebles', price: 0, level: 1, style: 0, w: 1, d: 1, hidden: true, desc: '' },
];

export const SHOP_ITEMS = ITEMS.filter((i) => !i.hidden && i.price > 0);

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  muebles: 'Muebles',
  plantas: 'Plantas',
  tecnologia: 'Tecnología',
  deco: 'Decoración',
  premium: 'Premium',
  legendario: 'Legendario',
};

export type Rarity = 'comun' | 'raro' | 'epico' | 'legendario';

export function rarityOf(item: ItemDef): Rarity {
  if (item.category === 'legendario') return 'legendario';
  if (item.price >= 350) return 'epico';
  if (item.price >= 120) return 'raro';
  return 'comun';
}

export const RARITY_LABEL: Record<Rarity, string> = { comun: 'Común', raro: 'Raro', epico: 'Épico', legendario: 'Legendario' };

// ---------------------------------------------------------------------------
// Desempeño
// ---------------------------------------------------------------------------

export interface AwardDef {
  id: string;
  label: string;
  coins: number;
  icon: string;
}

export const AWARDS: AwardDef[] = [
  { id: 'tarea', label: 'Tarea completada', coins: 10, icon: '✅' },
  { id: 'cotizacion', label: 'Cotización enviada', coins: 15, icon: '📄' },
  { id: 'plazo', label: 'Entrega antes de plazo', coins: 20, icon: '⏱️' },
  { id: 'cliente', label: 'Atención destacada a cliente', coins: 30, icon: '🤝' },
  { id: 'capacitacion', label: 'Capacitación completada', coins: 35, icon: '🎓' },
  { id: 'venta', label: 'Venta cerrada', coins: 40, icon: '💼' },
  { id: 'mejora', label: 'Idea de mejora implementada', coins: 50, icon: '💡' },
  { id: 'cliente_nuevo', label: 'Cliente nuevo captado', coins: 60, icon: '🌟' },
  { id: 'meta', label: 'Meta mensual cumplida', coins: 80, icon: '🎯' },
  { id: 'record', label: 'Récord de ventas del mes', coins: 150, icon: '🏆' },
];

export const KUDOS_PER_DAY = 3;
export const KUDOS_COINS = 5;
export const CHECKIN_COINS = 3;
/** Cada cuántos días seguidos de asistencia se da el bono. */
export const STREAK_EVERY = 5;
export const STREAK_BONUS = 15;

// ---------------------------------------------------------------------------
// Niveles
// ---------------------------------------------------------------------------

export const MAX_LEVEL = 20;

/** XP mínima para alcanzar `level` (nivel 1 = 0). Curva: 25·n·(n-1). */
export function xpForLevel(level: number): number {
  return 25 * level * (level - 1);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export const LEVEL_TITLES = [
  'Recién llegado', 'Aprendiz', 'Colaborador', 'Colaborador sólido', 'Referente',
  'Experto', 'Especialista', 'Mentor', 'Líder', 'Estrella',
  'Estrella brillante', 'Crack', 'Gran crack', 'Maestro', 'Gran maestro',
  'Visionario', 'Ícono', 'Leyenda', 'Gran leyenda', 'Mito de la oficina',
];

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

// Las paletas solo crecen al final: los avatares guardan índices.
export const AVATAR_SKIN = ['#f7d7bd', '#eab48d', '#c98e66', '#9a6440', '#6a4129', '#fde6d3', '#d8a27a', '#4e2f1e'];
export const AVATAR_HAIR = [
  '#2b1d14', '#5c3a21', '#a5682e', '#e3b64e', '#c0432f', '#7a7a86', '#ececf2', '#3657a8',
  '#e86fa8', '#8e5bd6', '#3fae6a', '#f3e3b3', '#7d2b1d', '#1f6fbf',
];
export const AVATAR_SHIRT = [
  '#3b6fd6', '#d64545', '#2fa66a', '#f2b134', '#8e5bd6', '#f2f2f6', '#34343f', '#f07fb0', '#2cb8c4',
  '#1d2a44', '#7a1f2b', '#c9b28a', '#4a5d23', '#f07f3c',
];
export const AVATAR_PANTS = ['#2d3a5a', '#3d3d48', '#6b4a2e', '#1e1e26', '#56697a', '#c9b28a', '#7a1f2b', '#e6e4ec', '#2f5d3a'];
export const HAIR_STYLES = [
  'Corto', 'Largo', 'Rapado', 'Crespo', 'Moño', 'Cola', 'Trenzas', 'Mohicano', 'Melena', 'Coletas', 'Calvo', 'De lado', 'Ondas', 'Puntas',
];
export const ACCESSORIES = ['Nada', 'Lentes', 'Audífonos', 'Ambos'];

// ---------------------------------------------------------------------------
// Vestuario: adornos del personaje que se compran con monedas
// ---------------------------------------------------------------------------

export type CosmeticSlot = 'hat' | 'face' | 'neck';

export interface CosmeticDef {
  id: string;
  name: string;
  slot: CosmeticSlot;
  price: number;
  level: number;
  desc: string;
  /** Solo se gana (logros, regalos de administración); no aparece a la venta. */
  special?: boolean;
}

export const SLOT_LABEL: Record<CosmeticSlot, string> = { hat: 'Cabeza', face: 'Cara', neck: 'Cuello' };

export const COSMETICS: CosmeticDef[] = [
  // Cabeza
  { id: 'gorro_lana', name: 'Gorro de lana', slot: 'hat', price: 60, level: 1, desc: 'Para las mañanas frías de Santiago.' },
  { id: 'jockey', name: 'Jockey', slot: 'hat', price: 70, level: 1, desc: 'Visera al frente, actitud ganadora.' },
  { id: 'cintillo_flor', name: 'Cintillo con flor', slot: 'hat', price: 80, level: 2, desc: 'Un toque de primavera.' },
  { id: 'boina', name: 'Boina', slot: 'hat', price: 110, level: 3, desc: 'Estilo artista.' },
  { id: 'casco_obra', name: 'Casco de obra', slot: 'hat', price: 130, level: 3, desc: 'Ingeniería de protección, siempre.' },
  { id: 'gorro_fiesta', name: 'Gorro de fiesta', slot: 'hat', price: 150, level: 4, desc: 'Cada meta cumplida es un cumpleaños.' },
  { id: 'sombrero_vaquero', name: 'Sombrero vaquero', slot: 'hat', price: 220, level: 5, desc: 'El sheriff de las ventas.' },
  { id: 'sombrero_copa', name: 'Sombrero de copa', slot: 'hat', price: 320, level: 6, desc: 'Elegancia de gerencia.' },
  { id: 'cuernos_vikingo', name: 'Casco vikingo', slot: 'hat', price: 420, level: 7, desc: 'Conquista clientes como un guerrero.' },
  { id: 'corona', name: 'Corona', slot: 'hat', price: 900, level: 10, desc: 'Reina o rey de la oficina.' },
  { id: 'aureola', name: 'Aureola', slot: 'hat', price: 1200, level: 12, desc: 'Brilla de pura buena onda.' },
  // Cara
  { id: 'bigote', name: 'Bigote', slot: 'face', price: 50, level: 1, desc: 'Clásico e infalible.' },
  { id: 'barba', name: 'Barba', slot: 'face', price: 90, level: 2, desc: 'Barba completa y bien cuidada.' },
  { id: 'lentes_sol', name: 'Lentes de sol', slot: 'face', price: 120, level: 2, desc: 'El futuro es brillante.' },
  { id: 'pecas', name: 'Pecas', slot: 'face', price: 40, level: 1, desc: 'Un toque natural.' },
  { id: 'monoculo', name: 'Monóculo', slot: 'face', price: 260, level: 6, desc: 'Para revisar contratos con lupa.' },
  { id: 'lentes_pixel', name: 'Lentes pixel', slot: 'face', price: 480, level: 8, desc: 'Deal with it.' },
  // Cuello
  { id: 'humita', name: 'Humita', slot: 'neck', price: 60, level: 1, desc: 'Corbata de lazo, muy formal.' },
  { id: 'bufanda', name: 'Bufanda', slot: 'neck', price: 80, level: 2, desc: 'Abrigadita y con estilo.' },
  { id: 'collar_perlas', name: 'Collar de perlas', slot: 'neck', price: 200, level: 4, desc: 'Un clásico de la elegancia.' },
  { id: 'medalla', name: 'Medalla de oro', slot: 'neck', price: 600, level: 9, desc: 'Para quienes siempre llegan primero.' },
  // Especiales (por logros)
  { id: 'corona_laurel', name: 'Corona de laurel', slot: 'hat', price: 0, level: 1, desc: 'Logro: completar 20 misiones.', special: true },
  { id: 'medalla_puntual', name: 'Medalla de puntualidad', slot: 'neck', price: 0, level: 1, desc: 'Logro: llegar puntual 10 días.', special: true },
];

export const COSMETIC_BY_ID: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
export const SHOP_COSMETICS = COSMETICS.filter((c) => !c.special);

/** Bono diario por completar los tres objetivos del día. */
export const DAILY_BONUS = 12;
