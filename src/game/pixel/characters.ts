import { AVATAR_HAIR, AVATAR_PANTS, AVATAR_SHIRT, AVATAR_SKIN } from '../../data/catalog';
import type { Avatar } from '../../data/types';
import { OUTLINE, PixelCanvas, shade } from './PixelCanvas';

/**
 * Personajes chibi en vista 3/4, pintados por código a 2× (32×60 px de
 * textura = 16×30 de mundo). Cada cuadro es una combinación de parámetros
 * (vista, fase de caminata, respiración, parpadeo, sentado, tecleo): igual
 * que un grid.txt, la fuente de verdad son datos y el PNG se deriva.
 *
 * "front" mira hacia +u (abajo-derecha); "back" hacia −v (arriba-derecha).
 * Las otras dos direcciones son su espejo.
 */
export const CHAR_W = 32;
/** Margen superior para sombreros altos (copa, gorro de fiesta, cuernos). */
export const HAT_PAD = 10;
const BODY_H = 60;
export const CHAR_H = BODY_H + HAT_PAD;

export type Pose =
  | 'front0' | 'front1' | 'front_blink'
  | 'fwalk0' | 'fwalk1' | 'fwalk2' | 'fwalk3'
  | 'back0' | 'back1'
  | 'bwalk0' | 'bwalk1' | 'bwalk2' | 'bwalk3'
  | 'sit0' | 'sit1' | 'sit_blink' | 'sit_type0' | 'sit_type1'
  // Gestos: saludar, estirarse, tomar café (de pie) y hablar por teléfono (sentado).
  | 'wave0' | 'wave1' | 'stretch' | 'drink' | 'sit_phone';

export const POSES: Pose[] = [
  'front0', 'front1', 'front_blink', 'fwalk0', 'fwalk1', 'fwalk2', 'fwalk3',
  'back0', 'back1', 'bwalk0', 'bwalk1', 'bwalk2', 'bwalk3',
  'sit0', 'sit1', 'sit_blink', 'sit_type0', 'sit_type1',
  'wave0', 'wave1', 'stretch', 'drink', 'sit_phone',
];

type Gesture = 'wave0' | 'wave1' | 'stretch' | 'drink' | 'phone' | null;

interface Frame {
  back: boolean;
  /** −1 quieto; 0..3 fases de caminata (contacto, paso, contacto, paso). */
  walk: number;
  breathe: boolean;
  blink: boolean;
  sit: boolean;
  /** −1 sin teclear; 0/1 manos alternadas. */
  type: number;
  gesture: Gesture;
}

function frameOf(pose: Pose): Frame {
  const f: Frame = { back: false, walk: -1, breathe: false, blink: false, sit: false, type: -1, gesture: null };
  if (pose === 'wave0' || pose === 'wave1' || pose === 'stretch' || pose === 'drink') f.gesture = pose;
  if (pose === 'sit_phone') f.gesture = 'phone';
  if (pose.startsWith('back') || pose.startsWith('bwalk')) f.back = true;
  if (pose.includes('walk')) f.walk = Number(pose.slice(-1));
  if (pose === 'front1' || pose === 'back1' || pose === 'sit1') f.breathe = true;
  if (pose.endsWith('blink')) f.blink = true;
  if (pose.startsWith('sit')) f.sit = true;
  if (pose.startsWith('sit_type')) f.type = Number(pose.slice(-1));
  return f;
}

const EYE = '#1b1626';
const MOUTH = '#a8444e';
const BLUSH = '#f0828c66';
const SHIRT = '#f4f4f8';
const SHOE = '#2a2430';

function palette(a: Avatar) {
  const skin = AVATAR_SKIN[a.skin] ?? AVATAR_SKIN[0];
  const hair = AVATAR_HAIR[a.hair] ?? AVATAR_HAIR[0];
  const jacket = AVATAR_SHIRT[a.shirt] ?? AVATAR_SHIRT[0];
  const pants = AVATAR_PANTS[a.pants] ?? AVATAR_PANTS[0];
  return {
    skin,
    skinD: shade(skin, -0.16),
    skinDD: shade(skin, -0.3),
    hair,
    hairD: shade(hair, -0.3),
    hairL: shade(hair, 0.28),
    jacket,
    jacketD: shade(jacket, -0.24),
    jacketL: shade(jacket, 0.15),
    pants,
    pantsD: shade(pants, -0.3),
    tie: a.shirt === 1 ? '#2d3a5a' : '#c0392b',
  };
}

type Pal = ReturnType<typeof palette>;

