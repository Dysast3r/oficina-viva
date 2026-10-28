import * as Phaser from 'phaser';
import { FLOORS, ITEMS, type FloorDef } from '../../data/catalog';
import type { Avatar } from '../../data/types';
import { POSES, avatarKey, paintCharacter, paintHead, type Pose } from './characters';
import { PET_FRAMES, paintPet, petKey } from './pets';
import { paintItem } from './furniture';
import { ART_SCALE, IsoPainter } from './IsoPainter';
import { OUTLINE, PixelCanvas, fromGrid, shade } from './PixelCanvas';

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const FW = 32 * ART_SCALE;
const FH = 16 * ART_SCALE;

/** Rombo 2:1 de 64×32 que encaja sin huecos con sus vecinos. */
function inDiamond(x: number, y: number): boolean {
  const half = y < FH / 2 ? 2 * (y + 1) : 2 * (FH - y);
  return x >= FW / 2 - half && x < FW / 2 + half;
}

export function paintFloor(def: FloorDef, variant: number): PixelCanvas {
  const pc = new PixelCanvas(FW, FH);
  const [c0, c1] = def.colors;
  const seed = variant * 31 + def.id.length * 7;
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      if (!inDiamond(x, y)) continue;
      // Coordenadas locales de la baldosa (0..16 unidades por eje).
      const u = (y + 0.5 + (x + 0.5 - FW / 2) / 2) / 2;
      const v = (y + 0.5 - (x + 0.5 - FW / 2) / 2) / 2;
      const r = hash(x, y, seed);
      let c = c0;
      switch (def.pattern) {
        case 'tile': {
          // Porcelanato: losa con leve degradé y manchas suaves.
          c = r < 0.12 ? c1 : r > 0.97 ? shade(c0, 0.06) : c0;
          if (u + v < 6) c = shade(c, 0.05);
          if (u < 0.6 || v < 0.6) c = shade(c0, -0.32);
          else if (u > 15.5 || v > 15.5) c = shade(c0, 0.1);
          break;
        }
        case 'carpet':
          c = r < 0.22 ? c1 : r > 0.95 ? shade(c0, 0.07) : c0;
          if (u < 0.5 || v < 0.5) c = shade(c, -0.12);
          break;
        case 'wood': {
          const plank = Math.floor(v / 4);
          c = (plank + variant) % 2 === 0 ? c0 : c1;
          const seam = (plank * 7 + variant * 5) % 16;
          const grain = Math.sin(u * 1.7 + plank * 3) > 0.92;
          if (v % 4 < 0.45 || Math.abs(u - seam) < 0.3) c = shade(c0, -0.28);
          else if (grain) c = shade(c, -0.08);
          else if (r < 0.06) c = shade(c, 0.06);
          break;
        }
        case 'checker':
          c = variant % 2 === 0 ? c0 : c1;
          if (r < 0.04) c = shade(c, 0.05);
          if (u < 0.4 || v < 0.4) c = shade(c, -0.2);
          break;
        case 'marble': {
          const vein = Math.abs(Math.sin((u * 0.7 + v * 0.35 + variant * 3) * 0.9) + Math.sin(v * 0.5 - u * 0.2)) < 0.1;
          c = vein ? c1 : r < 0.1 ? shade(c0, -0.03) : c0;
          if (u < 0.4 || v < 0.4) c = shade(c0, -0.18);
          break;
        }
        case 'grass':
          c = r < 0.3 ? c1 : r > 0.92 ? shade(c0, 0.2) : c0;
          break;
      }
      pc.px(x, y, c);
    }
  }
  return pc;
}

// ---------------------------------------------------------------------------
// Muros
// ---------------------------------------------------------------------------

export const WALL_TALL = 56;
export const WALL_GLASS = 30;
const CAP = '#26272f';
const SLAT = '#7a5236';
const GLASS = '#a8dcef50';

