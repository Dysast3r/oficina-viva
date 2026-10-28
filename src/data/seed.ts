import { levelForXp } from './catalog';
import { defaultPlacement, plotRect } from './layout';
import type { Avatar, DeptId, Employee, GameState, PlacedItem, Role } from './types';

/** [cuerpo (0 hombre, 1 mujer), piel, pelo, peinado, chaqueta, pantalón, accesorio] */
type AvatarRow = [0 | 1, number, number, number, number, number, number];
type SeedRow = [name: string, title: string, dept: DeptId, role: Role, xp: number, avatar: AvatarRow];

// Equipo de ejemplo (ficticio). En Ventas la primera es la coordinadora (puesto 0, el amplio).
const PEOPLE: SeedRow[] = [
  ['Andrés Fuentes', 'Gerente General', 'gerencia', 'gerente', 0, [0, 2, 5, 0, 6, 1, 0]],
  ['Camila Torres', 'Analista de Sistemas', 'ti', 'admin', 820, [1, 0, 1, 0, 6, 0, 3]],
  ['Valentina Soto', 'Asistente Contable', 'contabilidad', 'colaborador', 0, [1, 1, 2, 4, 2, 0, 1]],
  ['Josefa Muñoz', 'Coordinadora Comercial', 'ventas', 'jefatura', 0, [1, 1, 0, 1, 7, 3, 2]],
  ['Diego Herrera', 'Gestor de Negocios', 'ventas', 'colaborador', 0, [0, 1, 0, 0, 0, 3, 2]],
  ['Antonia Reyes', 'Gestora de Negocios', 'ventas', 'colaborador', 0, [1, 0, 3, 1, 4, 0, 2]],
  ['Tomás Castillo', 'Gestor de Negocios', 'ventas', 'colaborador', 0, [0, 3, 0, 3, 1, 4, 2]],
  ['Matías Navarro', 'Gestor de Negocios', 'ventas', 'colaborador', 0, [0, 4, 0, 2, 2, 1, 2]],
  ['Isidora Paredes', 'Gestora de Negocios', 'ventas', 'colaborador', 0, [1, 2, 4, 3, 3, 1, 1]],
  ['Florencia Silva', 'Gestora de Negocios', 'ventas', 'colaborador', 0, [1, 0, 1, 4, 8, 0, 2]],
  ['Vicente Morales', 'Gestor de Negocios', 'ventas', 'colaborador', 0, [0, 2, 2, 0, 3, 3, 0]],
  ['Martina Espinoza', 'Gestora de Negocios', 'ventas', 'colaborador', 0, [1, 1, 7, 3, 5, 0, 1]],
];

/** Decoración que ya "compraron" los de ejemplo, según su nivel (x desde la derecha si es negativa). */
const DECOR_BY_LEVEL: { level: number; itemId: string; x: number; y: number }[] = [
  // Nada alto en (0,0), (1,0) ni (0,1): en pantalla quedan detrás de la cabeza de quien se sienta en (1,1).
  { level: 2, itemId: 'planta', x: 0, y: 3 },
  { level: 3, itemId: 'lampara', x: -1, y: 0 },
  { level: 4, itemId: 'alfombra', x: 1, y: 1 },
  { level: 5, itemId: 'archivador', x: 0, y: 2 },
  { level: 6, itemId: 'monstera', x: -1, y: 3 },
  { level: 7, itemId: 'cafetera', x: -1, y: 1 },
  { level: 8, itemId: 'trofeo', x: -2, y: 0 },
];

const FLOOR_BY_LEVEL: [number, string][] = [
  [9, 'marmol'],
  [7, 'parquet_oscuro'],
  [5, 'parquet'],
  [4, 'alfombra_azul'],
];

let uidCounter = 0;
export function newUid(prefix = 'i'): string {
  uidCounter++;
  return `${prefix}${Date.now().toString(36)}${uidCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function makeEmployee(
  id: string,
  name: string,
  title: string,
  dept: DeptId,
  role: Role,
  plot: number,
  avatar: Avatar,
): Employee {
  return {
    id,
    name,
    title,
    dept,
    role,
    avatar,
    coins: 0,
    xp: 0,
    inventory: {},
    placed: defaultPlacement(dept, plot).map((p) => ({ ...p, uid: newUid() })),
    floor: 'sala',
    ownedFloors: [],
    lastCheckIn: null,
    streak: 0,
    kudosGiven: { date: '', count: 0 },
    plot,
  };
}

export function createSeedState(): GameState {
  const employees: Record<string, Employee> = {};
  const plotsUsed: Partial<Record<DeptId, number>> = {};

  PEOPLE.forEach(([name, title, dept, role, xp, a], i) => {
    const plot = plotsUsed[dept] ?? 0;
    plotsUsed[dept] = plot + 1;
    const id = `e${i + 1}`;
    const emp = makeEmployee(id, name, title, dept, role, plot, {
      body: a[0],
      skin: a[1],
      hair: a[2],
      hairStyle: a[3],
      shirt: a[4],
      pants: a[5],
      acc: a[6],
    });
    emp.xp = xp;
    // Parte de lo ganado ya se gastó en decoración.
    emp.coins = Math.round(xp * 0.2);
    const level = levelForXp(xp);
    const rect = plotRect(dept, plot);
    const taken = new Set(emp.placed.map((p) => `${p.x},${p.y}`));
    const extra: PlacedItem[] = [];
    for (const d of DECOR_BY_LEVEL) {
      if (level < d.level) continue;
      const x = d.x < 0 ? rect.w + d.x : d.x;
      if (taken.has(`${x},${d.y}`)) continue;
      taken.add(`${x},${d.y}`);
      extra.push({ uid: newUid(), itemId: d.itemId, x, y: d.y, rot: 0 });
    }
    emp.placed.push(...extra);
    const floor = FLOOR_BY_LEVEL.find(([lv]) => level >= lv);
    if (floor) {
      emp.floor = floor[1];
      emp.ownedFloors.push(floor[1]);
    }
    if (level >= 3) emp.inventory = { cactus: 1 };
    employees[id] = emp;
  });

  return { version: 1, employees, currentUserId: null, feed: [] };
}
