import { OUTLINE, PixelCanvas } from './PixelCanvas';

/**
 * Mascotas de la oficina, pintadas por código a 2× y mirando a la derecha
 * (la izquierda es el espejo): Bruno, un golden retriever, y Mandarina, una
 * gata naranja atigrada.
 */
export type PetKind = 'dog' | 'cat';
export type PetFrame = 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'stand0' | 'stand1' | 'sit' | 'lie0' | 'lie1';
export const PET_FRAMES: PetFrame[] = ['walk0', 'walk1', 'walk2', 'walk3', 'stand0', 'stand1', 'sit', 'lie0', 'lie1'];

export function petKey(kind: PetKind, frame: PetFrame): string {
  return `pet_${kind}_${frame}`;
}

const EYE = '#2a1d17';

// ---------------------------------------------------------------------------
// Bruno (golden retriever) · 34×26
// ---------------------------------------------------------------------------

const DOG = { base: '#d99a3f', light: '#f2c27a', dark: '#a8702a', nose: '#2a1d17', tongue: '#e86a7a', collar: '#3f7fd6' };

/** Trazo de 3 px (colas peludas): el contorno no se lo come. */
function thickLine(pc: PixelCanvas, x0: number, y0: number, x1: number, y1: number, color: string): void {
  for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [1, 1], [0, 2]]) pc.line(x0 + dx, y0 + dy, x1 + dx, y1 + dy, color);
}

function paintDog(frame: PetFrame): PixelCanvas {
  const pc = new PixelCanvas(34, 26);
  const c = DOG;
  if (frame === 'lie0' || frame === 'lie1') {
    const breathe = frame === 'lie1' ? 0.5 : 0;
    thickLine(pc, 6, 21, 1, 23, c.base);
    pc.ellipse(15, 20 - breathe, 10, 4.2 + breathe, c.base);
    pc.ellipse(15, 22, 8, 1.6, c.light);
    pc.rect(9, 16 - breathe, 10, 1, c.light);
    pc.rect(22, 22, 8, 2.5, c.light);
    pc.ellipse(26, 18, 4.5, 3.6, c.base);
    pc.ellipse(30, 20, 2.5, 1.8, c.light);
    pc.rect(32, 19, 2, 2, c.nose);
    pc.rect(26, 17, 2, 1, EYE);
    pc.ellipse(24, 19, 2, 3, c.dark);
    pc.outline(OUTLINE);
    return pc;
  }
  if (frame === 'sit') {
    thickLine(pc, 8, 23, 3, 22, c.base);
    pc.ellipse(13, 19, 5, 4.5, c.base);
    pc.rect(9, 22, 7, 3, c.base);
    pc.ellipse(18, 15, 5, 6, c.base);
    pc.ellipse(21, 15, 3, 4.5, c.light);
    pc.rect(18, 17, 3, 8, c.dark);
    pc.rect(21, 17, 3, 8, c.base);
    pc.rect(21, 24, 3, 1, c.light);
    pc.rect(19, 9, 5, 2, c.collar);
    pc.ellipse(23, 6, 4.5, 4, c.base);
    pc.ellipse(27, 8, 2.6, 2, c.light);
    pc.rect(29, 7, 2, 2, c.nose);
    pc.px(24, 5, EYE);
    pc.rect(27, 10, 2, 2, c.tongue);
    pc.ellipse(21, 7, 2, 3.2, c.dark);
    pc.outline(OUTLINE);
    return pc;
  }
  const walk = frame.startsWith('walk') ? Number(frame.slice(-1)) : -1;
  const bob = walk === 1 || walk === 3 ? -1 : 0;
  // Cola: arriba moviéndose de lado a lado.
  if (frame === 'stand1' || walk === 1 || walk === 3) thickLine(pc, 8, 12 + bob, 2, 9 + bob, c.base);
  else thickLine(pc, 8, 12 + bob, 3, 6 + bob, c.base);
  // Patas: las lejanas más oscuras; al caminar se adelantan y atrasan.
  const step = walk === 0 ? 1 : walk === 2 ? -1 : 0;
  const leg = (x: number, color: string) => pc.rect(x, 16, 3, 9, color);
  leg(9 + step, c.dark);
  leg(21 + step, c.dark);
  leg(12 - step, c.base);
  leg(24 - step, c.base);
  pc.ellipse(16, 14 + bob, 9, 4.5, c.base);
  pc.ellipse(16, 16.5 + bob, 7, 2, c.light);
  pc.rect(10, 10 + bob, 10, 1, c.light);
  pc.ellipse(23, 13 + bob, 3.5, 4, c.light);
  pc.rect(22, 11 + bob, 3, 2, c.collar);
  pc.ellipse(26, 8 + bob, 4.5, 4, c.base);
  pc.ellipse(30, 10 + bob, 2.6, 2, c.light);
  pc.rect(32, 9 + bob, 2, 2, c.nose);
  pc.px(27, 7 + bob, EYE);
  if (frame === 'stand1' || walk >= 0) pc.rect(30, 12 + bob, 2, 2, c.tongue);
  pc.ellipse(24, 9 + bob, 2, 3.2, c.dark);
  pc.outline(OUTLINE);
  return pc;
}

