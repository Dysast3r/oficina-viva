import * as Phaser from 'phaser';
import { depthOf, project } from '../iso';
import { ART_SCALE } from '../pixel/IsoPainter';
import { petKey, type PetFrame, type PetKind } from '../pixel/pets';
import { UI_FONT, crispText } from '../text';
import type { Point } from '../world/pathfinding';

const INV = 1 / ART_SCALE;

type PetMode = 'walk' | 'stand' | 'sit' | 'lie';

/**
 * Mascota de la oficina. Igual que los colaboradores, (fx, fy) son baldosas
 * continuas; la escena decide adónde va y qué hace (OfficeScene.petThink).
 */
export class PetSprite {
  readonly body: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  fx: number;
  fy: number;
  mode: PetMode = 'stand';
  timer = 0;
  /** Corre más rápido un rato (los "cinco minutos de locura" de la gata). */
  dash = false;
  private path: Point[] = [];
  private onArrive: (() => void) | null = null;
  private clock = Math.random() * 10_000;
  private flip = false;
  private hopAt = -1;

  constructor(
    private scene: Phaser.Scene,
    readonly kind: PetKind,
    readonly name: string,
    tx: number,
    ty: number,
  ) {
    this.fx = tx + 0.5;
    this.fy = ty + 0.5;
    this.shadow = scene.add.image(0, 0, 'shadow').setOrigin(0.5, 0.5).setScale(INV * (kind === 'dog' ? 0.75 : 0.6));
    this.body = scene.add.image(0, 0, petKey(kind, 'stand0')).setOrigin(0.5, 1).setScale(INV);
    this.body.setInteractive({ useHandCursor: true });
    this.label = crispText(scene, 0, 0, `${kind === 'dog' ? '🐶' : '🐱'} ${name}`, {
      fontFamily: UI_FONT,
      fontSize: '4.5px',
      fontStyle: '800',
      color: '#fff4dc',
      backgroundColor: '#3a2a1ccc',
      padding: { x: 2, y: 1 },
    })
      .setOrigin(0.5, 1)
      .setAlpha(0);
    // El nombre aparece al pasar el mouse.
    this.body.on('pointerover', () => this.label.setAlpha(1));
    this.body.on('pointerout', () => this.label.setAlpha(0));
    this.sync();
  }

  get tile(): Point {
    return { x: Math.floor(this.fx), y: Math.floor(this.fy) };
  }

  walk(path: Point[], onArrive: () => void): void {
    this.path = path;
    this.onArrive = onArrive;
    this.mode = path.length > 0 ? 'walk' : 'stand';
    if (path.length === 0) onArrive();
  }

  rest(mode: 'stand' | 'sit' | 'lie', ms: number): void {
    this.mode = mode;
    this.timer = ms;
    this.dash = false;
  }

  /** Burbuja de emoji que sube y se desvanece (ladrido, maullido, corazones…). */
  emote(text: string): void {
    const p = project(this.fx, this.fy);
    const t = crispText(this.scene, p.x, p.y - (this.kind === 'dog' ? 15 : 12), text, { fontSize: '7px', fontFamily: 'sans-serif' })
      .setOrigin(0.5, 1)
      .setDepth(1_100_000);
    this.scene.tweens.add({ targets: t, y: t.y - 10, alpha: { from: 1, to: 0 }, duration: 1800, ease: 'Quad.Out', onComplete: () => t.destroy() });
  }

  hop(): void {
    this.hopAt = this.clock;
  }

  tick(dt: number): void {
    this.clock += dt;
    if (this.mode === 'walk') {
      const next = this.path[0];
      if (next === undefined) {
        this.mode = 'stand';
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      } else {
        const tx = next.x + 0.5;
        const ty = next.y + 0.5;
        const dx = tx - this.fx;
        const dy = ty - this.fy;
        const dist = Math.hypot(dx, dy);
        const speed = (this.kind === 'dog' ? 2.6 : 1.9) * (this.dash ? 2.2 : 1);
        const step = (speed * dt) / 1000;
        // En pantalla, +x va abajo-derecha y +y abajo-izquierda.
        const sx = dx - dy;
        if (Math.abs(sx) > 0.01) this.flip = sx < 0;
        if (dist <= step) {
          this.fx = tx;
          this.fy = ty;
          this.path.shift();
        } else {
          this.fx += (dx / dist) * step;
          this.fy += (dy / dist) * step;
        }
      }
    } else {
      this.timer -= dt;
    }
    this.applyFrame();
    this.sync();
  }

  private applyFrame(): void {
    let frame: PetFrame;
    if (this.mode === 'walk') frame = `walk${Math.floor(this.clock / (this.dash ? 70 : 120)) % 4}` as PetFrame;
    else if (this.mode === 'sit') frame = 'sit';
    else if (this.mode === 'lie') frame = Math.floor(this.clock / 900) % 2 ? 'lie1' : 'lie0';
    else {
      // De pie: el perro mueve la cola rápido; la gata, lento.
      const wag = this.kind === 'dog' ? 220 : 900;
      frame = Math.floor(this.clock / wag) % 2 ? 'stand1' : 'stand0';
    }
    const key = petKey(this.kind, frame);
    if (this.body.texture.key !== key) this.body.setTexture(key);
    this.body.setFlipX(this.flip);
  }

  private sync(): void {
    const p = project(this.fx, this.fy);
    let lift = 0;
    if (this.hopAt >= 0) {
      const t = (this.clock - this.hopAt) / 380;
      if (t >= 1) this.hopAt = -1;
      else lift = Math.sin(t * Math.PI) * 4;
    }
    const x = Math.round(p.x * ART_SCALE) / ART_SCALE;
    const y = Math.round(p.y * ART_SCALE) / ART_SCALE;
    this.body.setPosition(x, y - lift);
    this.shadow.setPosition(x, y);
    const d = depthOf(this.fx, this.fy, 4);
    this.shadow.setDepth(d - 0.5);
    this.body.setDepth(d);
    this.label.setPosition(x, y - (this.kind === 'dog' ? 14 : 11)).setDepth(1_000_000 + d);
  }

  destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
    this.label.destroy();
  }
}