/** Elipse con mitad derecha sombreada (luz desde la izquierda). */
function shadedEllipse(pc: PixelCanvas, cx: number, cy: number, rx: number, ry: number, light: string, dark: string): void {
  pc.ellipse(cx, cy, rx, ry, light);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx + rx * 0.45); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) pc.px(x, y, dark);
    }
  }
}

// ---------------------------------------------------------------------------
// Partes
// ---------------------------------------------------------------------------

function legs(pc: PixelCanvas, p: Pal, f: Frame, top: number): void {
  // Pierna izquierda (atrás en 3/4) y derecha (adelante).
  const liftL = f.walk === 0 ? 2 : 0;
  const liftR = f.walk === 2 ? 2 : 0;
  const swing = f.walk === 0 ? -1 : f.walk === 2 ? 1 : 0;
  const bottom = 55;
  const leg = (x: number, lift: number, dx: number, color: string, dark: string) => {
    pc.rect(x + dx, top, 5, bottom - top - lift, color);
    pc.rect(x + dx + 3, top, 2, bottom - top - lift, dark);
    pc.rect(x + dx - (f.back ? 0 : 0), bottom - lift, 6, 3, SHOE);
    pc.rect(x + dx + (f.back ? -1 : 1), bottom - lift + 1, 6, 2, SHOE);
    pc.px(x + dx + 1, bottom - lift, shade(SHOE, 0.3));
  };
  leg(10, liftL, -swing, p.pantsD, shade(p.pantsD, -0.15));
  leg(17, liftR, swing, p.pants, p.pantsD);
}

function torso(pc: PixelCanvas, p: Pal, a: Avatar, f: Frame, y0: number): void {
  // Chaqueta con hombros redondeados.
  pc.rect(8, y0 + 2, 16, 14, p.jacket);
  pc.ellipse(10, y0 + 3, 3, 3, p.jacket);
  pc.ellipse(22, y0 + 3, 3, 3, p.jacketD);
  pc.rect(19, y0 + 2, 5, 14, p.jacketD);
  if (f.back) {
    pc.line(16, y0 + 3, 16, y0 + 15, shade(p.jacket, -0.12));
    pc.rect(9, y0 + 1, 14, 2, p.jacketL);
    return;
  }
  // Camisa en V, solapas y corbata (o collar).
  pc.poly([[12.5, y0 + 1], [19.5, y0 + 1], [16, y0 + 10]], SHIRT);
  pc.line(12, y0 + 1, 15, y0 + 9, p.jacketL);
  pc.line(20, y0 + 1, 17, y0 + 9, shade(p.jacketD, 0.1));
  if (a.body === 0) {
    pc.rect(15, y0 + 2, 2, 2, p.tie);
    pc.poly([[14.6, y0 + 4], [17.4, y0 + 4], [17, y0 + 10], [16, y0 + 11], [15, y0 + 10]], p.tie);
  } else {
    pc.px(16, y0 + 5, '#f2c134');
    pc.px(15, y0 + 4, '#e3c98a');
    pc.px(17, y0 + 4, '#e3c98a');
  }
  pc.px(16, y0 + 12, shade(p.jacket, -0.35));
  pc.px(16, y0 + 14, shade(p.jacket, -0.35));
  // Bolsillo con pañuelo.
  pc.rect(19, y0 + 6, 3, 1, shade(p.jacketD, -0.1));
}

function arms(pc: PixelCanvas, p: Pal, f: Frame, y0: number): void {
  if (f.sit && !f.back) {
    // Antebrazos hacia el escritorio; las manos se alternan al teclear.
    const l = f.type === 0 ? -1 : 0;
    const r = f.type === 1 ? -1 : 0;
    pc.rect(5, y0 + 2, 4, 8, p.jacket);
    pc.rect(23, y0 + 2, 4, 8, p.jacketD);
    pc.rect(7, y0 + 9, 6, 3, p.jacket);
    pc.rect(19, y0 + 9, 6, 3, p.jacketD);
    pc.rect(12, y0 + 9 + l, 3, 3, p.skin);
    pc.rect(18, y0 + 9 + r, 3, 3, p.skinD);
    return;
  }
  if (f.gesture === 'stretch') {
    // Brazos estirados hacia arriba, por fuera de la cabeza, con las manos sobre ella.
    pc.rect(2, 4, 4, y0 - 1, p.jacket);
    pc.rect(2, 4, 1, y0 - 1, p.jacketL);
    pc.rect(2, 0, 4, 4, p.skin);
    pc.rect(26, 4, 4, y0 - 1, p.jacketD);
    pc.rect(26, 0, 4, 4, p.skinD);
    return;
  }
  const swing = f.walk === 0 ? 1 : f.walk === 2 ? -1 : 0;
  const armL = (dy: number) => {
    pc.rect(5, y0 + 2 + dy, 4, 11, p.jacket);
    pc.rect(5, y0 + 2 + dy, 1, 11, p.jacketL);
    pc.rect(5, y0 + 13 + dy, 4, 3, p.skin);
  };
  const armR = (dy: number) => {
    pc.rect(23, y0 + 2 + dy, 4, 11, p.jacketD);
    pc.rect(23, y0 + 13 + dy, 4, 3, p.skinD);
  };
  // En los gestos, el brazo que se mueve se dibuja aparte (sobre la cabeza).
  if (f.gesture !== 'drink') armL(swing);
  if (f.gesture === null) armR(-swing);
}

