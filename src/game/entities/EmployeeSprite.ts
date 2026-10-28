import * as Phaser from 'phaser';
import type { Avatar, Employee } from '../../data/types';
import { depthOf, project } from '../iso';
import type { Pose } from '../pixel/characters';
import { ART_SCALE } from '../pixel/IsoPainter';
import { charKey, ensureAvatar, headKey } from '../pixel/textures';
import { UI_FONT, crispText } from '../text';
import type { Point } from '../world/pathfinding';

export interface Seat {
  x: number;
  y: number;
  /** Hacia dónde mira sentado: 'v' = +v (abajo-izquierda), 'u' = +u (abajo-derecha). */
  facing: 'u' | 'v';
}

type Mode = 'sit' | 'idle' | 'walk';
/** Gestos: saludar, estirarse y tomar café (de pie); teléfono (sentado). */
export type Gesture = 'wave' | 'stretch' | 'drink' | 'phone';

const SPEED = 2.4; // baldosas por segundo
const WALK_FRAME_MS = 115;
const BREATH_MS = 750;
const INV = 1 / ART_SCALE;
/** Cuánto sube el sprite al sentarse (px de mundo). */
const SIT_LIFT = 2;

interface Bubble {
  box: Phaser.GameObjects.Container;
  /** Altura en px de mundo, para apilar. */
  h: number;
  born: number;
}

/**
 * Un colaborador en el mundo. (fx, fy) son baldosas continuas: el centro de
 * la baldosa (3, 4) es (3.5, 4.5).
 */
export class EmployeeSprite {
  readonly body: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  private bubbles: Bubble[] = [];

  fx = 0;
  fy = 0;
  mode: Mode = 'idle';
  /** Milisegundos que quedan en el modo actual antes de decidir otra cosa. */
  timer = 0;
  private path: Point[] = [];
  private onArrive: (() => void) | null = null;
  private avatar: Avatar;
  private back = false;
  private flip = false;
  private clock = Math.random() * 10_000;
  private walkClock = 0;
  private seatFacing: Seat['facing'] = 'v';
  private nextBlink = 1500 + Math.random() * 3000;
  private blinkUntil = 0;
  /** Ráfagas de tecleo mientras está sentado. */
  private typingUntil = 0;
  private nextTyping = 0;
  private gestureKind: Gesture | null = null;
  private gestureUntil = 0;
  private nextSteam = 0;
  /** Saltito de alegría: momento en que empezó (−1 = nada). */
  private hopAt = -1;

  constructor(
    private scene: Phaser.Scene,
    public employee: Employee,
    tx: number,
    ty: number,
    private isMe: boolean,
  ) {
    this.avatar = employee.avatar;
    ensureAvatar(scene, this.avatar);
    this.fx = tx + 0.5;
    this.fy = ty + 0.5;
    this.shadow = scene.add.image(0, 0, 'shadow').setOrigin(0.5, 0.5).setScale(INV);
    this.body = scene.add.image(0, 0, charKey(this.avatar, 'front0')).setOrigin(0.5, 1).setScale(INV);
    this.body.setInteractive({ useHandCursor: true });
    this.label = crispText(scene, 0, 0, '', {
      fontFamily: UI_FONT,
      fontSize: '5.5px',
      fontStyle: '800',
      color: '#ffffff',
      backgroundColor: '#1b1d26d9',
      padding: { x: 3, y: 1.2 },
    }).setOrigin(0.5, 1);
    this.setMe(isMe);
    this.sync();
  }

  setMe(isMe: boolean): void {
    this.isMe = isMe;
    const first = this.employee.name.split(' ')[0];
    const crown = this.employee.role === 'gerente' || this.employee.role === 'jefatura' ? '👑 ' : this.employee.role === 'admin' ? '🛡️ ' : '';
    this.label.setText(`${isMe ? '★ ' : crown}${first}`);
    this.label.setColor(isMe ? '#ffd25a' : '#ffffff');
  }

  /** Conectado o no: quien no está en línea se ve con el nombre atenuado. */
  setOnline(online: boolean): void {
    this.label.setAlpha(online || this.isMe ? 1 : 0.55);
  }