function paintTallWall(side: 'n' | 'w', window: boolean): PixelCanvas {
  const h = WALL_TALL;
  const p = new IsoPainter(1, 1, h + 2);
  const t = 4;
  const face = (u: number, z: number, len: number, hh: number, color: string) =>
    side === 'n' ? p.faceV(u, t, z, len, hh, color) : p.faceU(t, u, z, len, hh, color);
  if (side === 'n') p.box(0, 0, 0, 16, t, h, { top: CAP, left: SLAT, right: shade(SLAT, -0.3) }, false);
  else p.box(0, 0, 0, t, 16, h, { top: CAP, left: shade(SLAT, -0.15), right: shade(SLAT, -0.15) }, false);
  const base = side === 'n' ? SLAT : shade(SLAT, -0.15);
  // Listones verticales.
  for (let u = 1; u < 16; u += 2) face(u, 3, 0.4, h - 9, shade(base, -0.18));
  face(0, 0, 16, 3, '#1c1d24'); // zócalo
  face(0, h - 6, 16, 1, '#ffcf7a'); // tira LED
  face(0, h - 5, 16, 5, shade(CAP, 0.12));
  if (window) {
    face(3, 14, 10, 30, '#1c1d24');
    face(3.8, 15, 8.4, 28, '#18233a');
    // Ciudad de noche.
    for (let k = 0; k < 9; k++) {
      const u = 4.5 + ((k * 37) % 70) / 10;
      const z = 16 + ((k * 53) % 120) / 10;
      face(u, z, 0.8, 0.8, k % 3 === 0 ? '#ffcf7a' : '#6f86b8');
    }
    face(3.8, 15, 8.4, 6, '#243354');
    face(7.6, 15, 0.6, 28, '#1c1d24');
  }
  p.pc.outline();
  return p.pc;
}

function paintGlassWall(side: 'n' | 'w'): PixelCanvas {
  const h = WALL_GLASS;
  const p = new IsoPainter(1, 1, h + 2);
  const frame = '#2c2e38';
  const glass = (u: number, z: number, len: number, hh: number, color: string) =>
    side === 'n' ? p.faceV(u, 1, z, len, hh, color) : p.faceU(1, u, z, len, hh, color);
  if (side === 'n') {
    p.box(0, 0, 0, 16, 1.5, 3, frame);
    glass(0.5, 3, 15, h - 4.5, GLASS);
    p.box(0, 0, 0, 1.5, 1.5, h, frame);
    p.box(0, 0, h - 1.5, 16, 1.5, 1.5, frame);
  } else {
    p.box(0, 0, 0, 1.5, 16, 3, frame);
    glass(0.5, 3, 15, h - 4.5, GLASS);
    p.box(0, 0, 0, 1.5, 1.5, h, frame);
    p.box(0, 0, h - 1.5, 1.5, 16, 1.5, frame);
  }
  // Reflejos diagonales.
  for (const [u, z] of [[3, 8], [4.5, 8], [10, 12]] as [number, number][]) {
    const a = side === 'n' ? p.pt(u, 1, z) : p.pt(1, u, z);
    const b = side === 'n' ? p.pt(u + 3, 1, z + 12) : p.pt(1, u + 3, z + 12);
    p.pc.line(a[0], a[1], b[0], b[1], '#ffffff55');
  }
  p.pc.outline();
  return p.pc;
}

// ---------------------------------------------------------------------------
// Íconos (grillas, al estilo pixel-draw) y luces
// ---------------------------------------------------------------------------

const COIN = [
  '..oooo..',
  '.oyyyYo.',
  'oyywyyYo',
  'oywyyyYo',
  'oyyyyyYo',
  'oyyyyYYo',
  '.oYYYYo.',
  '..oooo..',
];
const HEART = [
  '.oo.oo.',
  'orrorro',
  'orwrrro',
  'orrrrro',
  '.orrro.',
  '..oro..',
  '...o...',
];
const STAR = [
  '...o...',
  '..oyo..',
  'ooyyyoo',
  'oyyyyyo',
  '.oyyyo.',
  '.oyoyo.',
  '.o...o.',
];
const SPARK = ['..w..', '..w..', 'wwyww', '..w..', '..w..'];

const ICON_PAL = { o: OUTLINE, y: '#f6c94a', Y: '#d99a1e', w: '#fff6c8', r: '#ef4f6b' };

// Hoja que cae de las plantas y mariposa que revolotea sobre las flores.
const LEAF = ['..gG', '.gGg', 'gGg.', 'Gg..'];
const BUTTERFLY = ['pp.pp', 'pPoPp', '.pop.', 'pp.pp'];
const NATURE_PAL = { g: '#7cc35a', G: '#3f8a3a', p: '#ff9bd2', P: '#ff6fb0', o: OUTLINE };

/** Mancha de luz radial suave (se dibuja con blend ADD sobre el piso). */
function lightCanvas(color: string, size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.45, `${color}66`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return c;
}

function addPc(scene: Phaser.Scene, key: string, pc: PixelCanvas): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, pc.toCanvas());
}

