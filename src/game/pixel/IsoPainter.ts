import { UNIT } from '../iso';
import { PixelCanvas, shade } from './PixelCanvas';

/**
 * Las texturas se pintan a ART_SCALE× y se muestran a 1/ART_SCALE: el mundo
 * mide lo mismo, pero cada baldosa tiene 4 veces más píxeles de detalle.
 */
export const ART_SCALE = 2;

export interface FaceColors {
  top: string;
  /** Cara que mira a +v (abajo-izquierda en pantalla). */
  left: string;
  /** Cara que mira a +u (abajo-derecha en pantalla). */
  right: string;
}

/** Sombreado estándar: luz cálida desde arriba a la izquierda. */
export function faces(base: string): FaceColors {
  return { top: shade(base, 0.16), left: base, right: shade(base, -0.24) };
}

/**
 * Pinta volúmenes isométricos sobre un PixelCanvas del tamaño exacto de la
 * huella del objeto (w × d baldosas) más `height` unidades hacia arriba.
 * Medidas en unidades (16 = una baldosa) y z en px de mundo; se aceptan
 * medias unidades para el detalle fino.
 *
 * El origen (u=0, v=0, z=0) es la esquina superior de la huella.
 */
export class IsoPainter {
  readonly pc: PixelCanvas;
  readonly ox: number;
  readonly oy: number;
  readonly s = ART_SCALE;

  constructor(
    readonly w: number,
    readonly d: number,
    readonly height: number,
  ) {
    this.pc = new PixelCanvas((w + d) * UNIT * this.s, ((w + d) * (UNIT / 2) + height) * this.s);
    this.ox = d * UNIT * this.s;
    this.oy = height * this.s;
  }

  pt(u: number, v: number, z: number): [number, number] {
    return [this.ox + (u - v) * this.s, this.oy + ((u + v) / 2 - z) * this.s];
  }

  /**
   * Caja sólida: dibuja las tres caras visibles y un bisel claro en las
   * aristas frontales de la tapa, que es lo que hace "leer" el volumen.
   */
  box(u: number, v: number, z: number, su: number, sv: number, sz: number, colors: FaceColors | string, bevel = true): void {
    const c = typeof colors === 'string' ? faces(colors) : colors;
    const z1 = z + sz;
    if (sz > 0) {
      this.pc.poly([this.pt(u, v + sv, z), this.pt(u + su, v + sv, z), this.pt(u + su, v + sv, z1), this.pt(u, v + sv, z1)], c.left);
      this.pc.poly([this.pt(u + su, v, z), this.pt(u + su, v + sv, z), this.pt(u + su, v + sv, z1), this.pt(u + su, v, z1)], c.right);
    }
    this.top(u, v, su, sv, z1, c.top);
    if (bevel && su >= 2 && sv >= 2) {
      const hi = shade(c.top, 0.28);
      const a = this.pt(u, v + sv, z1);
      const b = this.pt(u + su, v + sv, z1);
      const e = this.pt(u + su, v, z1);
      this.pc.line(a[0], a[1] - 1, b[0], b[1] - 1, hi);
      this.pc.line(b[0], b[1] - 1, e[0] - 1, e[1], shade(c.top, 0.12));
      if (sz >= 3) {
        const f = this.pt(u + su, v + sv, z);
        this.pc.line(b[0], b[1], f[0], f[1] - 1, shade(c.left, 0.1));
      }
    }
  }

  top(u: number, v: number, su: number, sv: number, z: number, color: string): void {
    this.pc.poly([this.pt(u, v, z), this.pt(u + su, v, z), this.pt(u + su, v + sv, z), this.pt(u, v + sv, z)], color);
  }

  /** Paralelogramo sobre el plano v = const (detalles en caras izquierdas). */
  faceV(u: number, v: number, z: number, su: number, sz: number, color: string): void {
    this.pc.poly([this.pt(u, v, z), this.pt(u + su, v, z), this.pt(u + su, v, z + sz), this.pt(u, v, z + sz)], color);
  }

  /** Paralelogramo sobre el plano u = const (detalles en caras derechas). */
  faceU(u: number, v: number, z: number, sv: number, sz: number, color: string): void {
    this.pc.poly([this.pt(u, v, z), this.pt(u, v + sv, z), this.pt(u, v + sv, z + sz), this.pt(u, v, z + sz)], color);
  }

  /** Línea entre dos puntos 3D. */
  line3(a: [number, number, number], b: [number, number, number], color: string): void {
    const p = this.pt(...a);
    const q = this.pt(...b);
    this.pc.line(p[0], p[1], q[0], q[1], color);
  }

  dot(u: number, v: number, z: number, color: string, size = 1): void {
    const [x, y] = this.pt(u, v, z);
    this.pc.rect(Math.floor(x), Math.floor(y), size, size, color);
  }

  /** Mancha redonda en pantalla (radios en px de mundo) centrada en un punto 3D. */
  blob(u: number, v: number, z: number, rx: number, ry: number, color: string): void {
    const [x, y] = this.pt(u, v, z);
    this.pc.ellipse(x, y, rx * this.s, ry * this.s, color);
  }

  /** Disco horizontal (mesas redondas, macetas) con canto de `thick` px. */
  disc(u: number, v: number, z: number, r: number, thick: number, color: string): void {
    const [x, y] = this.pt(u, v, z);
    const rx = r * this.s;
    for (let k = thick * this.s; k > 0; k--) this.pc.ellipse(x, y + k, rx, rx / 2, shade(color, -0.28));
    this.pc.ellipse(x, y, rx, rx / 2, shade(color, 0.1));
    this.pc.ellipse(x - rx * 0.25, y - rx * 0.1, rx * 0.45, rx * 0.18, shade(color, 0.22));
  }

  /** Hoja: elipse con nervio, rotada hacia (du, dv). */
  leaf(u: number, v: number, z: number, len: number, angle: number, color: string): void {
    const [x, y] = this.pt(u, v, z);
    const s = this.s;
    const steps = Math.ceil(len * s);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const w = Math.sin(t * Math.PI) * len * 0.32 * s;
      const cx = x + Math.cos(angle) * t * len * s;
      const cy = y + Math.sin(angle) * t * len * s;
      this.pc.ellipse(cx, cy, Math.max(0.6, w), Math.max(0.6, w * 0.7), color);
    }
    this.pc.line(x, y, x + Math.cos(angle) * len * s * 0.8, y + Math.sin(angle) * len * s * 0.8, shade(color, -0.22));
  }
}