  update(employee: Employee): void {
    const roleChanged = employee.role !== this.employee.role || employee.name !== this.employee.name;
    this.employee = employee;
    if (roleChanged) this.setMe(this.isMe);
    if (employee.avatar !== this.avatar) {
      const changed = JSON.stringify(employee.avatar) !== JSON.stringify(this.avatar);
      this.avatar = employee.avatar;
      ensureAvatar(this.scene, this.avatar);
      this.applyPose();
      if (changed) this.poof();
    }
  }

  /** Cambio de look: rebote y destellos, como al probarse ropa nueva. */
  private poof(): void {
    const scene = this.scene;
    this.body.setScale(INV * 1.2, INV * 0.8);
    scene.tweens.add({ targets: this.body, scaleX: INV, scaleY: INV, duration: 500, ease: 'Elastic.Out' });
    const p = this.feet();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const s = scene.add.image(p.x, p.y - 16, 'spark').setDepth(1_200_000).setScale(0.5);
      scene.tweens.add({
        targets: s,
        x: p.x + Math.cos(a) * 14,
        y: p.y - 16 + Math.sin(a) * 12,
        alpha: 0,
        scale: 0.9,
        duration: 650,
        ease: 'Quad.Out',
        onComplete: () => s.destroy(),
      });
    }
  }

  /** Hace un gesto por `ms` milisegundos (si el modo lo permite: de pie o sentado). */
  gesture(kind: Gesture, ms: number): void {
    this.gestureKind = kind;
    this.gestureUntil = this.clock + ms;
    // De frente para que se vea el gesto.
    if (kind !== 'phone') this.back = false;
    this.applyPose();
  }

  /** ¿Está haciendo ese gesto ahora? */
  doing(kind: Gesture): boolean {
    return this.gestureKind === kind && this.clock < this.gestureUntil;
  }

  /** Saltito de alegría (al recibir monedas o un reconocimiento). */
  hop(): void {
    this.hopAt = this.clock;
  }

  /** Se pone de pie en el lugar donde estaba sentado. */
  standUp(ms: number): void {
    this.mode = 'idle';
    this.timer = ms;
    this.applyPose();
  }

  get tile(): Point {
    return { x: Math.floor(this.fx), y: Math.floor(this.fy) };
  }

  walk(path: Point[], onArrive: () => void): void {
    this.path = path;
    this.onArrive = onArrive;
    this.mode = path.length > 0 ? 'walk' : 'idle';
    if (path.length === 0) onArrive();
  }

  sitAt(seat: Seat, ms: number): void {
    this.fx = seat.x + 0.5;
    this.fy = seat.y + 0.5;
    this.mode = 'sit';
    this.seatFacing = seat.facing;
    this.timer = ms;
    this.path = [];
    this.nextTyping = this.clock + 400 + Math.random() * 1500;
    this.applyPose();
    this.sync();
  }

  idle(ms: number): void {
    this.mode = 'idle';
    this.timer = ms;
    this.applyPose();
  }

  tick(dt: number): void {
    this.clock += dt;
    if (this.mode === 'walk') {
      const next = this.path[0];
      if (next === undefined) {
        this.mode = 'idle';
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      } else {
        const tx = next.x + 0.5;
        const ty = next.y + 0.5;
        const dx = tx - this.fx;
        const dy = ty - this.fy;
        const dist = Math.hypot(dx, dy);
        const step = (SPEED * dt) / 1000;
        if (Math.abs(dx) > Math.abs(dy)) {
          this.back = dx < 0;
          this.flip = dx < 0;
        } else if (dy !== 0) {
          this.back = dy < 0;
          this.flip = dy > 0;
        }
        if (dist <= step) {
          this.fx = tx;
          this.fy = ty;
          this.path.shift();
        } else {
          this.fx += (dx / dist) * step;
          this.fy += (dy / dist) * step;
        }
        this.walkClock += dt;
      }
    } else {
      this.timer -= dt;
    }
    // Parpadeo cada pocos segundos.
    if (this.clock > this.nextBlink) {
      this.blinkUntil = this.clock + 130;
      this.nextBlink = this.clock + 2200 + Math.random() * 3500;
    }
    // Teclear a ratos cuando está sentado.
    if (this.mode === 'sit' && this.clock > this.nextTyping) {
      this.typingUntil = this.clock + 1500 + Math.random() * 3000;
      this.nextTyping = this.typingUntil + 800 + Math.random() * 2500;
    }
    if (this.gestureKind !== null && this.clock >= this.gestureUntil) this.gestureKind = null;
    if (this.doing('drink') && this.mode === 'idle' && this.clock > this.nextSteam) {
      this.nextSteam = this.clock + 650;
      this.steam();
    }
    this.applyPose();
    this.sync();
    this.ageBubbles();
  }

  /** Vapor que sube de la taza de café. */
  private steam(): void {
    const p = this.feet();
    const side = this.body.flipX ? 1 : -1;
    const s = this.scene.add
      .image(p.x + side * 1.2, p.y - 22, 'spark')
      .setTint(0xffffff)
      .setAlpha(0.55)
      .setScale(0.25)
      .setDepth(this.body.depth + 0.1);
    this.scene.tweens.add({ targets: s, y: s.y - 7, x: s.x + (Math.random() - 0.5) * 3, alpha: 0, scale: 0.45, duration: 1100, onComplete: () => s.destroy() });
  }

  private applyPose(): void {
    const blink = this.clock < this.blinkUntil;
    const breathe = Math.floor(this.clock / BREATH_MS) % 2 === 1;
    let pose: Pose;
    const g = this.gestureKind;
    if (g === 'phone' && this.mode === 'sit') {
      pose = 'sit_phone';
      this.body.setFlipX(this.seatFacing === 'v');
    } else if (g !== null && g !== 'phone' && this.mode === 'idle') {
      pose = g === 'wave' ? (Math.floor(this.clock / 180) % 2 ? 'wave1' : 'wave0') : g;
      this.body.setFlipX(this.flip);
    } else if (this.mode === 'sit') {
      const typing = this.clock < this.typingUntil;
      pose = blink ? 'sit_blink' : typing ? (Math.floor(this.clock / 140) % 2 ? 'sit_type0' : 'sit_type1') : breathe ? 'sit1' : 'sit0';
      this.body.setFlipX(this.seatFacing === 'v');
    } else if (this.mode === 'walk') {
      const frame = Math.floor(this.walkClock / WALK_FRAME_MS) % 4;
      pose = `${this.back ? 'bwalk' : 'fwalk'}${frame}` as Pose;
      this.body.setFlipX(this.flip);
    } else {
      pose = this.back ? (breathe ? 'back1' : 'back0') : blink ? 'front_blink' : breathe ? 'front1' : 'front0';
      this.body.setFlipX(this.flip);
    }
    const key = charKey(this.avatar, pose);
    if (this.body.texture.key !== key) this.body.setTexture(key);
  }

  /** Punto de pantalla de los pies, redondeado a medio píxel (el arte es 2×). */
  private feet(): { x: number; y: number } {
    const p = project(this.fx, this.fy);
    return { x: Math.round(p.x * ART_SCALE) / ART_SCALE, y: Math.round(p.y * ART_SCALE) / ART_SCALE };
  }

  private sync(): void {
    const p = this.feet();
    let lift = this.mode === 'sit' ? SIT_LIFT : 0;
    if (this.hopAt >= 0) {
      const t = (this.clock - this.hopAt) / 420;
      if (t >= 1) this.hopAt = -1;
      else lift += Math.sin(t * Math.PI) * 5;
    }
    this.body.setPosition(p.x, p.y - lift);
    this.shadow.setPosition(p.x, p.y).setVisible(this.mode !== 'sit');
    const d = depthOf(this.fx, this.fy, 5);
    this.shadow.setDepth(d - 0.5);
    this.body.setDepth(d);
    // Con sombrero el nombre sube un poco para no taparlo.
    const headTop = p.y - lift - (this.avatar.hat ? 35 : 31);
    this.label.setPosition(p.x, headTop).setDepth(1_000_000 + d);
    let y = headTop - 8;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.box.setPosition(p.x, y);
      b.box.setDepth(1_100_000 + d);
      y -= b.h + 2;
    }
  }

  /**
   * Globo de diálogo estilo Habbo: blanco, borde oscuro, cabecita del que
   * habla, nombre en negrita y colita hacia abajo. Si `text` es un solo
   * emoji se dibuja como globo redondo de emoticón.
   */
  say(raw: string, ms = 4200): void {
    const scene = this.scene;
    // En el mundo solo cabe una línea; el mensaje completo queda en el chat.
    const text = raw.length > 60 ? `${raw.slice(0, 57).trimEnd()}…` : raw;
    const onlyEmoji = /^\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*$/u.test(text.trim());
    const box = scene.add.container(0, 0);
    const pad = 3;
    let w: number;
    let h: number;
    const g = scene.add.graphics();
    if (onlyEmoji) {
      const t = crispText(scene, 0, -7.5, text, { fontSize: '8px', fontFamily: 'sans-serif' }).setOrigin(0.5, 0.5);
      w = 15;
      h = 13;
      g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 1, -h + 0.5, w, h - 2, 6);
      g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h, w, h - 2, 6);
      g.lineStyle(0.8, 0x1b1d26, 1).strokeRoundedRect(-w / 2, -h, w, h - 2, 6);
      box.add([g, t]);
    } else {
      const name = crispText(scene, 0, 0, `${this.employee.name.split(' ')[0]}:`, {
        fontFamily: UI_FONT,
        fontSize: '5.5px',
        fontStyle: '900',
        color: '#1b1d26',
      }).setOrigin(0, 0.5);
      const msg = crispText(scene, 0, 0, text, {
        fontFamily: UI_FONT,
        fontSize: '5.5px',
        fontStyle: '600',
        color: '#1b1d26',
      }).setOrigin(0, 0.5);
      const head = scene.add.image(0, 0, headKey(this.avatar)).setScale(0.2).setOrigin(0.5, 0.5);
      const headW = 8;
      const inner = headW + 2 + name.width + 2 + msg.width;
      w = inner + pad * 2;
      h = 11;
      const left = -w / 2;
      const cy = -h / 2 - 2;
      g.fillStyle(0x000000, 0.25).fillRoundedRect(left + 1, -h - 1, w, h - 2, 3);
      g.fillStyle(0xffffff, 1).fillRoundedRect(left, -h - 2, w, h - 2, 3);
      g.lineStyle(0.8, 0x1b1d26, 1).strokeRoundedRect(left, -h - 2, w, h - 2, 3);
      // Franja de la cabeza (como el avatar a la izquierda en Habbo).
      g.fillStyle(0xe9ecf5, 1).fillRect(left + 0.8, -h - 1.2, headW + 2, h - 3.6);
      g.lineStyle(0.6, 0xc8ccd8, 1).lineBetween(left + headW + 2.8, -h - 1, left + headW + 2.8, -4.2);
      head.setPosition(left + pad + headW / 2 - 1, cy - 0.5);
      name.setPosition(left + pad + headW + 2, cy);
      msg.setPosition(name.x + name.width + 2, cy);
      box.add([g, head, name, msg]);
    }
    // Colita.
    g.fillStyle(0xffffff, 1).fillTriangle(-2.5, -3.2, 2.5, -3.2, 0, 0.5);
    g.lineStyle(0.8, 0x1b1d26, 1).lineBetween(-2.5, -2.8, 0, 0.5).lineBetween(0, 0.5, 2.5, -2.8);
    const bubble: Bubble = { box, h, born: this.clock };
    this.bubbles.push(bubble);
    if (this.bubbles.length > 3) this.dropBubble(this.bubbles[0]);
    box.setScale(0.6).setAlpha(0);
    scene.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    scene.time.delayedCall(ms, () => this.dropBubble(bubble));
    this.sync();
  }

  private dropBubble(b: Bubble): void {
    const i = this.bubbles.indexOf(b);
    if (i < 0) return;
    this.bubbles.splice(i, 1);
    this.scene.tweens.add({ targets: b.box, alpha: 0, y: b.box.y - 6, duration: 300, onComplete: () => b.box.destroy() });
  }

  /** Los globos suben despacio mientras viven, como el chat de Habbo. */
  private ageBubbles(): void {
    for (const b of this.bubbles) {
      const age = (this.clock - b.born) / 1000;
      b.box.y -= Math.min(age, 4) * 0.8;
    }
  }

  destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
    this.label.destroy();
    for (const b of this.bubbles) b.box.destroy();
  }
}