/** Brazo del gesto, dibujado después de la cabeza para que quede delante. */
function gestureArm(pc: PixelCanvas, p: Pal, f: Frame, y0: number, headCy: number): void {
  if (f.gesture === 'wave0' || f.gesture === 'wave1') {
    // Mano en alto que se mueve de lado a lado.
    // Brazo en alto por fuera de la cabeza; la mano va y viene.
    const up = f.gesture === 'wave1';
    pc.rect(23, y0 + 1, 4, 5, p.jacketD);
    pc.rect(26, y0 - 15, 4, 18, p.jacket);
    pc.rect(29, y0 - 15, 1, 18, p.jacketD);
    pc.rect(up ? 25 : 27, y0 - 20, 4, 5, p.skin);
    pc.px(up ? 24 : 26, y0 - 19, p.skin);
  }
  if (f.gesture === 'drink') {
    // Taza a la boca con la mano izquierda.
    pc.rect(5, y0 + 2, 4, 6, p.jacket);
    pc.rect(7, y0 - 1, 5, 4, p.jacket);
    pc.rect(10, y0 - 3, 3, 3, p.skin);
    const my = headCy + 4;
    pc.rect(11, my, 5, 6, '#f4f1ea');
    pc.rect(11, my, 5, 1, '#6b4a32');
    pc.rect(10, my + 2, 1, 2, '#d8d3c8');
  }
  if (f.gesture === 'phone') {
    // Celular a la oreja derecha.
    pc.rect(23, y0 + 2, 4, 5, p.jacketD);
    pc.rect(24, y0 - 4, 4, 7, p.jacketD);
    pc.rect(24, headCy + 2, 3, 3, p.skinD);
    pc.rect(25, headCy - 3, 2, 7, '#2b2f3a');
    pc.px(25, headCy - 3, '#7fd6ff');
  }
}

function headBase(pc: PixelCanvas, p: Pal, cy: number): void {
  pc.rect(14, cy + 9, 4, 4, p.skinD); // cuello
  shadedEllipse(pc, 16, cy, 11, 11, p.skin, p.skinD);
  pc.ellipse(5.5, cy + 1, 1.8, 2.5, p.skinD);
  pc.ellipse(26.5, cy + 1, 1.8, 2.5, p.skinDD);
}

function face(pc: PixelCanvas, p: Pal, a: Avatar, f: Frame, cy: number): void {
  const ey = cy - 1;
  const eyes = [11, 19];
  for (const ex of eyes) {
    if (f.blink) {
      pc.rect(ex, ey + 3, 3, 1, EYE);
    } else {
      pc.rect(ex, ey, 3, 4, EYE);
      pc.px(ex, ey, '#ffffff');
      pc.px(ex + 2, ey + 3, '#4a4560');
      if (a.body === 1) {
        pc.px(ex - 1, ey, EYE);
        pc.px(ex + 3, ey, EYE);
      }
    }
    // Cejas
    pc.rect(ex - 1, ey - 3, 4, 1, p.hairD);
  }
  pc.px(17, ey + 4, p.skinD); // nariz
  // Sonrisa
  pc.px(15, ey + 6, MOUTH);
  pc.rect(16, ey + 7, 2, 1, MOUTH);
  pc.px(18, ey + 6, MOUTH);
  if (a.body === 1) {
    pc.rect(16, ey + 7, 2, 1, '#c84a5c');
  }
  pc.rect(9, ey + 5, 2, 1, BLUSH);
  pc.rect(22, ey + 5, 2, 1, BLUSH);
}

