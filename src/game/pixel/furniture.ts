import { ITEM_BY_ID } from '../../data/catalog';
import { IsoPainter, faces } from './IsoPainter';
import { PixelCanvas, shade } from './PixelCanvas';

/**
 * Arte de cada objeto. Medidas en unidades (16 = una baldosa), z en px de
 * mundo; se pinta a 2× (ver ART_SCALE). Orden: de atrás hacia adelante.
 *
 * Convención de puestos: el escritorio queda delante (+v) de la silla y la
 * persona mira hacia la cámara, como en una oficina vista desde el pasillo.
 */
type Drawer = { h: number; draw: (p: IsoPainter) => void };

const DESK_TOP = '#e4d6c0';
const DESK_PANEL = '#c9bba5';
const WALNUT = '#6b4430';
const METAL = '#3c3f4a';
const DARK = '#22242c';
const LEATHER = '#2d2f38';
const SCREEN = '#7fe6ff';
const LEAF = '#3f9a4a';
const LEAF_DARK = '#2c7438';
const LEAF_LIGHT = '#74c95c';
const POT_DARK = '#33353f';
const POT_TERRACOTA = '#c4693d';
const PAPER = '#f4f2ec';

function monitorBack(p: IsoPainter, u: number, v: number, z: number, wide: number): void {
  p.box(u + wide / 2 - 1, v + 0.5, z, 2, 2, 1, METAL);
  p.box(u + wide / 2 - 0.5, v + 1, z + 1, 1, 1, 3, METAL);
  p.box(u, v, z + 3, wide, 1.5, 9, { top: '#3a3d48', left: '#2a2c35', right: '#1e2027' });
  // Borde de la pantalla encendida asomando por arriba.
  p.faceV(u + 0.5, v, z + 11.5, wide - 1, 0.5, SCREEN);
  p.dot(u + wide - 2, v + 1.5, z + 4, '#5fd46a');
}

function deskBase(p: IsoPainter, top: string, panel: string, legs: string): void {
  // Patas/paneles laterales y panel frontal (pudor) que mira a la cámara.
  p.box(1, 2, 0, 2, 12, 11, legs);
  p.box(29, 2, 0, 2, 12, 11, legs);
  p.box(3, 12, 2, 26, 1.5, 8, panel);
  p.box(0.5, 1, 11, 31, 14, 1.5, top);
}

function paperStack(p: IsoPainter, u: number, v: number, z: number): void {
  p.box(u, v, z, 5, 4, 1, PAPER);
  p.box(u + 0.5, v + 0.3, z + 1, 5, 4, 0.5, '#e8e4da');
  p.line3([u + 1, v + 3, z + 1.6], [u + 4, v + 3, z + 1.6], '#9aa0ad');
}

function mug(p: IsoPainter, u: number, v: number, z: number, color = '#f2f2f6'): void {
  p.box(u, v, z, 2.5, 2.5, 3, color);
  p.top(u + 0.5, v + 0.5, 1.5, 1.5, z + 3, '#5a3a22');
}

function pot(p: IsoPainter, u: number, v: number, size: number, h: number, color: string): void {
  p.box(u, v, 0, size, size, h, color);
  p.box(u - 0.5, v - 0.5, h - 1.5, size + 1, size + 1, 1.5, shade(color, 0.1));
  p.top(u + 0.5, v + 0.5, size - 1, size - 1, h, '#4a3122');
}

/** Hojas largas en abanico desde (u, v, z): monstera, palmeras. */
function fan(p: IsoPainter, u: number, v: number, z: number, n: number, len: number, spread = 1): void {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1 || 1);
    const angle = -Math.PI * (0.08 + 0.84 * t) * spread - (1 - spread) * Math.PI * 0.5;
    const col = i % 3 === 0 ? LEAF_DARK : i % 3 === 1 ? LEAF : LEAF_LIGHT;
    p.leaf(u, v, z, len * (0.75 + 0.25 * Math.sin(i * 1.7)), angle, col);
  }
}

function bush(p: IsoPainter, u: number, v: number, z: number, r: number): void {
  p.blob(u, v, z, r + 0.5, r * 0.8, LEAF_DARK);
  p.blob(u - r * 0.4, v + 1, z + r * 0.4, r * 0.7, r * 0.55, LEAF);
  p.blob(u + r * 0.4, v - 1, z + r * 0.5, r * 0.7, r * 0.55, LEAF);
  p.blob(u - 1, v, z + r * 0.9, r * 0.5, r * 0.4, LEAF_LIGHT);
}

function chairBase(p: IsoPainter, seat: string): void {
  // Base de cinco ruedas, pistón y asiento.
  p.box(3.5, 7, 0, 9, 2, 1, DARK, false);
  p.box(7, 3.5, 0, 2, 9, 1, DARK, false);
  p.box(7.25, 7.25, 1, 1.5, 1.5, 5, '#9aa0ad');
  p.box(3, 3, 6, 10, 10, 2.5, seat);
}

