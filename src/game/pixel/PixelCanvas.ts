/**
 * Lienzo de píxeles en memoria (RGBA) que se vuelca a un <canvas> al final.
 * Todo el arte del juego se genera aquí: nunca se escala ni se suaviza, cada
 * píxel lo pone el código (misma idea que `grid.txt` en sprite-gen pixel-draw:
 * la fuente de verdad son datos, el PNG se deriva).
 */

export type RGBA = [number, number, number, number];

const cache = new Map<string, RGBA>();

export function parseColor(hex: string): RGBA {
  const hit = cache.get(hex);
  if (hit) return hit;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const rgba: RGBA = [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255,
  ];
  cache.set(hex, rgba);
  return rgba;
}

function toHex([r, g, b]: RGBA): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

/** f < 0 oscurece, f > 0 aclara (fracción hacia negro / blanco). */
export function shade(hex: string, f: number): string {
  const c = parseColor(hex);
  const t = f < 0 ? 0 : 255;
  const k = Math.abs(f);
  return toHex([c[0] + (t - c[0]) * k, c[1] + (t - c[1]) * k, c[2] + (t - c[2]) * k, 255]);
}

export const OUTLINE = '#1f1b2d';

export class PixelCanvas {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  px(x: number, y: number, color: string): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b, a] = parseColor(color);
    const i = (y * this.width + x) * 4;
    if (a === 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
      return;
    }
    // Mezcla simple para vidrio / brillos.
    const k = a / 255;
    const da = this.data[i + 3] / 255;
    const oa = k + da * (1 - k);
    if (oa === 0) return;
    this.data[i] = (r * k + this.data[i] * da * (1 - k)) / oa;
    this.data[i + 1] = (g * k + this.data[i + 1] * da * (1 - k)) / oa;
    this.data[i + 2] = (b * k + this.data[i + 2] * da * (1 - k)) / oa;
    this.data[i + 3] = oa * 255;
  }

  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.data[(y * this.width + x) * 4 + 3];
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, color);
  }

  /** Rellena los píxeles cuyo centro cae dentro del polígono convexo (bordes incluidos). */
  poly(points: [number, number][], color: string): void {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs));
    const x1 = Math.ceil(Math.max(...xs));
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    const n = points.length;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        let pos = false;
        let neg = false;
        for (let k = 0; k < n; k++) {
          const [ax, ay] = points[k];
          const [bx, by] = points[(k + 1) % n];
          const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          if (cross > 1e-6) pos = true;
          else if (cross < -1e-6) neg = true;
        }
        if (!(pos && neg)) this.px(x, y, color);
      }
    }
  }

  /** Línea de 1 px (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, color: string): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, color);
      }
    }
  }

  /**
   * Contorno interior de 1 px: todo píxel opaco que toca un transparente
   * (4-vecindad) pasa a `color`. No agranda el sprite.
   */
  outline(color = OUTLINE): void {
    const edge: number[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.alpha(x, y) < 128) continue;
        if (this.alpha(x - 1, y) < 128 || this.alpha(x + 1, y) < 128 || this.alpha(x, y - 1) < 128 || this.alpha(x, y + 1) < 128) {
          edge.push(x, y);
        }
      }
    }
    for (let k = 0; k < edge.length; k += 2) this.px(edge[k], edge[k + 1], color);
  }

  /** Espejo horizontal (para la rotación de objetos). */
  mirrored(): PixelCanvas {
    const out = new PixelCanvas(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const s = (y * this.width + x) * 4;
        const d = (y * this.width + (this.width - 1 - x)) * 4;
        for (let c = 0; c < 4; c++) out.data[d + c] = this.data[s + c];
      }
    }
    return out;
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.width;
    c.height = this.height;
    const ctx = c.getContext('2d');
    if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(this.data), this.width, this.height), 0, 0);
    return c;
  }
}

/**
 * Sprite desde grilla de caracteres, como el `grid.txt` de pixel-draw:
 * una fila de texto por fila de píxeles, una clave de paleta por píxel.
 * '.' es transparente. Una clave sin color en la paleta es un error de datos.
 */
export function fromGrid(rows: string[], palette: Record<string, string>, name = 'grid'): PixelCanvas {
  const width = rows[0].length;
  const pc = new PixelCanvas(width, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${name}: la fila ${y} mide ${row.length}, se esperaban ${width}`);
    for (let x = 0; x < width; x++) {
      const k = row[x];
      if (k === '.') continue;
      const color = palette[k];
      if (color === undefined) throw new Error(`${name}: clave '${k}' sin color (fila ${y})`);
      pc.px(x, y, color);
    }
  });
  return pc;
}