/** Pelo detrás de la cabeza (largo, moño, cola, ondas). Se dibuja antes que la cabeza. */
function hairBack(pc: PixelCanvas, p: Pal, style: number, f: Frame, cy: number): void {
  if (style === 1) {
    pc.rect(5, cy - 4, 22, f.back ? 26 : 22, p.hairD);
    pc.ellipse(16, cy + (f.back ? 21 : 17), 11, 4, p.hairD);
  }
  if (style === 4) {
    shadedEllipse(pc, 16, cy - 12, 5, 4.5, p.hair, p.hairD);
    pc.px(14, cy - 14, p.hairL);
  }
  if (style === 5 && !f.back) {
    // Cola de caballo asomando por detrás, a la derecha.
    pc.ellipse(27, cy + 2, 3, 7, p.hairD);
    pc.ellipse(28, cy + 9, 2, 4, p.hairD);
  }
  if (style === 12) {
    // Ondas largas: como el largo, pero con borde ondulado.
    pc.rect(5, cy - 4, 22, f.back ? 24 : 20, p.hairD);
    for (let x = 5; x <= 27; x += 4) pc.ellipse(x + 1, cy + (f.back ? 20 : 16), 2.6, 3, p.hairD);
  }
}

function hairFront(pc: PixelCanvas, p: Pal, style: number, f: Frame, cy: number): void {
  const capTop = (ry: number, maxY: number, color: string, dark: string) => {
    for (let y = Math.floor(cy - ry - 1); y <= maxY; y++) {
      for (let x = 3; x < 29; x++) {
        const dx = (x + 0.5 - 16) / 12;
        const dy = (y + 0.5 - (cy - 2)) / (ry + 1);
        if (dx * dx + dy * dy <= 1) pc.px(x, y, x > 22 ? dark : color);
      }
    }
  };
  if (style === 10) {
    // Calvo: solo el brillo de la cabeza.
    if (!f.back) {
      pc.rect(10, cy - 9, 4, 1, shade(p.skin, 0.25));
      pc.px(9, cy - 8, shade(p.skin, 0.25));
    }
    return;
  }
  if (f.back) {
    // De espalda el pelo cubre la cabeza; varía hasta dónde baja.
    const bottom = style === 2 || style === 7 ? cy + 2 : style === 1 || style === 12 ? cy + 16 : style === 8 ? cy + 9 : cy + 7;
    capTop(10, bottom, style === 7 ? p.hairD : p.hair, p.hairD);
    pc.rect(9, cy - 9, 5, 1, p.hairL);
    if (style === 3) {
      for (const [x, y] of [[6, cy - 6], [26, cy - 6], [10, cy - 11], [22, cy - 11], [16, cy - 12], [5, cy + 1], [27, cy + 1]]) {
        pc.ellipse(x, y, 4, 4, p.hair);
      }
    }
    if (style === 4) pc.line(12, cy - 9, 15, cy - 11, p.hairL);
    if (style === 5) {
      pc.rect(14, cy - 2, 4, 3, shade(p.hairD, -0.2)); // coletero
      pc.ellipse(16, cy + 8, 3, 7, p.hair);
    }
    if (style === 6) {
      for (const x of [8, 22]) for (let y = cy + 4; y < cy + 18; y += 3) pc.ellipse(x + 1, y, 2, 1.8, (y / 3) % 2 ? p.hair : p.hairD);
    }
    if (style === 7) pc.rect(13, cy - 16, 6, 18, p.hair);
    if (style === 9) {
      pc.ellipse(3, cy + 1, 3, 5, p.hair);
      pc.ellipse(29, cy + 1, 3, 5, p.hairD);
    }
    if (style === 13) for (const x of [8, 13, 18, 23]) pc.poly([[x - 2, cy - 8], [x + 2, cy - 8], [x, cy - 15]], p.hair);
    return;
  }
  switch (style) {
    case 5: // cola: casco con flequillo y coletero
    case 9: // coletas
    case 13: // puntas
    case 11: {
      // de lado: flequillo cargado a un lado
      capTop(10, cy - 4, p.hair, p.hairD);
      if (style === 11) {
        pc.poly([[5, cy - 6], [24, cy - 9], [27, cy - 4], [8, cy - 2]], p.hair);
        pc.line(8, cy - 8, 22, cy - 10, p.hairL);
        pc.rect(4, cy - 4, 3, 7, p.hair);
        pc.rect(25, cy - 4, 3, 5, p.hairD);
      } else {
        for (let x = 6; x < 27; x++) {
          const fringe = cy - 4 + ((x * 3) % 4 === 0 ? 2 : x % 3 === 0 ? 1 : 0);
          for (let y = cy - 5; y <= fringe; y++) pc.px(x, y, x > 22 ? p.hairD : p.hair);
        }
        pc.rect(4, cy - 4, 3, 7, p.hair);
        pc.rect(25, cy - 4, 3, 6, p.hairD);
        pc.line(9, cy - 9, 14, cy - 11, p.hairL);
      }
      if (style === 9) {
        pc.ellipse(2.5, cy + 1, 3, 5.5, p.hair);
        pc.ellipse(29.5, cy + 1, 3, 5.5, p.hairD);
        pc.rect(3, cy - 4, 2, 2, '#e86fa8');
        pc.rect(28, cy - 4, 2, 2, '#e86fa8');
      }
      if (style === 13) {
        for (const [x, top] of [[7, cy - 15], [11, cy - 17], [16, cy - 18], [21, cy - 17], [25, cy - 15]] as [number, number][]) {
          pc.poly([[x - 3, cy - 8], [x + 3, cy - 8], [x, top]], x > 22 ? p.hairD : p.hair);
          pc.px(x, top + 2, p.hairL);
        }
      }
      if (style === 5) pc.rect(24, cy - 7, 3, 2, shade(p.hairD, -0.25));
      break;
    }
    case 6: // trenzas
      capTop(10, cy - 4, p.hair, p.hairD);
      for (let x = 6; x < 27; x++) for (let y = cy - 5; y <= cy - 3; y++) pc.px(x, y, x > 22 ? p.hairD : p.hair);
      pc.line(16, cy - 12, 16, cy - 5, p.hairD);
      for (const x of [4, 27]) {
        for (let y = cy - 3; y < cy + 15; y += 3) pc.ellipse(x, y, 2.2, 1.8, (y - cy) % 2 ? p.hair : p.hairD);
        pc.rect(x - 1, cy + 15, 3, 2, '#e86fa8');
      }
      break;
    case 7: // mohicano
      capTop(9, cy - 5, p.hairD, shade(p.hairD, -0.15));
      pc.rect(13, cy - 18, 6, 10, p.hair);
      for (let y = cy - 18; y < cy - 8; y += 2) pc.px(14, y, p.hairL);
      pc.rect(18, cy - 17, 1, 9, p.hairD);
      break;
    case 8: // melena (bob)
      capTop(10, cy - 4, p.hair, p.hairD);
      pc.rect(6, cy - 5, 21, 3, p.hair);
      pc.rect(3, cy - 5, 4, 13, p.hair);
      pc.rect(25, cy - 5, 4, 13, p.hairD);
      pc.line(9, cy - 9, 14, cy - 11, p.hairL);
      break;
    case 12: // ondas: casco y mechones ondulados a los lados
      capTop(10, cy - 4, p.hair, p.hairD);
      for (let x = 6; x < 27; x++) {
        const fringe = cy - 4 + (x % 4 === 0 ? 1 : 0);
        for (let y = cy - 5; y <= fringe; y++) pc.px(x, y, x > 22 ? p.hairD : p.hair);
      }
      for (let y = cy - 4; y < cy + 14; y += 3) {
        pc.ellipse(4 + ((y / 3) % 2), y, 2.5, 2, p.hair);
        pc.ellipse(28 - ((y / 3) % 2), y, 2.5, 2, p.hairD);
      }
      pc.line(9, cy - 9, 14, cy - 11, p.hairL);
      break;
    case 2: // rapado
      capTop(9, cy - 5, p.hairD, shade(p.hairD, -0.15));
      break;
    case 3: // crespo
      capTop(10, cy - 3, p.hair, p.hairD);
      for (const [x, y] of [[6, cy - 5], [26, cy - 5], [9, cy - 10], [23, cy - 10], [16, cy - 12], [4, cy + 1], [28, cy + 1], [12, cy - 6], [20, cy - 6]]) {
        pc.ellipse(x, y, 4, 3.5, x > 21 ? p.hairD : p.hair);
      }
      pc.px(9, cy - 11, p.hairL);
      pc.px(15, cy - 13, p.hairL);
      break;
    default: {
      // corto / largo / moño: casco con flequillo dentado
      capTop(10, cy - 4, p.hair, p.hairD);
      for (let x = 6; x < 27; x++) {
        const fringe = cy - 4 + ((x * 3) % 4 === 0 ? 2 : (x % 3 === 0 ? 1 : 0));
        for (let y = cy - 5; y <= fringe; y++) pc.px(x, y, x > 22 ? p.hairD : p.hair);
      }
      pc.rect(4, cy - 4, 3, 7, p.hair); // patillas
      pc.rect(25, cy - 4, 3, 6, p.hairD);
      pc.line(9, cy - 9, 14, cy - 11, p.hairL);
      pc.line(10, cy - 8, 13, cy - 9, p.hairL);
      if (style === 1) {
        pc.rect(3, cy - 4, 4, 18, p.hair);
        pc.rect(25, cy - 4, 4, 18, p.hairD);
      }
    }
  }
}