const DRAWERS: Record<string, Drawer> = {
  escritorio: {
    h: 28,
    draw: (p) => {
      deskBase(p, DESK_TOP, DESK_PANEL, '#8f8576');
      monitorBack(p, 9, 3, 12.5, 14);
      p.box(9, 8, 12.5, 11, 3, 0.8, '#d8d8e2'); // teclado
      p.box(22, 8.5, 12.5, 2, 3, 0.8, '#d8d8e2');
      paperStack(p, 2.5, 7, 12.5);
      mug(p, 26, 4, 12.5);
      p.box(24, 9.5, 12.5, 4, 3, 1, '#2d2f38'); // teléfono
      p.dot(25.5, 10.5, 13.6, '#5fd46a');
    },
  },
  escritorio_pro: {
    h: 30,
    draw: (p) => {
      deskBase(p, '#7a4e34', '#5c3a27', '#3a2a22');
      p.faceV(3, 13.5, 3, 26, 0.8, '#b07ce8'); // tira RGB
      monitorBack(p, 2.5, 3, 13, 12);
      monitorBack(p, 16.5, 3, 13, 12);
      p.box(9, 8.5, 13, 12, 3, 0.8, '#1e2027');
      p.faceV(9.5, 11.5, 13, 11, 0.6, '#b07ce8');
      p.box(23, 9, 13, 3, 3, 0.8, '#1e2027');
      p.box(26, 3.5, 13, 4, 4, 3, POT_DARK);
      p.blob(28, 5.5, 19, 3, 2.2, LEAF);
      p.blob(27.5, 5, 20.5, 1.8, 1.4, LEAF_LIGHT);
      mug(p, 3, 8, 13, '#2d2f38');
    },
  },
  silla: {
    h: 26,
    draw: (p) => {
      p.box(3, 2, 8.5, 10, 2, 13, LEATHER); // respaldo (atrás)
      p.faceV(4, 4, 11, 8, 9, '#3a3c47');
      chairBase(p, LEATHER);
      p.box(2.5, 5, 9, 1.5, 6, 4, '#3a3c47');
      p.box(12, 5, 9, 1.5, 6, 4, '#3a3c47');
    },
  },
  silla_ergo: {
    h: 32,
    draw: (p) => {
      p.box(3, 1.5, 9, 10, 2, 17, '#1f2027');
      p.faceV(4, 3.5, 11, 8, 13, '#2c2e38');
      for (let z = 12; z < 24; z += 2) p.line3([4.5, 3.5, z], [11.5, 3.5, z], '#3c3f4a');
      p.box(5, 1.5, 26, 6, 2, 4, '#d64545');
      chairBase(p, '#1f2027');
      p.box(2, 4.5, 9, 1.5, 7, 5, '#d64545');
      p.box(12.5, 4.5, 9, 1.5, 7, 5, '#d64545');
    },
  },
  archivador: {
    h: 24,
    draw: (p) => {
      p.box(3, 3, 0, 10, 10, 21, '#a3abb9');
      for (const z of [1.5, 8, 14.5]) {
        p.faceV(4, 13, z, 8, 5.5, '#bcc3cf');
        p.faceV(6.5, 13, z + 3.5, 3, 1, '#5a5f6b');
        p.faceV(5, 13, z + 1, 2.5, 1.5, PAPER);
      }
      p.box(5, 5, 21, 4, 3, 2, PAPER);
    },
  },
  puf: {
    h: 12,
    draw: (p) => {
      p.disc(8, 8, 7, 6, 6, '#e0644c');
      p.blob(8, 8, 7.5, 2, 1, '#f39a82');
    },
  },
  estanteria: {
    h: 38,
    draw: (p) => {
      p.box(2, 3, 0, 12, 9, 34, '#5b3c2b');
      p.faceV(2.8, 12, 1, 10.4, 32, '#2a1d17');
      const binders = ['#d64545', '#3b6fd6', '#f2b134', '#2fa66a', '#8e5bd6', '#e8e4da', '#d9824a'];
      for (let shelf = 0; shelf < 4; shelf++) {
        const z = 2 + shelf * 8;
        p.faceV(2.8, 12, z - 1, 10.4, 1, '#7a5238');
        let u = 3.3;
        let k = shelf * 3;
        while (u < 12.2) {
          const w = 1.5 + ((k * 7) % 3) * 0.5;
          const h = 5 + ((k * 5) % 3);
          if ((k + shelf) % 6 !== 5) {
            p.faceV(u, 12, z, w, h, binders[k % binders.length]);
            p.faceV(u + 0.3, 12, z + h - 2.5, w - 0.6, 1, shade(binders[k % binders.length], 0.35));
          }
          u += w + 0.3;
          k++;
        }
      }
      p.box(5, 5, 34, 4, 4, 3, POT_DARK);
      p.blob(7, 7, 39, 3, 2, LEAF);
    },
  },
  sofa: {
    h: 20,
    draw: (p) => {
      const c = '#2f313b';
      p.box(1, 2, 7, 30, 3.5, 10, shade(c, 0.05));
      p.box(1, 4, 0, 30, 10, 7, shade(c, -0.1));
      p.box(4, 5, 7, 12, 8.5, 2.5, c);
      p.box(16, 5, 7, 12, 8.5, 2.5, c);
      p.box(1, 3, 7, 3, 11, 6, shade(c, 0.08));
      p.box(28, 3, 7, 3, 11, 6, shade(c, 0.08));
      p.box(6, 5, 9.5, 5, 2, 5, '#d9824a');
      p.box(21, 5, 9.5, 5, 2, 5, '#c9a24a');
    },
  },
  sillon: {
    h: 20,
    draw: (p) => {
      const c = '#2f313b';
      p.box(2, 2, 7, 12, 3.5, 11, shade(c, 0.05));
      p.box(2, 4, 0, 12, 10, 7, shade(c, -0.1));
      p.box(4, 5, 7, 8, 8.5, 2.5, c);
      p.box(1.5, 3, 7, 2.5, 11, 6, shade(c, 0.08));
      p.box(12, 3, 7, 2.5, 11, 6, shade(c, 0.08));
    },
  },
  cactus: {
    h: 24,
    draw: (p) => {
      pot(p, 5, 5, 6, 5, POT_TERRACOTA);
      const g = { top: '#6cc35a', left: '#4fa85a', right: '#3a8a46' };
      p.box(7, 7, 5, 2.5, 2.5, 13, g);
      p.box(4.5, 7.5, 9, 2.5, 2, 2, g);
      p.box(4.5, 7.5, 9, 2, 2, 6, g);
      p.box(9.5, 7, 11, 2.5, 2, 5, g);
      p.dot(8, 7.5, 18.5, '#f07fb0', 2);
      for (const z of [8, 11, 14]) p.dot(7.5, 9.5, z, '#e8f5c8');
    },
  },
  planta: {
    h: 24,
    draw: (p) => {
      pot(p, 5, 5, 6, 7, '#e6e1d6');
      fan(p, 8, 8, 8, 7, 7);
      bush(p, 8, 8, 12, 4);
    },
  },
  monstera: {
    h: 34,
    draw: (p) => {
      pot(p, 4, 4, 8, 9, POT_DARK);
      p.box(7.5, 7.5, 9, 1, 1, 8, '#2f6b35');
      fan(p, 8, 8, 14, 9, 11, 1.1);
      fan(p, 8, 8, 20, 6, 8, 0.8);
    },
  },
  bonsai: {
    h: 22,
    draw: (p) => {
      p.box(3, 4, 0, 10, 8, 3.5, '#3a2a22');
      p.top(4, 5, 8, 6, 3.5, '#6b5a3e');
      p.box(7, 7, 3.5, 2, 2, 6, '#6b4a2e');
      p.box(5, 7, 8, 4, 1.5, 1.5, '#6b4a2e');
      p.blob(5, 8, 12, 4.5, 2.2, LEAF_DARK);
      p.blob(10.5, 7, 13, 4, 2, LEAF);
      p.blob(8, 7, 15.5, 3, 1.6, LEAF_LIGHT);
    },
  },
  arbol: {
    h: 48,
    draw: (p) => {
      pot(p, 3, 3, 10, 10, '#e6e1d6');
      p.box(7, 7, 10, 2, 2, 16, '#6b4a2e');
      fan(p, 8, 8, 26, 11, 13, 1.2);
      fan(p, 8, 8, 32, 8, 10);
      bush(p, 8, 8, 32, 6);
    },
  },
  jardinera: {
    h: 30,
    draw: (p) => {
      p.box(1, 3, 0, 46, 10, 10, '#2a2c35');
      p.faceV(1, 13, 0.5, 46, 1, '#ffcf7a'); // LED cálido
      p.top(2, 4, 44, 8, 10, '#3a2a1e');
      for (const u of [7, 18, 29, 40]) {
        fan(p, u, 8, 11, 8, 10, 1.15);
        bush(p, u + 1, 8, 15, 3.5);
      }
    },
  },
  dispensador: {
    h: 30,
    draw: (p) => {
      p.box(4, 4, 0, 8, 8, 15, '#e9eaf0');
      p.faceV(5, 12, 9, 6, 4, '#c9cbd6');
      p.dot(6.5, 12, 11, '#3b6fd6', 2);
      p.dot(9.5, 12, 11, '#d64545', 2);
      p.faceV(5.5, 12, 3, 5, 1, '#9aa0ad');
      p.box(4.5, 4.5, 15, 7, 7, 10, { top: '#9fd8f6', left: '#5fb6e6', right: '#3f8fc4' });
      p.faceV(5.5, 11.5, 17, 1, 7, '#d6f1ff');
      p.box(6, 6, 25, 4, 4, 2, '#3b6fd6');
    },
  },
  cafetera: {
    h: 26,
    draw: (p) => {
      p.box(2, 3, 0, 12, 10, 13, WALNUT);
      p.faceV(3, 13, 1.5, 4.5, 10, '#5a3826');
      p.faceV(8.5, 13, 1.5, 4.5, 10, '#5a3826');
      p.box(3, 4.5, 13, 10, 7, 10, '#c8c9d4');
      p.faceV(4, 11.5, 14, 8, 7, '#2a2c35');
      p.faceV(5, 11.5, 19, 2, 1.5, '#ffcf7a');
      p.box(6.5, 9.5, 13, 3, 2.5, 3, '#ffffff');
      p.dot(11, 11.5, 20, '#5fd46a', 2);
    },
  },
  minirefri: {
    h: 22,
    draw: (p) => {
      p.box(3, 3, 0, 10, 10, 19, '#e8e9f0');
      p.faceV(3, 13, 13, 10, 0.8, '#b8bac8');
      p.faceV(10.5, 13, 5, 1, 6, '#8a8f9c');
      p.faceV(10.5, 13, 15, 1, 3, '#8a8f9c');
      p.faceV(4, 13, 15, 3, 2.5, '#f2b134');
      p.faceV(5, 13, 8, 2.5, 2.5, '#d64545');
    },
  },
  arcade: {
    h: 40,
    draw: (p) => {
      p.box(3, 3, 0, 10, 10, 34, '#4b2a8a');
      p.faceV(3.5, 13, 0, 9, 34, '#5b34a6');
      p.faceV(4, 13, 20, 8, 10, '#14141c');
      p.faceV(4.8, 13, 21, 6.4, 8, '#2fd6a0');
      p.faceV(6, 13, 24, 2, 2, '#ffe28a');
      p.faceV(9, 13, 22, 1.5, 1.5, '#f07fb0');
      p.box(3, 13, 15, 10, 3.5, 2.5, '#2d1a57');
      p.dot(6, 15, 17.5, '#d64545', 2);
      p.dot(9, 15, 17.5, '#f2c134', 2);
      p.faceV(4, 13, 31, 8, 2.5, '#f2c134');
      p.faceV(5, 13, 6, 6, 1, '#f07fb0');
    },
  },
  alfombra: {
    h: 2,
    draw: (p) => {
      p.box(1, 1, 0, 30, 30, 0.8, '#5a3a36', false);
      p.top(3, 3, 26, 26, 0.8, '#8a4a44');
      p.top(5, 5, 22, 22, 0.8, '#c9a26a');
      p.top(6, 6, 20, 20, 0.8, '#7c3e3a');
      p.top(11, 11, 10, 10, 0.8, '#c9a26a');
      p.top(13, 13, 6, 6, 0.8, '#e6c48a');
    },
  },
  lampara: {
    h: 34,
    draw: (p) => {
      p.disc(8, 8, 1, 3, 1, DARK);
      p.box(7.5, 7.5, 1, 1, 1, 22, '#c9a24a');
      p.box(4, 4, 23, 8, 8, 7, { top: '#fff4c8', left: '#ffd98a', right: '#e8b45a' });
      p.faceV(4, 12, 23, 8, 0.8, '#fff8e0');
    },
  },
  pizarra: {
    h: 34,
    draw: (p) => {
      p.box(2, 7, 0, 1, 2, 12, METAL);
      p.box(13, 7, 0, 1, 2, 12, METAL);
      p.box(1, 7, 11, 14, 2, 18, '#aab2c0');
      p.faceV(1.8, 9, 12, 12.4, 16.4, '#fbfbfe');
      const pts: [number, number][] = [[3, 14], [5, 17], [7, 16], [9, 20], [11, 22], [13, 26]];
      for (let i = 1; i < pts.length; i++) p.line3([pts[i - 1][0], 9, pts[i - 1][1]], [pts[i][0], 9, pts[i][1]], '#d64545');
      p.faceV(3, 9, 25, 4, 0.8, '#3b6fd6');
      p.faceV(3, 9, 23, 3, 0.8, '#3b6fd6');
      p.box(2, 9, 11, 12, 1.5, 1, '#8a8f9c');
    },
  },
  globo: {
    h: 26,
    draw: (p) => {
      p.disc(8, 8, 2, 4, 2, WALNUT);
      p.box(7.5, 7.5, 2, 1, 1, 6, '#c9a24a');
      p.blob(8, 8, 15, 5.5, 5.5, '#2f6fc8');
      p.blob(6.5, 8, 17, 2.5, 2, '#4fa85a');
      p.blob(10, 7, 13, 2, 1.5, '#4fa85a');
      p.blob(6, 9, 18.5, 1.2, 1, '#bfe6ff');
      p.line3([3, 8, 15], [13, 8, 15], '#c9a24a');
    },
  },
  cuadro: {
    h: 32,
    draw: (p) => {
      p.box(4, 6, 0, 1, 1, 24, '#8a5a35');
      p.box(11, 6, 0, 1, 1, 24, '#8a5a35');
      p.box(7.5, 3, 0, 1, 1, 22, '#8a5a35');
      p.box(2, 7, 8, 12, 2, 15, '#c9a24a');
      const sky = ['#f07f3c', '#f2b134', '#f07fb0', '#8e5bd6', '#3b4a8a'];
      sky.forEach((c, i) => p.faceV(3, 9, 20 - i * 2.4, 10, 2.4, c));
      p.blob(9, 9, 16, 2, 2, '#fff1b8');
      p.faceV(3, 9, 9, 10, 2, '#2a2c35');
    },
  },
  trofeo: {
    h: 34,
    draw: (p) => {
      p.box(2, 3, 0, 12, 10, 30, '#3a2a22');
      p.faceV(3, 13, 2, 10, 26, '#2a3a46');
      p.faceV(3, 13, 2, 10, 26, '#9fd6f055');
      p.faceV(3, 13, 11, 10, 0.8, '#5a4030');
      p.faceV(3, 13, 20, 10, 0.8, '#5a4030');
      const gold = '#f2c134';
      for (const [u, z] of [[5, 12], [9, 12], [7, 21], [4.5, 3], [9.5, 3]] as [number, number][]) {
        p.faceV(u + 0.5, 13, z, 1, 1.5, '#c9961e');
        p.faceV(u, 13, z + 1.5, 2, 3, gold);
        p.dot(u + 0.5, 13, z + 4, '#fff1b8');
      }
      p.faceV(3.5, 13, 27, 1, 1, '#ffffff');
    },
  },
  acuario: {
    h: 30,
    draw: (p) => {
      p.box(1, 3, 0, 30, 10, 11, '#24262e');
      p.box(1, 3, 11, 30, 10, 15, { top: '#1e2a35', left: '#3aa6e0', right: '#2a7fb0' });
      p.faceV(2, 13, 11.5, 28, 2, '#e3c98a');
      const fish: [number, number, string][] = [[7, 18, '#f07f3c'], [15, 15, '#f2c134'], [22, 20, '#f07fb0'], [11, 21, '#ffffff'], [26, 16, '#5ff2ff']];
      for (const [u, z, c] of fish) {
        p.faceV(u, 13, z, 2.5, 1.2, c);
        p.faceV(u - 1, 13, z + 0.2, 1, 0.8, shade(c, -0.3));
      }
      for (const u of [4, 25, 28]) p.faceV(u, 13, 13, 1, 6 + (u % 3) * 2, '#3f9a4a');
      p.faceV(2, 13, 22, 28, 0.6, '#bfe9ff');
      p.box(1, 3, 26, 30, 10, 1.5, DARK);
    },
  },
  neon: {
    h: 32,
    draw: (p) => {
      p.box(7, 7, 0, 2, 2, 12, METAL);
      p.box(1, 7, 12, 14, 2, 16, '#14141c');
      const pink = '#ff6fd8';
      const cyan = '#5ff2ff';
      p.faceV(3.5, 9, 15, 1, 10, pink);
      p.faceV(6.5, 9, 15, 1, 10, cyan);
      p.faceV(7.5, 9, 24, 3.5, 1, cyan);
      p.faceV(7.5, 9, 20, 3.5, 1, cyan);
      p.faceV(10.5, 9, 20.5, 1, 4, cyan);
      p.faceV(12.5, 9, 15, 1, 10, '#ffe28a');
    },
  },
  estatua: {
    h: 38,
    draw: (p) => {
      p.box(3, 3, 0, 10, 10, 11, '#e8e8f0');
      p.faceV(4, 13, 4, 8, 2, '#c9a24a');
      const gold = { top: '#ffe28a', left: '#f2c134', right: '#c9961e' };
      p.box(6, 6, 11, 4, 4, 10, gold);
      p.box(4, 7, 17, 2, 2, 8, gold);
      p.box(10, 7, 19, 2, 2, 8, gold);
      p.blob(8, 8, 25, 3.2, 3.2, '#f2c134');
      p.blob(7, 8, 26.5, 1, 1, '#fff1b8');
      p.dot(4, 7, 28, '#ffffff', 2);
      p.dot(12, 7, 30, '#ffffff', 2);
    },
  },
  mesa_reuniones: {
    h: 22,
    draw: (p) => {
      p.box(10, 10, 0, 6, 12, 11, '#3a2a22');
      p.box(48, 10, 0, 6, 12, 11, '#3a2a22');
      p.box(1, 2, 11, 62, 28, 2, '#7a4e34');
      p.top(4, 5, 56, 22, 13, '#8a5a3c');
      for (const u of [9, 26, 43]) {
        p.box(u, 6, 13, 9, 6, 0.8, '#c8c9d4');
        p.box(u, 6, 13.8, 9, 0.8, 5, { top: '#c8c9d4', left: '#2a2c35', right: '#9aa0ad' });
      }
      mug(p, 31, 20, 13);
      paperStack(p, 18, 22, 13);
      p.box(46, 22, 13, 3, 3, 4, POT_DARK);
      p.blob(47.5, 23.5, 19, 2.5, 2, LEAF);
    },
  },
  mesa_comedor: {
    h: 22,
    draw: (p) => {
      p.box(10, 10, 0, 6, 12, 11, '#3a2a22');
      p.box(48, 10, 0, 6, 12, 11, '#3a2a22');
      p.box(1, 2, 11, 62, 28, 2, '#7a4e34');
      p.box(2, 3, 13, 60, 26, 0.6, '#f1ece2'); // mantel
      p.top(4, 6, 56, 20, 13.6, '#e4dccd');
      // Un plato servido frente a cada silla (cuatro arriba, dos a la izquierda).
      const plate = (u: number, v: number, food: string) => {
        p.disc(u, v, 13.6, 3.2, 0.6, '#ffffff');
        p.blob(u, v, 14.4, 1.8, 1, food);
      };
      [[8, 7], [24, 7], [40, 7], [56, 7]].forEach(([u, v], i) => plate(u, v, ['#d9822b', '#7cb342', '#c0392b', '#e8c14a'][i]));
      plate(7, 16, '#8d6e63');
      plate(7, 26, '#7cb342');
      mug(p, 30, 18, 13.6, '#f07f3c');
      p.box(44, 20, 13.6, 2, 2, 5, '#3f7fb5'); // jarra de jugo
      p.box(50, 15, 13.6, 6, 4, 2.5, '#c76a3c'); // panera
    },
  },
  meson: {
    h: 22,
    draw: (p) => {
      p.box(1, 2, 0, 46, 12, 15, '#3a2a22');
      p.faceV(2, 14, 1.5, 44, 12, '#4a3428');
      for (const u of [12, 24, 36]) p.faceV(u, 14, 1.5, 0.8, 12, '#2a1d17');
      for (const u of [7, 19, 31, 42]) p.faceV(u, 14, 8, 2, 0.8, '#c9a24a');
      p.box(0, 1, 15, 48, 14, 2, '#e6e1d6');
      p.box(6, 4, 17, 8, 6, 0.8, '#9aa0ad'); // lavaplatos
      p.top(7, 5, 6, 4, 17.2, '#5a5f6b');
      p.box(10, 3, 17, 1, 1, 5, '#c8c9d4');
      p.box(10, 3, 22, 1, 3, 1, '#c8c9d4');
      mug(p, 20, 6, 17, '#f07f3c');
      mug(p, 23, 5, 17);
      p.box(32, 4, 17, 8, 6, 2, '#c76a3c');
    },
  },
  mesa_redonda: {
    h: 20,
    draw: (p) => {
      p.disc(8, 8, 1, 5, 1, DARK);
      p.box(7.25, 7.25, 1, 1.5, 1.5, 10, '#5a5f6b');
      p.disc(8, 8, 12, 8, 1.5, '#a8784e');
      mug(p, 9, 5, 12);
      mug(p, 5, 9, 12, '#f2b134');
    },
  },
  meson_recepcion: {
    h: 24,
    draw: (p) => {
      p.box(1, 2, 0, 46, 12, 17, '#2a2c35');
      p.faceV(1, 14, 6, 46, 4, '#ffcf7a');
      p.faceV(1, 14, 10, 46, 0.8, '#c9961e');
      p.box(0, 1, 17, 48, 14, 2, '#e4d6c0');
      monitorBack(p, 30, 3, 19, 10);
      paperStack(p, 8, 6, 19);
    },
  },
  // ---- Legendarios ----
  bola_disco: {
    h: 46,
    draw: (p) => {
      p.disc(8, 8, 1, 4, 1, DARK);
      p.box(7.5, 7.5, 1, 1, 1, 30, '#c8c9d4');
      p.box(4, 7.5, 31, 8, 1, 1, '#c8c9d4');
      const [cx, cy] = p.pt(8, 8, 38);
      const r = 6.5 * p.s;
      p.pc.ellipse(cx, cy, r, r, '#9aa0ad');
      // Mosaico de espejitos.
      for (let y = -r; y <= r; y += 3) {
        for (let x = -r; x <= r; x += 3) {
          if (x * x + y * y > r * r) continue;
          const k = Math.abs(Math.floor(x * 7 + y * 13)) % 5;
          const c = ['#ffffff', '#d8f6ff', '#b8bfd0', '#ff9be8', '#7fe6ff'][k];
          p.pc.rect(Math.round(cx + x), Math.round(cy + y), 2, 2, c);
        }
      }
      p.pc.rect(Math.round(cx - r * 0.5), Math.round(cy - r * 0.5), 3, 3, '#ffffff');
    },
  },
  trono: {
    h: 38,
    draw: (p) => {
      const gold = { top: '#ffe28a', left: '#f2c134', right: '#c9961e' };
      const red = { top: '#e05a6a', left: '#c0392b', right: '#962b22' };
      p.box(2, 2, 0, 12, 12, 7, gold);
      p.box(2, 1, 7, 12, 3, 26, gold);
      p.faceV(4, 4, 10, 8, 20, '#c0392b');
      p.box(3, 4, 7, 10, 9, 3, red);
      p.box(1.5, 4, 7, 2, 10, 8, gold);
      p.box(12.5, 4, 7, 2, 10, 8, gold);
      for (const u of [3, 8, 13]) p.box(u - 1, 1, 33, 2, 2, 3, gold);
      p.dot(8, 4, 26, '#5ff2ff', 2);
      p.dot(5, 4, 22, '#f07fb0', 2);
      p.dot(11, 4, 22, '#5fd46a', 2);
    },
  },
  cofre: {
    h: 24,
    draw: (p) => {
      const wood = { top: '#9a6a44', left: '#7a4e32', right: '#5c3a27' };
      p.box(2, 3, 0, 12, 10, 10, wood);
      p.faceV(2, 13, 0, 12, 10, '#7a4e32');
      for (const u of [3, 12]) p.faceV(u, 13, 0, 1.5, 10, '#c9a24a');
      p.faceV(7, 13, 5, 2, 3, '#f2c134');
      // Monedas desbordando.
      p.box(2.5, 3.5, 10, 11, 9, 2, '#f2c134');
      for (const [u, v, z] of [[5, 6, 12], [9, 5, 12.5], [7, 9, 12], [11, 8, 12], [4, 10, 12], [8, 7, 14]]) {
        p.blob(u, v, z, 1.8, 1, '#ffe28a');
        p.dot(u - 0.5, v, z + 0.5, '#fff6c8');
      }
      p.box(2, 1, 10, 12, 2, 10, wood);
      p.faceV(2, 3, 10, 12, 10, '#6b4430');
      p.dot(7.5, 3, 18, '#ffffff', 2);
    },
  },
  piano: {
    h: 34,
    draw: (p) => {
      const black = { top: '#2c2d36', left: '#1a1b22', right: '#111218' };
      for (const [u, v] of [[6, 6], [24, 8], [10, 26]] as [number, number][]) p.box(u, v, 0, 2, 2, 12, '#111218');
      p.box(3, 3, 12, 26, 20, 8, black);
      p.box(3, 3, 20, 26, 20, 1, '#2c2d36');
      // Tapa abierta.
      p.pc.poly([p.pt(4, 4, 21), p.pt(28, 4, 21), p.pt(18, 10, 36)], '#22232b');
      p.line3([28, 4, 21], [18, 10, 36], '#5a5f6b');
      p.box(5, 23, 13, 22, 6, 6, black);
      p.top(6, 23, 20, 4, 19, '#f4f2ec');
      for (let u = 7; u < 25; u += 2.2) p.faceV(u, 23, 19, 1, 0.1, '#111218');
      for (let u = 7.5; u < 25; u += 3.3) p.top(u, 23, 1.2, 2, 19.3, '#111218');
      p.dot(12, 6, 24, '#ffe28a');
    },
  },
  robot: {
    h: 36,
    draw: (p) => {
      const steel = { top: '#e8eaf0', left: '#c8ccd8', right: '#9aa0b0' };
      p.disc(8, 8, 2, 5, 2, '#5a5f6b');
      p.box(5, 5, 4, 6, 6, 14, steel);
      p.faceV(6, 11, 8, 4, 6, '#2a2c35');
      p.dot(7, 11, 12, '#5ff2ff', 2);
      p.dot(8.5, 11, 10, '#5fd46a');
      p.box(2.5, 7, 9, 2, 2, 8, steel);
      p.box(11.5, 7, 9, 2, 2, 8, steel);
      p.box(4, 4, 18, 8, 8, 9, steel);
      p.faceV(5, 12, 19.5, 6, 6, '#1c1d24');
      p.dot(6, 12, 23, '#5ff2ff', 2);
      p.dot(9, 12, 23, '#5ff2ff', 2);
      p.faceV(6.5, 12, 20.5, 3, 0.6, '#5ff2ff');
      p.box(7.5, 7.5, 27, 1, 1, 5, '#9aa0b0');
      p.blob(8, 8, 33, 1.5, 1.5, '#ff6f6f');
    },
  },
  fuente: {
    h: 30,
    draw: (p) => {
      const stone = { top: '#eceaf2', left: '#cfcdd9', right: '#a9a7b6' };
      p.disc(16, 16, 0.5, 13, 5, '#cfcdd9');
      p.disc(16, 16, 5.5, 11, 0, '#4fb3e6');
      p.blob(12, 14, 6, 3, 1, '#bfe9ff');
      p.box(14, 14, 5, 4, 4, 10, stone);
      p.disc(16, 16, 15, 6, 1.5, '#cfcdd9');
      p.disc(16, 16, 16.5, 5, 0, '#5fc4f0');
      p.box(15, 15, 16, 2, 2, 6, stone);
      // Chorros.
      for (const [du, dv] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) {
        p.line3([16, 16, 23], [16 + du, 16 + dv, 17], '#bfe9ff');
        p.line3([16 + du, 16 + dv, 17], [16 + du * 2, 16 + dv * 2, 6], '#9fd6f0');
      }
      p.blob(16, 16, 24, 1.5, 1.5, '#e0f6ff');
    },
  },
  cohete: {
    h: 56,
    draw: (p) => {
      const white = { top: '#ffffff', left: '#e8eaf0', right: '#b8bdcc' };
      const red = { top: '#ff7a6a', left: '#d64545', right: '#a83232' };
      p.disc(8, 8, 1, 7, 1, '#2a2c35');
      // Aletas.
      p.box(1.5, 7, 1, 3, 2, 10, red);
      p.box(11.5, 7, 1, 3, 2, 10, red);
      p.box(7, 12, 1, 2, 3, 10, red);
      p.box(4.5, 4.5, 2, 7, 7, 34, white);
      p.faceV(5.5, 11.5, 10, 5, 0.8, '#d64545');
      p.faceV(5.5, 11.5, 30, 5, 0.8, '#d64545');
      p.blob(8, 11.5, 22, 2.6, 2.6, '#3b6fd6');
      p.blob(7.5, 11.5, 22.6, 1.6, 1.6, '#9fd6f0');
      p.box(5.5, 5.5, 36, 5, 5, 6, red);
      p.box(6.5, 6.5, 42, 3, 3, 5, red);
      p.box(7.5, 7.5, 47, 1, 1, 4, '#ff7a6a');
      p.blob(8, 8, 0.5, 3, 1.5, '#ffcf7a');
      p.blob(8, 8, -0.5, 1.6, 1, '#fff1b8');
    },
  },
  trex: {
    h: 46,
    draw: (p) => {
      const bone = { top: '#fbf5e4', left: '#ece4cf', right: '#c9bd9e' };
      const vert = (u: number, v: number, z: number, s: number) => p.box(u - s / 2, v - s / 2, z - s / 2, s, s, s, bone, false);
      // Pedestal con placa dorada.
      p.box(2, 2, 0, 28, 28, 4, { top: '#5a4636', left: '#4a3a2e', right: '#3a2d24' });
      p.faceV(10, 30, 1, 12, 2, '#c9a24a');
      // Patas traseras: muslo, canilla y pie.
      for (const v of [13, 19]) {
        p.box(13, v, 4, 3, 3, 8, bone);
        p.box(14, v, 11, 4, 3, 7, bone);
        p.box(10, v - 0.5, 4, 6, 4, 2, bone);
      }
      // Columna: de la punta de la cola a la cabeza, vértebras cada vez más gruesas.
      const spine: [number, number, number][] = [[3, 26, 10], [6, 23, 15], [9, 20, 19], [13, 17, 22], [17, 15, 24], [21, 13, 27], [24, 11, 31]];
      for (let i = 1; i < spine.length; i++) {
        const [a, b] = [spine[i - 1], spine[i]];
        for (let t = 0; t < 1; t += 0.25) {
          const s = 1.6 + (i / spine.length) * 1.6;
          vert(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, s);
        }
      }
      // Costillas: arcos de bloques a ambos lados.
      for (let k = 0; k < 5; k++) {
        const u = 12 + k * 2.2;
        const v = 17.5 - k * 0.9;
        const z = 22 + k * 0.9;
        for (let j = 1; j <= 4; j++) {
          vert(u + j * 0.35, v + j * 0.8, z - j * 2, 1.2);
          vert(u - j * 0.35, v - j * 0.8, z - j * 2, 1.2);
        }
      }
      // Bracitos.
      p.box(22, 9, 24, 1.5, 1.5, 5, bone);
      p.box(22, 14, 24, 1.5, 1.5, 5, bone);
      // Cráneo con mandíbula y dientes.
      p.box(23, 8, 30, 7, 6, 6, bone);
      p.box(28, 8.5, 30.5, 5, 5, 4, bone);
      p.box(27, 9, 27, 6, 4, 2.5, bone);
      p.faceV(28, 13.5, 29.5, 5, 1, '#3a2d24');
      for (let u = 28.5; u < 33; u += 1.2) p.dot(u, 13.5, 30, '#ffffff', 2);
      p.dot(25, 14, 34, '#2a2430', 3);
    },
  },
  // --- Muebles nuevos -------------------------------------------------------
  mesa_centro: {
    h: 14,
    draw: (p) => {
      const wood = '#7a5238';
      for (const [u, v] of [[3, 4], [12, 4], [3, 12], [12, 12]] as [number, number][]) p.box(u, v, 0, 1.5, 1.5, 7, shade(wood, -0.2));
      p.box(2, 3, 7, 13, 11, 2.5, wood);
      p.box(4, 5, 9.5, 5, 4, 1.5, '#3b6fd6');
      p.box(4.3, 5.3, 11, 4.4, 3.4, 0.8, '#f2b134');
      mug(p, 10.5, 8, 9.5);
    },
  },
  biombo: {
    h: 30,
    draw: (p) => {
      const panels: [number, number][] = [[1, 7], [5.5, 5], [10, 7]];
      for (const [u, v] of panels) {
        p.box(u, v, 0, 4.5, 1.2, 27, '#3a2a22');
        p.faceV(u + 0.5, v + 1.2, 1.5, 3.5, 24, '#f1e6cc');
        p.faceV(u + 0.5, v + 1.2, 13, 3.5, 0.5, '#3a2a22');
      }
      for (const [u, z] of [[2.5, 21], [3.5, 19], [7, 22], [8, 18], [11.5, 20], [12.5, 23]] as [number, number][]) {
        p.dot(u, u < 5 || u > 10 ? 8.2 : 6.2, z, '#f07fb0', 2);
      }
      p.line3([1.6, 8.2, 16], [4.5, 8.2, 22], '#5a3a22');
      p.line3([11, 8.2, 15], [14, 8.2, 21], '#5a3a22');
    },
  },
  sillon_cuero: {
    h: 22,
    draw: (p) => {
      const leather = '#7d4a2d';
      p.box(2, 3, 0, 12, 11, 7, shade(leather, -0.15));
      p.box(2, 2, 7, 12, 3, 12, shade(leather, -0.05));
      p.box(2, 4, 7, 2.5, 10, 6, leather);
      p.box(11.5, 4, 7, 2.5, 10, 6, leather);
      p.box(4.5, 5, 7, 7, 8.5, 2.5, shade(leather, 0.08));
      for (const [u, z] of [[5, 15], [8, 15], [11, 15], [6.5, 12], [9.5, 12]] as [number, number][]) p.dot(u, 5, z, '#4a2a18');
    },
  },
  escritorio_pie: {
    h: 34,
    draw: (p) => {
      for (const u of [3, 27]) {
        p.box(u - 1, 3, 0, 4, 10, 1.2, METAL);
        p.box(u, 7, 1, 2, 2, 18, '#9aa0ad');
      }
      p.box(1, 2, 19, 30, 12, 1.5, '#d9c7a8');
      monitorBack(p, 9, 3, 20.5, 14);
      p.box(10, 8.5, 20.5, 11, 3, 0.8, '#d8d8e2');
      p.box(26, 4, 20.5, 3, 3, 3, '#2fa66a');
      p.blob(27.5, 5.5, 25, 2, 1.4, LEAF_LIGHT);
    },
  },
  hamaca: {
    h: 24,
    draw: (p) => {
      const post = '#8a5a3a';
      p.box(1, 6, 0, 2.5, 2.5, 20, post);
      p.box(28.5, 6, 0, 2.5, 2.5, 20, post);
      const stripes = ['#e0644c', '#f2b134', '#3b6fd6', '#2fa66a'];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const z = 15 - Math.sin(Math.PI * t) * 7;
        p.box(3 + 24 * t, 4.5, z, 2.4, 7, 1.2, stripes[i % stripes.length]);
      }
      p.line3([2.2, 7, 19], [4, 7, 15], '#e8e4da');
      p.line3([29.8, 7, 19], [28, 7, 15], '#e8e4da');
    },
  },
  // --- Plantas nuevas --------------------------------------------------------
  suculentas: {
    h: 10,
    draw: (p) => {
      for (const [u, v, c] of [[2, 6, POT_TERRACOTA], [7, 3, '#e8e4da'], [9, 9, '#3b6fd6']] as [number, number, string][]) {
        pot(p, u, v, 4, 3, c);
        p.blob(u + 2, v + 2, 4.5, 1.8, 1.1, '#6fae7a');
        p.blob(u + 2, v + 2, 5.5, 1, 0.7, '#9bd6a2');
      }
    },
  },
  lavanda: {
    h: 22,
    draw: (p) => {
      pot(p, 4, 4, 8, 6, '#e8e4da');
      for (let i = 0; i < 9; i++) {
        const du = Math.cos(i * 2.3) * 3;
        const dv = Math.sin(i * 2.3) * 3;
        const z = 15 + (i % 3) * 2;
        p.line3([8, 8, 6], [8 + du, 8 + dv, z], LEAF_DARK);
        p.dot(8 + du, 8 + dv, z + 1.5, '#9b7fd6', 2);
        p.dot(8 + du, 8 + dv, z + 3, '#b9a3f0');
      }
    },
  },
  girasoles: {
    h: 32,
    draw: (p) => {
      pot(p, 4, 4, 8, 7, '#3b6fd6');
      for (const [du, dv, z] of [[-3, 0, 24], [2, -2, 28], [3, 3, 21]] as [number, number, number][]) {
        p.line3([8, 8, 7], [8 + du, 8 + dv, z], LEAF_DARK);
        p.blob(8 + du * 0.6, 8 + dv * 0.6, z - 6, 1.6, 0.8, LEAF);
        p.blob(8 + du, 8 + dv, z, 3, 3, '#f2c134');
        p.blob(8 + du, 8 + dv, z, 1.4, 1.4, '#6b4a2e');
      }
    },
  },
  orquidea: {
    h: 26,
    draw: (p) => {
      pot(p, 5, 5, 6, 5, '#f4f2ec');
      p.blob(7, 9, 6, 3, 1.2, LEAF_DARK);
      p.blob(9.5, 7, 6.5, 2.6, 1, LEAF);
      p.line3([8, 8, 6], [7, 8, 20], '#5a6b3a');
      p.line3([7, 8, 20], [11, 8, 22], '#5a6b3a');
      for (const [u, z] of [[7.5, 18], [9, 21], [10.5, 22], [12, 20]] as [number, number][]) {
        p.blob(u, 8, z, 1.8, 1.6, '#f07fb0');
        p.dot(u, 8, z, '#fff1b8');
      }
    },
  },
  palmera: {
    h: 52,
    draw: (p) => {
      pot(p, 4, 4, 8, 6, POT_TERRACOTA);
      for (let k = 0; k < 8; k++) {
        const s = 3 - k * 0.15;
        p.box(8 - s / 2 + k * 0.3, 8 - s / 2, 6 + k * 4, s, s, 4, k % 2 ? '#8a6a45' : '#a07c52');
      }
      fan(p, 10.5, 8, 40, 10, 13, 1.25);
      p.blob(10.5, 8, 39, 1.5, 1.2, '#6b4a2e');
    },
  },
  // --- Tecnología nueva ------------------------------------------------------
  impresora: {
    h: 14,
    draw: (p) => {
      p.box(2, 3, 0, 12, 10, 8, { top: '#f2f3f7', left: '#dfe2ea', right: '#b8bdcc' });
      p.box(4, 3.5, 8, 8, 6, 1.5, '#cfd3dd');
      p.top(4.5, 9, 7, 5, 6.2, PAPER);
      p.faceV(3, 13, 5.5, 6, 1, '#2a2c35');
      p.dot(11, 13, 6, '#5fd46a');
      p.dot(12.5, 13, 6, '#f2b134');
    },
  },
  parlante: {
    h: 14,
    draw: (p) => {
      p.disc(8, 8, 11, 4, 11, '#2d2f38');
      p.blob(8, 8, 11, 4, 2, '#3c3f4a');
      p.blob(8, 8, 11.2, 3, 1.3, '#5ff2ff');
      p.blob(8, 8, 11.3, 2.2, 0.9, '#3c3f4a');
      for (let z = 3; z < 9; z += 1.5) p.line3([5.5, 11, z], [9.5, 11.8, z], '#3c3f4a');
    },
  },
  pantalla_kpi: {
    h: 34,
    draw: (p) => {
      p.box(5, 5, 0, 6, 6, 1, METAL);
      p.box(7.5, 7.5, 1, 1, 1, 14, '#9aa0ad');
      p.box(1, 7, 14, 14, 1.5, 13, { top: '#3a3d48', left: '#22242c', right: '#1a1b22' });
      p.faceV(1.8, 8.5, 15, 12.4, 11, '#0f1a2a');
      const bars = [3, 5, 4, 7, 9];
      bars.forEach((h, i) => p.faceV(2.6 + i * 2.2, 8.6, 15.8, 1.4, h, i === 4 ? '#5fd46a' : '#3b6fd6'));
      p.line3([2.5, 8.6, 18], [6, 8.6, 21], '#f2b134');
      p.line3([6, 8.6, 21], [9, 8.6, 20], '#f2b134');
      p.line3([9, 8.6, 20], [13.5, 8.6, 25], '#f2b134');
    },
  },
  consola: {
    h: 30,
    draw: (p) => {
      p.box(2, 4, 0, 12, 8, 7, WALNUT);
      p.faceV(3, 12, 1, 4.5, 4.5, '#4a2f20');
      p.faceV(8.5, 12, 1, 4.5, 4.5, '#4a2f20');
      p.box(2, 5, 7, 12, 1.2, 15, '#1a1b22');
      p.faceV(2.6, 6.2, 8, 10.8, 13, '#3b6fd6');
      p.faceV(2.6, 6.3, 8, 10.8, 3, '#2fa66a');
      p.dot(5, 6.3, 16, '#f2b134', 2);
      p.dot(10, 6.3, 13, '#d64545', 2);
      p.box(9, 8.5, 7, 4, 3, 1.5, '#f4f4f8');
      p.dot(10.5, 11.5, 7.8, '#5ff2ff');
      p.box(3, 9, 7, 3, 2, 1, '#2d2f38');
    },
  },
  dron: {
    h: 26,
    draw: (p) => {
      p.disc(8, 8, 1, 7, 1, '#3c3f4a');
      p.line3([6, 6, 1.1], [6, 10, 1.1], '#f2b134');
      p.line3([10, 6, 1.1], [10, 10, 1.1], '#f2b134');
      p.line3([6, 8, 1.1], [10, 8, 1.1], '#f2b134');
      p.blob(8, 8, 2, 4, 2, '#00000044');
      for (const [u, v] of [[3, 3], [13, 3], [3, 13], [13, 13]] as [number, number][]) {
        p.line3([8, 8, 14], [u, v, 15], '#2a2c35');
        p.blob(u, v, 16, 3, 1.2, '#9aa0ad');
        p.blob(u, v, 16.2, 1, 0.5, '#2a2c35');
      }
      p.box(6, 6, 12, 4, 4, 3, { top: '#ffffff', left: '#e8eaf0', right: '#b8bdcc' });
      p.dot(8, 10, 13, '#d64545');
      p.dot(10, 8, 13, '#5fd46a');
      p.blob(8, 10, 11, 1, 1, '#1c1d24');
    },
  },
  // --- Decoración nueva ------------------------------------------------------
  pecera: {
    h: 18,
    draw: (p) => {
      p.box(4, 4, 0, 8, 8, 6, '#7a5238');
      p.blob(8, 8, 11, 4.6, 4, '#cfefff88');
      p.blob(8, 8, 10, 4, 3, '#4fb3e6aa');
      p.blob(8, 8, 14, 3.6, 1.2, '#9fd6f0');
      p.dot(7, 9, 10, '#f07f3c', 2);
      p.dot(6.5, 9, 10.3, '#ffb36b');
      p.line3([10, 9, 7], [10, 9, 10], LEAF);
    },
  },
  lampara_lava: {
    h: 24,
    draw: (p) => {
      p.box(6, 6, 0, 4, 4, 3.5, '#c9a24a');
      p.box(6.4, 6.4, 3.5, 3.2, 3.2, 12, { top: '#ff9ac8', left: '#e05a9a', right: '#b8407a' });
      p.blob(8, 9.6, 7, 1.2, 1.4, '#ffb36b');
      p.blob(8, 9.6, 12, 1, 1.1, '#ffd36b');
      p.blob(7.5, 9.6, 9.5, 0.7, 0.7, '#ffe89a');
      p.box(6.6, 6.6, 15.5, 2.8, 2.8, 3, '#c9a24a');
    },
  },
  parasol: {
    h: 38,
    draw: (p) => {
      p.box(7.5, 7.5, 0, 1, 1, 9, '#9aa0ad');
      p.disc(8, 8, 9.5, 5, 1, '#f4f2ec');
      mug(p, 5, 7, 9.5, '#f2b134');
      p.box(7.7, 7.7, 9.5, 0.6, 0.6, 20, '#e8e4da');
      p.blob(8, 8, 29, 11, 5.2, '#e0644c');
      p.blob(8, 8, 29.6, 8, 3.6, '#f4f2ec');
      p.blob(8, 8, 30.2, 4.6, 2.2, '#e0644c');
      p.dot(8, 8, 32, '#f4f2ec', 2);
    },
  },
  reloj_pie: {
    h: 42,
    draw: (p) => {
      const wood = '#5c3a27';
      p.box(4, 5, 0, 8, 6, 34, wood);
      p.faceV(5.5, 11, 5, 5, 15, '#2a1d17');
      p.line3([8, 11, 18], [8, 11, 9], '#c9a24a');
      p.blob(8, 11, 8.5, 1.6, 1.6, '#f2c134');
      p.blob(8, 11, 27, 3.2, 3.2, '#c9a24a');
      p.blob(8, 11, 27, 2.6, 2.6, '#f4f2ec');
      p.line3([8, 11, 27], [8, 11, 29], '#1b1626');
      p.line3([8, 11, 27], [9.5, 11, 27], '#1b1626');
      p.box(3.5, 4.5, 34, 9, 7, 2.5, shade(wood, 0.1));
      p.box(6.5, 6.5, 36.5, 3, 3, 2, '#c9a24a');
    },
  },
  gato: {
    h: 14,
    draw: (p) => {
      p.disc(8, 8, 3.5, 6.5, 3, '#8e5bd6');
      p.blob(8, 8, 4, 5.4, 2.4, '#a77ee8');
      const fur = '#f2a65a';
      p.blob(8.5, 7.5, 6.5, 4.2, 2.6, fur);
      p.blob(11, 9, 6, 2.2, 1.2, fur);
      for (const u of [7, 9, 11]) p.line3([u, 6, 8.5], [u - 0.5, 9, 7.5], '#c97a3a');
      p.blob(5.2, 10, 7.5, 2.4, 2, fur);
      p.dot(4, 10.5, 9.6, '#c97a3a', 2);
      p.dot(6.2, 10.5, 9.6, '#c97a3a', 2);
      p.line3([4.3, 11.5, 7.6], [5, 11.5, 7.6], '#5a3a22');
      p.line3([5.6, 11.5, 7.6], [6.3, 11.5, 7.6], '#5a3a22');
    },
  },
  perro: {
    h: 20,
    draw: (p) => {
      p.disc(8, 8, 2.5, 6.5, 2, '#3b6fd6');
      const fur = '#c98e5a';
      p.blob(8, 8, 7, 3.6, 3.2, fur);
      p.blob(9, 9, 4, 2.4, 1.4, fur);
      p.blob(7, 10.5, 12, 2.8, 2.4, fur);
      p.blob(5.2, 10.5, 12.5, 1.1, 2, '#8a5a3a');
      p.blob(8.8, 10.5, 12.5, 1.1, 2, '#8a5a3a');
      p.blob(7, 12, 10.6, 1.4, 1, '#e8c8a0');
      p.dot(7, 12.6, 11, '#1b1626', 2);
      p.dot(6.2, 11.5, 12.6, '#1b1626');
      p.dot(7.8, 11.5, 12.6, '#1b1626');
      p.line3([5.5, 10.5, 9.8], [8.5, 10.5, 9.8], '#d64545');
      p.line3([11, 6, 8], [12.5, 5, 11], fur);
    },
  },
  // --- Premium nuevo ---------------------------------------------------------
  futbolito: {
    h: 24,
    draw: (p) => {
      const wood = '#8a5a3a';
      for (const [u, v] of [[3, 3], [27, 3], [3, 11], [27, 11]] as [number, number][]) p.box(u, v, 0, 2, 2, 8, shade(wood, -0.2));
      p.box(2, 2, 8, 28, 12, 6, wood);
      p.top(3, 3, 26, 10, 14, '#3fae6a');
      p.line3([16, 3, 14], [16, 13, 14], '#e8f5e8');
      p.blob(16, 8, 14, 2, 1, '#3fae6a');
      for (let i = 0; i < 6; i++) {
        const u = 5 + i * 4.4;
        const team = i % 2 ? '#d64545' : '#3b6fd6';
        p.line3([u, 0, 16], [u, 16, 16], '#c8ccd8');
        for (let k = 1; k <= 3; k++) p.box(u - 0.6, k * 3.2, 14, 1.2, 1.2, 3, team, false);
      }
      p.dot(14, 8, 14.5, '#ffffff', 2);
    },
  },
  jukebox: {
    h: 36,
    draw: (p) => {
      const body = { top: '#a03040', left: '#7a1f2b', right: '#5a1620' };
      p.box(3, 4, 0, 10, 8, 26, body);
      p.blob(8, 8, 27, 5.4, 4, '#a03040');
      p.faceV(4, 12, 14, 8, 10, '#f2b134');
      p.faceV(4.8, 12, 15, 6.4, 8, '#fff1b8');
      for (let k = 0; k < 4; k++) p.faceV(5.2, 12, 16 + k * 1.8, 5.6, 0.6, '#c9a24a');
      p.faceV(3.5, 12, 3, 1, 22, '#ff6fb0');
      p.faceV(11.5, 12, 3, 1, 22, '#5ff2ff');
      p.faceV(5, 12, 4, 6, 6, '#3a1018');
      for (let u = 5.5; u < 11; u += 1.2) p.line3([u, 12, 4.5], [u, 12, 9.5], '#5a1620');
    },
  },
  ping_pong: {
    h: 20,
    draw: (p) => {
      for (const [u, v] of [[5, 6], [26, 6], [5, 26], [26, 26]] as [number, number][]) p.box(u, v, 0, 1.5, 1.5, 9, METAL);
      p.box(2, 3, 9, 28, 26, 1.5, '#1f5fa8');
      p.line3([2.5, 3.5, 10.6], [29.5, 3.5, 10.6], '#f4f2ec');
      p.line3([2.5, 28.5, 10.6], [29.5, 28.5, 10.6], '#f4f2ec');
      p.line3([2.5, 16, 10.6], [29.5, 16, 10.6], '#f4f2ec');
      p.faceU(16, 2, 10.5, 28, 3, '#e8e4da');
      p.line3([16, 2, 13.5], [16, 30, 13.5], '#f4f2ec');
      p.blob(7, 10, 11, 2, 1.4, '#d64545');
      p.blob(25, 22, 11, 2, 1.4, '#d64545');
      p.dot(20, 12, 15, '#ffffff', 2);
    },
  },
  mesa_pool: {
    h: 20,
    draw: (p) => {
      const wood = { top: '#7a5238', left: '#6b4430', right: '#4a2f20' };
      p.box(5, 7, 0, 22, 18, 8, '#4a2f20');
      p.box(2, 4, 8, 28, 24, 3, wood);
      p.top(3.5, 5.5, 25, 21, 11, '#2f8a4a');
      for (const [u, v] of [[4, 6], [16, 6], [28, 6], [4, 26], [16, 26], [28, 26]] as [number, number][]) p.dot(u, v, 11, '#111218', 2);
      const balls = ['#f2c134', '#3b6fd6', '#d64545', '#8e5bd6', '#f07f3c', '#2fa66a', '#111218'];
      balls.forEach((c, i) => p.dot(20 + (i % 3) * 1.6, 14 + Math.floor(i / 3) * 1.6, 11.5, c, 2));
      p.dot(9, 18, 11.5, '#ffffff', 2);
      p.line3([4, 22, 12], [15, 16, 12.5], '#d9b77a');
    },
  },
  // --- Legendarios nuevos ----------------------------------------------------
  unicornio: {
    h: 42,
    draw: (p) => {
      const gold = { top: '#ffe28a', left: '#f2c134', right: '#c9962a' };
      p.box(1, 3, 0, 14, 10, 4, { top: '#5a4636', left: '#4a3a2e', right: '#3a2d24' });
      p.faceV(5, 13, 1, 6, 1.5, '#c9a24a');
      // Patas (las de atrás un poco más oscuras), cuerpo horizontal a lo largo de u.
      for (const [u, v] of [[3.5, 5.5], [3.5, 9.5], [10.5, 5.5], [10.5, 9.5]] as [number, number][]) {
        p.box(u, v, 4, 1.6, 1.6, 9, v < 7 ? { top: '#ffe28a', left: '#c9962a', right: '#a07a20' } : gold);
      }
      p.box(2.5, 5.5, 12, 11, 5.5, 5.5, gold);
      p.top(3.5, 6, 9, 3, 17.6, '#ffe89a');
      // Cuello inclinado hacia adelante (+u) y cabeza.
      p.box(11.5, 6.5, 16, 3, 3.5, 4, gold);
      p.box(12.5, 6.5, 19.5, 3, 3.5, 4, gold);
      p.box(13, 6.2, 22.5, 5, 4, 3.5, gold);
      p.box(17, 6.8, 22.5, 1.8, 2.8, 2.4, gold);
      p.dot(15, 10.2, 24.5, '#1b1626', 2);
      // Cuerno espiral.
      p.line3([14.5, 8, 26], [16.5, 8, 33], '#fff1b8');
      p.line3([15, 8, 26], [17, 8, 32.5], '#c9962a');
      // Crin y cola arcoíris.
      for (const [u, z, c] of [[12, 25, '#e86fa8'], [11.3, 22, '#8e5bd6'], [10.8, 19, '#5ff2ff']] as [number, number, string][]) p.blob(u, 6.2, z, 1.4, 1.6, c);
      for (const [u, z, c] of [[2, 16, '#e86fa8'], [1.4, 13.5, '#f2b134'], [1.2, 11, '#5ff2ff']] as [number, number, string][]) p.blob(u, 8, z, 1.4, 1.8, c);
    },
  },
  dragon: {
    h: 48,
    draw: (p) => {
      const jade = '#3fae6a';
      const dark = '#2c7a4a';
      p.box(3, 3, 0, 26, 26, 4, { top: '#5a4636', left: '#4a3a2e', right: '#3a2d24' });
      p.faceV(11, 29, 1, 10, 2, '#c9a24a');
      const steps = 22;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * Math.PI * 3.2;
        const r = 9 - t * 5;
        const u = 16 + Math.cos(a) * r;
        const v = 16 + Math.sin(a) * r;
        const z = 7 + t * 24;
        const size = 4 - t * 1.6;
        p.blob(u, v, z, size, size * 0.8, i % 2 ? jade : dark);
        if (i % 3 === 0) p.dot(u, v, z + size * 0.7, '#c9a24a', 2);
      }
      p.box(18, 17, 32, 6, 5, 5, { top: '#6fd68f', left: jade, right: dark });
      p.box(23, 18, 32, 3, 3, 3, jade);
      p.line3([19, 17, 37], [17, 15, 42], '#c9a24a');
      p.line3([22, 17, 37], [23, 15, 42], '#c9a24a');
      p.dot(21, 22, 35.5, '#ff3b3b', 2);
      p.line3([26, 21, 33], [30, 24, 31], '#c9a24a');
      p.line3([26, 19, 33], [30, 18, 30], '#c9a24a');
    },
  },
  portal: {
    h: 46,
    draw: (p) => {
      p.box(1, 4, 0, 14, 8, 4, { top: '#4a4d5a', left: '#3a3d48', right: '#2a2c35' });
      p.blob(8, 8, 24, 6.2, 15, '#2a1a5a');
      p.blob(8, 8, 24, 5, 12.5, '#6b3fd6');
      p.blob(8, 8, 24, 3.6, 9, '#9b7fff');
      p.blob(8, 8, 24, 2, 5, '#d0c4ff');
      p.blob(8, 8, 24, 0.8, 2, '#ffffff');
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        p.box(8 + Math.cos(a) * 7 - 1, 7, 24 + Math.sin(a) * 17 - 1, 2, 2, 2, { top: '#8a8fa0', left: '#6b7080', right: '#4a4d5a' }, false);
      }
      for (const [u, z] of [[5, 30], [10, 18], [9, 33], [6, 16]] as [number, number][]) p.dot(u, 8, z, '#ffffff');
    },
  },
  rack: {
    h: 40,
    draw: (p) => {
      p.box(2, 2, 0, 12, 12, 36, '#1c1d24');
      p.faceV(2.8, 14, 1, 10.4, 34, '#111218');
      for (let k = 0; k < 8; k++) {
        const z = 2.5 + k * 4.2;
        p.faceV(3.3, 14, z, 9.4, 3.2, '#2c2e38');
        p.faceV(3.8, 14, z + 1, 5, 0.8, '#3c3f4a');
        p.dot(10, 14, z + 2, k % 2 ? '#5fd46a' : '#5ff2ff');
        p.dot(11.3, 14, z + 2, k % 3 ? '#5fd46a' : '#f2c134');
      }
      p.faceU(14, 2.8, 1, 10.4, 34, '#16171d');
    },
  },
};

export function itemHeight(itemId: string): number {
  return DRAWERS[itemId]?.h ?? 20;
}

/** Dibuja el objeto con rotación 0; la rotación 1 es su espejo. */
export function paintItem(itemId: string): PixelCanvas {
  const def = ITEM_BY_ID[itemId];
  const drawer = DRAWERS[itemId];
  const p = new IsoPainter(def.w, def.d, drawer.h);
  drawer.draw(p);
  p.pc.outline();
  return p.pc;
}

/** Origen del sprite (fracciones) para que la esquina superior de la huella caiga en el punto dado. */
export function itemOrigin(itemId: string, rot: 0 | 1): { ox: number; oy: number } {
  const def = ITEM_BY_ID[itemId];
  const h = itemHeight(itemId);
  const w = (def.w + def.d) * 16;
  const height = (def.w + def.d) * 8 + h;
  const depthTiles = rot === 0 ? def.d : def.w;
  return { ox: (depthTiles * 16) / w, oy: h / height };
}

export { faces };