// ---------------------------------------------------------------------------
// Mandarina (gata naranja atigrada) · 28×22
// ---------------------------------------------------------------------------

const CAT = { base: '#ee8a2e', light: '#f8b870', stripe: '#c0601a', nose: '#f08a9a', white: '#fff2e0' };

function catHead(pc: PixelCanvas, x: number, y: number, sleeping: boolean): void {
  const c = CAT;
  pc.poly([[x - 3, y - 2], [x - 2, y - 6], [x, y - 3]], c.base);
  pc.poly([[x, y - 3], [x + 2, y - 6], [x + 3, y - 2]], c.base);
  pc.px(x - 2, y - 4, c.nose);
  pc.px(x + 2, y - 4, c.nose);
  pc.ellipse(x, y, 3.6, 3.3, c.base);
  pc.rect(x - 1, y - 3, 2, 1, c.stripe);
  pc.rect(x, y + 1, 2, 2, c.white);
  if (sleeping) {
    pc.rect(x - 2, y, 2, 1, EYE);
    pc.rect(x + 1, y, 2, 1, EYE);
  } else {
    pc.px(x - 1, y, EYE);
    pc.px(x + 2, y, EYE);
  }
  pc.px(x + 1, y + 1, c.nose);
}

function paintCat(frame: PetFrame): PixelCanvas {
  const pc = new PixelCanvas(28, 22);
  const c = CAT;
  if (frame === 'lie0' || frame === 'lie1') {
    // Hecha pan, durmiendo.
    const breathe = frame === 'lie1' ? 0.4 : 0;
    thickLine(pc, 5, 18, 12, 19, c.base);
    pc.ellipse(13, 17 - breathe, 7.5, 4 + breathe, c.base);
    for (const x of [9, 12, 15]) pc.rect(x, 14 - breathe, 1, 3, c.stripe);
    catHead(pc, 19, 15, true);
    pc.outline(OUTLINE);
    return pc;
  }
  if (frame === 'sit') {
    thickLine(pc, 8, 18, 17, 18, c.base);
    pc.ellipse(13, 14, 5, 6, c.base);
    pc.ellipse(15, 15, 2, 3.5, c.white);
    for (const y of [12, 15]) pc.rect(10, y, 2, 1, c.stripe);
    pc.rect(14, 17, 2, 4, c.base);
    pc.rect(16, 17, 2, 4, c.light);
    catHead(pc, 16, 8, false);
    pc.outline(OUTLINE);
    return pc;
  }
  const walk = frame.startsWith('walk') ? Number(frame.slice(-1)) : -1;
  const bob = walk === 1 || walk === 3 ? -1 : 0;
  // Cola en alto, con la punta que se mueve.
  thickLine(pc, 6, 11 + bob, 3, 5 + bob, c.base);
  thickLine(pc, 3, 5 + bob, frame === 'stand1' ? 5 : 4, 1 + bob, c.stripe);
  const step = walk === 0 ? 1 : walk === 2 ? -1 : 0;
  pc.rect(8 + step, 15, 2, 6, c.stripe);
  pc.rect(17 + step, 15, 2, 6, c.stripe);
  pc.rect(10 - step, 15, 2, 6, c.base);
  pc.rect(19 - step, 15, 2, 6, c.base);
  pc.ellipse(13, 13 + bob, 7, 3.6, c.base);
  for (const x of [10, 13, 16]) pc.rect(x, 10 + bob, 1, 3, c.stripe);
  catHead(pc, 21, 9 + bob, false);
  pc.outline(OUTLINE);
  return pc;
}

export function paintPet(kind: PetKind, frame: PetFrame): PixelCanvas {
  return kind === 'dog' ? paintDog(frame) : paintCat(frame);
}