function accessories(pc: PixelCanvas, a: Avatar, f: Frame, cy: number): void {
  const acc = a.acc ?? 0;
  const ey = cy - 1;
  if ((acc === 1 || acc === 3) && !f.back) {
    const frame = '#2a2430';
    for (const ex of [10, 18]) {
      pc.rect(ex, ey - 1, 5, 1, frame);
      pc.rect(ex, ey + 4, 5, 1, frame);
      pc.rect(ex, ey - 1, 1, 6, frame);
      pc.rect(ex + 4, ey - 1, 1, 6, frame);
      pc.px(ex + 3, ey, '#cfefff');
    }
    pc.rect(15, ey, 3, 1, frame);
  }
  if (acc === 2 || acc === 3) {
    const band = '#2d2f38';
    for (let x = 6; x <= 26; x++) {
      const t = (x - 16) / 10;
      pc.px(x, Math.round(cy - 10 - (1 - t * t) * 3), band);
    }
    pc.rect(3, cy - 2, 4, 6, band);
    pc.px(4, cy - 1, '#5ff2ff');
    if (!f.back) {
      pc.line(6, cy + 3, 12, cy + 7, band);
      pc.rect(12, cy + 6, 2, 2, '#5a5f6b');
    } else {
      pc.rect(25, cy - 2, 4, 6, band);
    }
  }
}