function addSmooth(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

export function floorKey(id: string, variant: number): string {
  return `floor_${id}_${variant}`;
}

export function itemKey(id: string, rot: 0 | 1): string {
  return `item_${id}_${rot}`;
}

export function wallKey(side: 'n' | 'w', kind: 'tall' | 'window' | 'glass'): string {
  return `wall_${side}_${kind}`;
}

/** Genera todas las texturas estáticas del mundo. */
export function buildWorldTextures(scene: Phaser.Scene): void {
  for (const f of FLOORS) for (const v of [0, 1]) addPc(scene, floorKey(f.id, v), paintFloor(f, v));
  for (const side of ['n', 'w'] as const) {
    addPc(scene, wallKey(side, 'tall'), paintTallWall(side, false));
    addPc(scene, wallKey(side, 'window'), paintTallWall(side, true));
    addPc(scene, wallKey(side, 'glass'), paintGlassWall(side));
  }
  for (const item of ITEMS) {
    const pc = paintItem(item.id);
    addPc(scene, itemKey(item.id, 0), pc);
    addPc(scene, itemKey(item.id, 1), pc.mirrored());
  }
  addPc(scene, 'coin', fromGrid(COIN, ICON_PAL, 'coin'));
  addPc(scene, 'heart', fromGrid(HEART, ICON_PAL, 'heart'));
  addPc(scene, 'star', fromGrid(STAR, ICON_PAL, 'star'));
  addPc(scene, 'spark', fromGrid(SPARK, ICON_PAL, 'spark'));
  addPc(scene, 'leaf', fromGrid(LEAF, NATURE_PAL, 'leaf'));
  for (const kind of ['dog', 'cat'] as const) for (const f of PET_FRAMES) addPc(scene, petKey(kind, f), paintPet(kind, f));
  addPc(scene, 'butterfly', fromGrid(BUTTERFLY, NATURE_PAL, 'butterfly'));

  // Gota de lluvia (trazo fino que se desvanece arriba) y copo de nieve.
  const drop = new PixelCanvas(2, 14);
  for (let y = 0; y < 14; y++) drop.rect(0, y, 1, 1, `#cfe6ff${Math.round(40 + (y / 13) * 200).toString(16).padStart(2, '0')}`);
  addPc(scene, 'raindrop', drop);
  const flake = new PixelCanvas(4, 4);
  flake.rect(1, 0, 2, 4, '#ffffffdd');
  flake.rect(0, 1, 4, 2, '#ffffffdd');
  addPc(scene, 'snowflake', flake);

  const shadow = new PixelCanvas(28, 12);
  shadow.ellipse(14, 6, 13, 5.2, '#00000055');
  shadow.ellipse(14, 6, 9, 3.5, '#00000022');
  addPc(scene, 'shadow', shadow);

  addSmooth(scene, 'light_warm', lightCanvas('#ffb85c'));
  addSmooth(scene, 'light_cyan', lightCanvas('#5fd8ff'));
  addSmooth(scene, 'light_white', lightCanvas('#fff1d6'));
  addSmooth(scene, 'light_pink', lightCanvas('#ff6fd8'));

  // Rombo de selección para el cursor y el modo decoración.
  const hl = new PixelCanvas(FW, FH);
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      if (!inDiamond(x, y)) continue;
      const edge = !inDiamond(x - 1, y) || !inDiamond(x + 1, y) || !inDiamond(x, y - 1) || !inDiamond(x, y + 1);
      hl.px(x, y, edge ? '#ffffffdd' : '#ffffff1c');
    }
  }
  addPc(scene, 'tile_hl', hl);
}

// ---------------------------------------------------------------------------
// Letreros sobre los muros (texto inclinado en el plano del muro)
// ---------------------------------------------------------------------------

export const SIGN_RES = 4;

/**
 * Placa oscura con el nombre de la sala, cizallada para quedar pegada al
 * muro norte (side 'n': baja hacia la derecha) u oeste ('w': baja hacia la
 * izquierda). Se dibuja a SIGN_RES× con filtro suave para que el texto se lea.
 */
