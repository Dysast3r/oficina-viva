import { MAP_H, MAP_W, canCross } from '../../data/layout';

export type Point = { x: number; y: number };

const DIRS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * A* en 4-vecindad. `blocked` son baldosas ocupadas por muebles; la meta se
 * acepta aunque esté ocupada (sentarse en la silla). Devuelve el camino sin
 * el punto de partida, o null si no hay.
 */
export function findPath(start: Point, goal: Point, blocked: Set<string>, limit = 4000): Point[] | null {
  const key = (p: Point) => p.y * MAP_W + p.x;
  const goalKey = key(goal);
  const open: { p: Point; f: number }[] = [{ p: start, f: 0 }];
  const g = new Map<number, number>([[key(start), 0]]);
  const came = new Map<number, Point>();
  let steps = 0;

  while (open.length > 0 && steps++ < limit) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const { p } = open.splice(best, 1)[0];
    if (key(p) === goalKey) {
      const path: Point[] = [];
      let cur: Point | undefined = p;
      while (cur !== undefined && key(cur) !== key(start)) {
        path.unshift(cur);
        cur = came.get(key(cur));
      }
      return path;
    }
    const gp = g.get(key(p)) ?? 0;
    for (const d of DIRS) {
      const n = { x: p.x + d.x, y: p.y + d.y };
      if (n.x < 0 || n.y < 0 || n.x >= MAP_W || n.y >= MAP_H) continue;
      const nk = key(n);
      if (nk !== goalKey && blocked.has(`${n.x},${n.y}`)) continue;
      if (!canCross(p.x, p.y, n.x, n.y)) continue;
      const cost = gp + 1;
      if (cost < (g.get(nk) ?? Infinity)) {
        g.set(nk, cost);
        came.set(nk, p);
        open.push({ p: n, f: cost + Math.abs(n.x - goal.x) + Math.abs(n.y - goal.y) });
      }
    }
  }
  return null;
}