// ---------------------------------------------------------------------------
// Vestuario (adornos comprados)
// ---------------------------------------------------------------------------

const GOLD = '#f2c134';
const GOLD_D = '#c9962a';

function hat(pc: PixelCanvas, id: string, f: Frame, cy: number): void {
  const dome = (color: string, dark: string, bottom: number, ry = 9) => {
    for (let y = Math.floor(cy - ry - 3); y <= bottom; y++) {
      for (let x = 3; x < 29; x++) {
        const dx = (x + 0.5 - 16) / 12.5;
        const dy = (y + 0.5 - (cy - 3)) / ry;
        if (dx * dx + dy * dy <= 1) pc.px(x, y, x > 22 ? dark : color);
      }
    }
  };
  switch (id) {
    case 'gorro_lana':
      dome('#d64545', '#a83232', cy - 4);
      pc.rect(4, cy - 6, 24, 3, '#f4f4f8');
      for (let x = 5; x < 27; x += 3) pc.px(x, cy - 5, '#d6d6e0');
      pc.ellipse(16, cy - 14, 3, 3, '#f4f4f8');
      break;
    case 'jockey':
      dome('#3b6fd6', '#2c56aa', cy - 5);
      pc.px(16, cy - 13, '#2c56aa');
      if (!f.back) {
        pc.ellipse(10, cy - 4.5, 8, 2.4, '#2c56aa');
        pc.rect(4, cy - 6, 9, 1, '#5a8af0');
      } else pc.rect(12, cy - 4, 8, 2, '#2c56aa');
      break;
    case 'cintillo_flor':
      for (let x = 5; x <= 27; x++) {
        const t = (x - 16) / 11;
        pc.px(x, Math.round(cy - 6 - (1 - t * t) * 5), '#e86fa8');
      }
      if (!f.back) {
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) pc.ellipse(22 + dx, cy - 9 + dy, 1.8, 1.8, '#ff9ac8');
        pc.ellipse(22, cy - 9, 1.2, 1.2, '#f2c134');
      }
      break;
    case 'boina':
      pc.ellipse(15, cy - 9, 13, 4.5, '#7a1f2b');
      pc.ellipse(13, cy - 10, 8, 2.5, '#9a2b3a');
      pc.rect(15, cy - 15, 2, 2, '#5a1620');
      break;
    case 'casco_obra':
      dome(GOLD, GOLD_D, cy - 4, 8);
      pc.ellipse(16, cy - 4, 14.5, 2.4, GOLD_D);
      pc.rect(15, cy - 13, 2, 9, shade(GOLD, 0.25));
      if (!f.back) pc.ellipse(10, cy - 8, 2, 1.6, '#2a2430');
      break;
    case 'gorro_fiesta':
      pc.poly([[10, cy - 8], [22, cy - 8], [16, cy - 25]], '#e86fa8');
      pc.poly([[12.5, cy - 12], [19.5, cy - 12], [18.5, cy - 15], [13.5, cy - 15]], '#f2c134');
      pc.poly([[14.5, cy - 18], [17.5, cy - 18], [16.8, cy - 21], [15.2, cy - 21]], '#5ff2ff');
      pc.ellipse(16, cy - 25, 2.4, 2.4, '#f2c134');
      break;
    case 'sombrero_vaquero':
      pc.ellipse(16, cy - 8, 15.5, 3.6, '#8a5a3a');
      pc.rect(9, cy - 19, 14, 11, '#a06a42');
      pc.rect(9, cy - 11, 14, 2, '#5a3a22');
      pc.rect(14, cy - 19, 4, 2, '#8a5a3a');
      pc.rect(19, cy - 19, 4, 11, '#8a5a3a');
      break;
    case 'sombrero_copa':
      pc.ellipse(16, cy - 8, 14, 3, '#1b1626');
      pc.rect(9, cy - 25, 14, 17, '#2a2430');
      pc.rect(18, cy - 25, 5, 17, '#1b1626');
      pc.rect(9, cy - 12, 14, 2.5, '#c0392b');
      pc.rect(10, cy - 24, 2, 10, '#3d3648');
      break;
    case 'cuernos_vikingo':
      for (const s of [-1, 1]) {
        const bx = 16 + s * 11;
        pc.poly([[bx, cy - 9], [bx + s * 2, cy - 7], [bx + s * 6, cy - 16], [bx + s * 4, cy - 21]], '#f1e6cc');
        pc.px(bx + s * 4, cy - 20, '#c9bd9e');
      }
      dome('#9aa0b0', '#6b7080', cy - 4, 8);
      pc.rect(4, cy - 6, 24, 2.5, '#c9962a');
      for (let x = 6; x < 27; x += 4) pc.px(x, cy - 5, '#ffe28a');
      break;
    case 'corona':
      pc.rect(8, cy - 13, 16, 5, GOLD);
      pc.rect(19, cy - 13, 5, 5, GOLD_D);
      for (const x of [8, 12, 16, 20, 23]) pc.poly([[x - 1.5, cy - 13], [x + 1.5, cy - 13], [x, cy - 19]], x > 18 ? GOLD_D : GOLD);
      pc.px(12, cy - 11, '#d64545');
      pc.px(16, cy - 11, '#3b6fd6');
      pc.px(20, cy - 11, '#2fa66a');
      break;
    case 'aureola':
      for (let i = 0; i < 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        const x = 16 + Math.cos(t) * 9;
        const y = cy - 18 + Math.sin(t) * 2.6;
        pc.px(Math.round(x), Math.round(y), '#ffe28a');
        pc.px(Math.round(x), Math.round(y) + 1, GOLD);
      }
      break;
    case 'corona_laurel':
      for (let i = 0; i <= 10; i++) {
        const t = Math.PI * (0.05 + 0.9 * (i / 10));
        const x = 16 - Math.cos(t) * 12;
        const y = cy - 5 - Math.sin(t) * 7;
        pc.ellipse(x, y, 2, 1.3, i % 2 ? '#3f9a4a' : '#5fbf6a');
      }
      pc.px(16, cy - 13, GOLD);
      break;
  }
}

