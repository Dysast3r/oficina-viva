/**
 * Proyección isométrica 2:1. Una baldosa mide 32×16 px en pantalla.
 * (tx, ty) es la baldosa; su esquina superior queda en `tileTop(tx, ty)`.
 *
 * Para dibujar se usa un espacio (u, v, z) en "unidades": una baldosa son 16
 * unidades por lado y z son píxeles de altura. Así un mueble se describe con
 * medidas reales y la proyección pone los escalones de 2 px de cada borde.
 */
export const TILE_W = 32;
export const TILE_H = 16;
export const UNIT = 16;

export function tileTop(tx: number, ty: number): { x: number; y: number } {
  return { x: (tx - ty) * (TILE_W / 2), y: (tx + ty) * (TILE_H / 2) };
}

/** Centro de la baldosa en pantalla (donde pisan los personajes). */
export function tileCenter(tx: number, ty: number): { x: number; y: number } {
  const t = tileTop(tx, ty);
  return { x: t.x, y: t.y + TILE_H / 2 };
}

/** Punto continuo en coordenadas de baldosa → pantalla. */
export function project(fx: number, fy: number): { x: number; y: number } {
  return { x: (fx - fy) * (TILE_W / 2), y: (fx + fy) * (TILE_H / 2) };
}

export function screenToTile(wx: number, wy: number): { tx: number; ty: number } {
  const a = wy / (TILE_H / 2);
  const b = wx / (TILE_W / 2);
  return { tx: Math.floor((a + b) / 2), ty: Math.floor((a - b) / 2) };
}

/**
 * Profundidad de dibujo: crece hacia el espectador. Los objetos usan su
 * esquina frontal; los personajes, la posición de sus pies.
 */
export function depthOf(fx: number, fy: number, bias = 0): number {
  return (fx + fy) * 10 + bias;
}