export function buildSign(scene: Phaser.Scene, key: string, text: string, accent: string, side: 'n' | 'w'): { w: number; h: number } {
  const font = `800 ${11 * SIGN_RES}px Nunito, "Segoe UI", sans-serif`;
  const probe = document.createElement('canvas').getContext('2d');
  if (probe === null) return { w: 0, h: 0 };
  probe.font = font;
  const label = text.toUpperCase();
  const tw = probe.measureText(label).width + label.length * SIGN_RES * 1.2;
  const pw = Math.ceil(tw + 16 * SIGN_RES);
  const ph = 17 * SIGN_RES;
  const c = document.createElement('canvas');
  c.width = pw;
  c.height = Math.ceil(ph + pw / 2);
  const ctx = c.getContext('2d');
  if (ctx === null) return { w: 0, h: 0 };
  if (side === 'n') ctx.setTransform(1, 0.5, 0, 1, 0, 0);
  else ctx.setTransform(1, -0.5, 0, 1, 0, pw / 2);
  // Sombra, placa y filo de color.
  ctx.fillStyle = '#00000066';
  ctx.beginPath();
  ctx.roundRect(SIGN_RES, SIGN_RES * 1.5, pw - SIGN_RES, ph - SIGN_RES, 3 * SIGN_RES);
  ctx.fill();
  ctx.fillStyle = '#1b1d26';
  ctx.strokeStyle = '#3a3d4a';
  ctx.lineWidth = SIGN_RES;
  ctx.beginPath();
  ctx.roundRect(0, 0, pw - SIGN_RES, ph - SIGN_RES, 3 * SIGN_RES);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillRect(4 * SIGN_RES, ph - SIGN_RES * 4, pw - 9 * SIGN_RES, SIGN_RES);
  ctx.font = font;
  ctx.fillStyle = '#f5f2ea';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${1.2 * SIGN_RES}px`;
  ctx.fillText(label, 7 * SIGN_RES, ph / 2 - SIGN_RES);
  addSmooth(scene, key, c);
  return { w: pw / SIGN_RES, h: ph / SIGN_RES };
}

// ---------------------------------------------------------------------------
// Personajes
// ---------------------------------------------------------------------------

export function charKey(a: Avatar, pose: Pose): string {
  return `${avatarKey(a)}_${pose}`;
}

export function headKey(a: Avatar): string {
  return `${avatarKey(a)}_head`;
}

/** Texturas del personaje para un avatar (se generan una vez por combinación). */
export function ensureAvatar(scene: Phaser.Scene, a: Avatar): void {
  for (const pose of POSES) {
    const key = charKey(a, pose);
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paintCharacter(a, pose).toCanvas());
  }
  if (!scene.textures.exists(headKey(a))) scene.textures.addCanvas(headKey(a), paintHead(a).toCanvas());
}

// ---------------------------------------------------------------------------
// Imágenes para la UI de React (mismo arte, como data URL)
// ---------------------------------------------------------------------------

const urlCache = new Map<string, string>();

function cached(key: string, make: () => string): string {
  let url = urlCache.get(key);
  if (url === undefined) {
    url = make();
    urlCache.set(key, url);
  }
  return url;
}

export function itemIconURL(itemId: string): string {
  return cached(`item:${itemId}`, () => paintItem(itemId).toCanvas().toDataURL());
}

export function floorIconURL(def: FloorDef): string {
  return cached(`floor:${def.id}`, () => {
    // Cuatro baldosas en rombo para que se lea el patrón.
    const pc = new PixelCanvas(FW * 2, FH * 2);
    const tiles: [number, number, number][] = [[FW / 2, 0, 0], [0, FH / 2, 1], [FW, FH / 2, 1], [FW / 2, FH, 0]];
    for (const [ox, oy, v] of tiles) {
      const t = paintFloor(def, v);
      for (let i = 0; i < t.data.length; i += 4) {
        if (t.data[i + 3] === 0) continue;
        const x = (i / 4) % FW;
        const y = Math.floor(i / 4 / FW);
        const hex = `#${[t.data[i], t.data[i + 1], t.data[i + 2]].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
        pc.px(ox + x, oy + y, hex);
      }
    }
    return pc.toCanvas().toDataURL();
  });
}

export function avatarURL(a: Avatar, pose: Pose = 'front0'): string {
  return cached(`${avatarKey(a)}:${pose}`, () => paintCharacter(a, pose).toCanvas().toDataURL());
}

export function iconURL(name: 'coin' | 'heart' | 'star'): string {
  return cached(`icon:${name}`, () => {
    const grid = name === 'coin' ? COIN : name === 'heart' ? HEART : STAR;
    return fromGrid(grid, ICON_PAL, name).toCanvas().toDataURL();
  });
}