function faceItem(pc: PixelCanvas, p: Pal, id: string, f: Frame, cy: number): void {
  if (f.back) {
    if (id === 'barba') pc.rect(5, cy + 2, 3, 5, p.hairD);
    return;
  }
  const ey = cy - 1;
  switch (id) {
    case 'bigote':
      pc.rect(12, ey + 5, 4, 1.5, p.hairD);
      pc.rect(17, ey + 5, 4, 1.5, p.hairD);
      pc.px(11, ey + 6, p.hairD);
      pc.px(21, ey + 6, p.hairD);
      break;
    case 'barba':
      pc.poly([[6, cy + 1], [26, cy + 1], [23, cy + 9], [16, cy + 12], [9, cy + 9]], p.hairD);
      pc.rect(14, ey + 6, 5, 2, p.skinD);
      pc.rect(15, ey + 7, 3, 1, MOUTH);
      pc.rect(12, ey + 5, 9, 1, p.hairD);
      break;
    case 'lentes_sol':
      for (const ex of [10, 18]) {
        pc.rect(ex, ey - 1, 5, 5, '#1b1626');
        pc.px(ex + 1, ey, '#7a7a86');
      }
      pc.rect(15, ey, 3, 1, '#1b1626');
      break;
    case 'pecas':
      for (const [x, y] of [[9, ey + 4], [11, ey + 5], [10, ey + 6], [21, ey + 4], [23, ey + 5], [22, ey + 6]] as [number, number][]) pc.px(x, y, '#b0704a');
      break;
    case 'monoculo':
      for (let i = 0; i < 20; i++) {
        const t = (i / 20) * Math.PI * 2;
        pc.px(Math.round(20 + Math.cos(t) * 3), Math.round(ey + 1.5 + Math.sin(t) * 3), GOLD);
      }
      pc.line(23, ey + 3, 24, cy + 10, GOLD_D);
      break;
    case 'lentes_pixel':
      pc.rect(8, ey - 1, 17, 2, '#111');
      pc.rect(9, ey + 1, 6, 3, '#111');
      pc.rect(17, ey + 1, 6, 3, '#111');
      pc.px(10, ey + 1, '#ffffff');
      pc.px(18, ey + 1, '#ffffff');
      break;
  }
}

function neckItem(pc: PixelCanvas, id: string, f: Frame, y0: number): void {
  switch (id) {
    case 'humita':
      if (f.back) return;
      pc.poly([[12, y0 + 1], [16, y0 + 3], [12, y0 + 5]], '#d64545');
      pc.poly([[20, y0 + 1], [16, y0 + 3], [20, y0 + 5]], '#a83232');
      pc.rect(15, y0 + 2, 2, 2, '#ff6f6f');
      break;
    case 'bufanda':
      for (let x = 9; x < 23; x++) pc.rect(x, y0 - 1, 1, 4, x % 4 < 2 ? '#d64545' : '#f4f4f8');
      if (!f.back) for (let y = y0 + 3; y < y0 + 12; y++) pc.rect(18, y, 3, 1, y % 4 < 2 ? '#d64545' : '#f4f4f8');
      break;
    case 'collar_perlas':
      if (f.back) return;
      for (let i = 0; i <= 8; i++) {
        const x = 11.5 + i * 1.15;
        const y = y0 + 1 + Math.sin((i / 8) * Math.PI) * 3;
        pc.px(Math.round(x), Math.round(y), '#fbf7ee');
      }
      break;
    case 'medalla':
    case 'medalla_puntual': {
      if (f.back) return;
      const ribbon = id === 'medalla' ? '#3b6fd6' : '#d64545';
      pc.line(11, y0, 16, y0 + 7, ribbon);
      pc.line(21, y0, 16, y0 + 7, ribbon);
      pc.ellipse(16, y0 + 9, 2.6, 2.6, id === 'medalla' ? GOLD : '#d8dbe4');
      pc.px(15, y0 + 8, '#ffffff');
      break;
    }
  }
}

// ---------------------------------------------------------------------------

export function paintCharacter(a: Avatar, pose: Pose): PixelCanvas {
  const f = frameOf(pose);
  const p = palette(a);
  const body = new PixelCanvas(CHAR_W, BODY_H);
  // Rebote: a mitad de paso y al respirar el cuerpo baja 1 px.
  const bob = (f.walk === 1 || f.walk === 3 ? -1 : 0) + (f.breathe ? 1 : 0);
  const headCy = 18 + bob;
  const torsoY = 29 + bob;

  hairBack(body, p, a.hairStyle, f, headCy);
  if (!f.sit) legs(body, p, f, 45);
  else body.rect(9, 44 + bob, 14, 4, p.pantsD);
  if (f.back) arms(body, p, f, torsoY);
  if (f.gesture === 'stretch') arms(body, p, f, torsoY);
  torso(body, p, a, f, torsoY);
  if (!f.back && f.gesture !== 'stretch') arms(body, p, f, torsoY);
  headBase(body, p, headCy);
  if (!f.back) face(body, p, a, f, headCy);
  hairFront(body, p, a.hairStyle, f, headCy);
  accessories(body, a, f, headCy);
  gestureArm(body, p, f, torsoY, headCy);

  // Lienzo final con margen arriba para los sombreros.
  const pc = new PixelCanvas(CHAR_W, CHAR_H);
  pc.data.set(body.data, CHAR_W * HAT_PAD * 4);
  const cy = headCy + HAT_PAD;
  if (a.neck) neckItem(pc, a.neck, f, torsoY + HAT_PAD);
  if (a.face) faceItem(pc, p, a.face, f, cy);
  if (a.hat) hat(pc, a.hat, f, cy);
  pc.outline(OUTLINE);
  return pc;
}

export function avatarKey(a: Avatar): string {
  return `av_${a.body ?? 0}_${a.skin}_${a.hair}_${a.hairStyle}_${a.shirt}_${a.pants}_${a.acc ?? 0}_${a.hat ?? ''}_${a.face ?? ''}_${a.neck ?? ''}`;
}

/** Recorte de la cabeza (para los globos de diálogo y la UI), con su sombrero. */
export const HEAD_H = 32 + HAT_PAD;

export function paintHead(a: Avatar): PixelCanvas {
  const full = paintCharacter(a, 'front0');
  const head = new PixelCanvas(CHAR_W, HEAD_H);
  head.data.set(full.data.subarray(0, CHAR_W * HEAD_H * 4));
  return head;
}
