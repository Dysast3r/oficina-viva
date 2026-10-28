import * as Phaser from 'phaser';
import { bridge } from '../../bridge';
import { COSMETIC_BY_ID, ITEM_BY_ID, ROOMS } from '../../data/catalog';
import {
  EXPANSIONS,
  MAP_H,
  MAP_W,
  ROOM_BY_ID,
  activeRooms,
  activeStaticItems,
  canCross,
  footprint,
  getBuiltLevel,
  hasDoor,
  inRect,
  layoutProblems,
  plotRect,
  roomAt,
  setBuiltLevel,
  type Rect,
} from '../../data/layout';
import { ACHIEVEMENTS } from '../../data/progress';
import { TIME_ZONE, isLunchTime, isOnBreak, isWorkTime, officeClock } from '../../data/schedule';
import { getWeather } from '../../data/sky';
import { dayPhase, skyOf, sunTimes, type DayPhase, type Sky } from '../../data/weather';
import {
  activeMeetingFor,
  announceDecor,
  canPlace,
  getState,
  moveItem,
  officeFund,
  placeFromInventory,
  storeItem,
  subscribe,
} from '../../data/store';
import type { Employee, GameState, Meeting, PlacedItem, RoomId, Rot } from '../../data/types';
import { EmployeeSprite, type Seat } from '../entities/EmployeeSprite';
import { PetSprite } from '../entities/PetSprite';
import { depthOf, project, screenToTile, tileTop } from '../iso';
import { itemOrigin } from '../pixel/furniture';
import { ART_SCALE } from '../pixel/IsoPainter';
import { SIGN_RES, WALL_GLASS, WALL_TALL, buildSign, buildWorldTextures, floorKey, itemKey, wallKey } from '../pixel/textures';
import { L, intlLocale } from '../../i18n';
import { NUM_FONT, crispText } from '../text';
import { findPath, type Point } from '../world/pathfinding';

const INV = 1 / ART_SCALE;

/** Lugar asignado cuando el grupo se junta (reunión o colación): silla o de pie. */
type Spot = Seat & { seat: boolean };

/** Adónde va en su pausa: al casino (café), a visitar a alguien o a pasear por una sala. */
type Destination = Point & { kind: 'casino' | 'visit' | 'room'; with?: string };

/** Frases que dicen los colaboradores mientras trabajan (globos estilo Habbo). */
const CHATTER = L(
  [
    '¡Cotización enviada! 📄', '¿Alguien quiere café? ☕', 'Cerrando una venta 💼', 'Llamando al cliente 📞',
    '¡Meta cada vez más cerca! 🎯', 'Revisando las OC 📋', 'Buen día equipo 👋', '¡Vamos que se puede! 💪',
    'Reunión en 5 min ⏰', 'Excelente trabajo 👏',
  ],
  [
    'Quote sent! 📄', 'Anyone want coffee? ☕', 'Closing a sale 💼', 'Calling the client 📞',
    'Goal getting closer! 🎯', 'Checking the POs 📋', 'Morning, team 👋', 'We can do this! 💪',
    'Meeting in 5 min ⏰', 'Great work 👏',
  ],
);
const LUNCH_TALK = L(
  ['🍽️', '🥗', '🍲', '😋', '¡Qué rico! 😋', '¿Me pasas la sal? 🧂', '¿Postre? 🍮', '☕', '¡Buen provecho!'],
  ['🍽️', '🥗', '🍲', '😋', 'Delicious! 😋', 'Pass the salt? 🧂', 'Dessert? 🍮', '☕', 'Enjoy your meal!'],
);
const EMOTES = ['☕', '💡', '📊', '📞', '✉️', '🤝', '📈', '💻', '🎯', '💼', '😄', '🔥'];

const LEGENDARY = new Set([
  'bola_disco', 'trono', 'cofre', 'piano', 'robot', 'fuente', 'cohete', 'trex', 'estatua', 'unicornio', 'dragon', 'portal',
]);
/** Tono (MULTIPLY) y fuerza de la luz en cada momento del día. */
const PHASE_LIGHT: Record<DayPhase, [number, number]> = {
  night: [0x2a3a70, 0.5],
  dawn: [0xf2b6cf, 0.22],
  day: [0xffffff, 0],
  golden: [0xffb064, 0.26],
  dusk: [0x8a6ab8, 0.38],
};
/** Tono del cielo según el clima: más gris y oscuro mientras peor está. */
const SKY_LIGHT: Record<Sky, [number, number]> = {
  clear: [0xffffff, 0],
  cloudy: [0xa4adbd, 0.14],
  fog: [0xc9ced8, 0.22],
  drizzle: [0x8f9bb0, 0.22],
  rain: [0x7a88a0, 0.3],
  storm: [0x5a6480, 0.42],
  snow: [0xbac6da, 0.16],
};
const FLOWERS = new Set(['girasoles', 'lavanda', 'orquidea', 'jardinera']);
const DESKS = new Set(['escritorio', 'escritorio_pro', 'escritorio_pie', 'meson_recepcion']);
/** Salas que son ampliaciones: sus muros son vidrio (la terraza es al aire libre). */
const EXPANSION_ROOMS = new Set(EXPANSIONS.map((x) => x.room.id));

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export class OfficeScene extends Phaser.Scene {
  /** Baldosas de piso de las salas construidas, por "x,y". */
  private floorTiles = new Map<string, Phaser.GameObjects.Image>();
  /** Quiénes están conectados (para atenuar a los demás). */
  private online = new Set<string>();
  /** Uids ya vistos en cada puesto: lo nuevo aparece con animación. */
  private knownUids = new Map<string, Set<string>>();
  /** Letrero de la obra de la próxima ampliación. */
  private construction: { label: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics; x: number; y: number } | null = null;
  private meetingSign: Phaser.GameObjects.GameObject[] = [];
  /** Luz del momento del día (amanecer, hora dorada, noche…). */
  private night: Phaser.GameObjects.Rectangle | null = null;
  /** Tono del clima (nublado, lluvia) sobre la luz del día. */
  private overcast: Phaser.GameObjects.Rectangle | null = null;
  /** Gotas o copos en coordenadas normalizadas de la vista (0..1). */
  private precip: { img: Phaser.GameObjects.Image; u: number; v: number; speed: number; drift: number }[] = [];
  private lightning: Phaser.Time.TimerEvent | null = null;
  /** Objetos de cada puesto (muebles y sus luces), para rehacerlos al cambiar. */
  private plotSprites = new Map<string, Phaser.GameObjects.GameObject[]>();
  private plotItemSprites = new Map<string, Map<string, Phaser.GameObjects.Image>>();
  private sprites = new Map<string, EmployeeSprite>();
  private blocked = new Set<string>();
  private staticBlocked = new Set<string>();
  private lastState: GameState | null = null;
  private hover!: Phaser.GameObjects.Image;
  private unsubs: (() => void)[] = [];
  /** Objetos con efecto continuo (legendarios, bola disco). */
  private sparkly: { img: Phaser.GameObjects.Image; itemId: string }[] = [];
  /** Plantas a la vista: se mecen y de vez en cuando sueltan una hoja o atraen una mariposa. */
  private plants: { img: Phaser.GameObjects.Image; itemId: string }[] = [];
  private discoLights: Phaser.GameObjects.Image[] = [];

  // Cámara: zoom suavizado e inercia al arrastrar.
  private targetZoom = 2;
  private zoomAnchor: { x: number; y: number } | null = null;
  private velocity = { x: 0, y: 0 };
  private dragStart: { x: number; y: number } | null = null;
  private dragging = false;

  // Modo decoración.
  private decorFor: string | null = null;
  private decorPick: string | null = null;
  private decorHeld: PlacedItem | null = null;
  private decorRot: Rot = 0;
  private ghost: Phaser.GameObjects.Image | null = null;
  private plotMarks: Phaser.GameObjects.Image[] = [];
  private decorChanged = false;
  private lastGhostTile = { tx: -1, ty: -1 };

  constructor() {
    super('office');
  }

  create(): void {
    // Al reiniciar la escena (ampliación nueva) los mapas internos se vacían.
    this.floorTiles = new Map();
    this.plotSprites = new Map();
    this.plotItemSprites = new Map();
    this.sprites = new Map();
    this.knownUids = new Map();
    this.gatheredAt = new Map();
    this.gatherSaid = new Set();
    this.staticBlocked = new Set();
    this.sparkly = [];
    this.plants = [];
    this.precip = [];
    this.pets = [];
    this.lightning = null;
    this.discoLights = [];
    this.meetingSign = [];
    this.unsubs = [];
    this.lastState = null;
    this.decorFor = null;

    const state = getState();
    setBuiltLevel(officeFund(state).level);
    if (import.meta.env.DEV) for (const p of layoutProblems()) console.warn('[layout]', p);
    buildWorldTextures(this);
    this.cameras.main.setBackgroundColor('#121319');

    this.buildFloor();
    this.buildWalls();
    this.buildSigns();
    this.buildAmbientLights();
    this.buildConstruction(state);
    for (const s of activeStaticItems()) {
      const img = this.makeItem(s.itemId, s.x, s.y, s.rot);
      this.decorateItem(s.itemId, s.x, s.y, s.rot, img);
      if (!ITEM_BY_ID[s.itemId].flat) this.markBlocked(this.staticBlocked, s.itemId, s.x, s.y, s.rot);
    }

    this.hover = this.add.image(0, 0, 'tile_hl').setOrigin(0.5, 0).setScale(INV).setDepth(2).setVisible(false);

    for (const e of Object.values(state.employees)) this.renderPlot(e);
    this.rebuildBlocked(state);
    for (const e of Object.values(state.employees)) this.spawn(e, state.currentUserId === e.id);
    this.spawnPets();
    this.lastState = state;
    this.updateMeetingSign(state);

    this.setupCamera();
    this.setupInput();
    this.buildSky();

    this.unsubs.push(subscribe(() => this.onState(getState())));
    this.unsubs.push(bridge.on('fx:coins', (id, amount) => this.fxCoins(id, amount)));
    this.unsubs.push(bridge.on('fx:levelup', (id, level) => this.fxLevel(id, level)));
    this.unsubs.push(bridge.on('fx:kudos', (from, to) => this.fxKudos(from, to)));
    this.unsubs.push(bridge.on('fx:gift', (from, to, itemId) => this.fxGift(from, to, itemId)));
    this.unsubs.push(bridge.on('fx:achievement', (id, achId) => this.fxAchievement(id, achId)));
    this.unsubs.push(bridge.on('fx:purchase', (id, itemId) => this.fxPurchase(id, itemId)));
    this.unsubs.push(bridge.on('fx:contribute', (id, amount) => this.fxContribute(id, amount)));
    this.unsubs.push(bridge.on('chat:say', (id, text) => this.sprites.get(id)?.say(text, 5500)));
    this.unsubs.push(
      bridge.on('presence', (ids) => {
        this.online = new Set(ids);
        for (const [id, s] of this.sprites) s.setOnline(this.online.has(id));
      }),
    );
    this.unsubs.push(bridge.on('camera:room', (id) => this.showRoom(id)));
    this.unsubs.push(bridge.on('camera:focus', (id) => this.focusOn(id)));
    this.unsubs.push(bridge.on('decor:mode', (id) => this.setDecor(id)));
    this.unsubs.push(bridge.on('decor:pick', (itemId) => this.pickForDecor(itemId)));
    this.unsubs.push(bridge.on('decor:rotate', () => this.rotateDecor()));
    this.unsubs.push(bridge.on('decor:store-held', () => this.storeHeld()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubs.forEach((u) => u()));

    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.ambient() });
    this.time.addEvent({ delay: 450, loop: true, callback: () => this.sparkle() });
    this.time.addEvent({ delay: 1300, loop: true, callback: () => this.natureTick() });
    this.time.addEvent({ delay: 1200, loop: true, callback: () => this.greetings() });
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.buildSky() });
    this.unsubs.push(bridge.on('weather', () => this.buildSky()));

    // Se acaba de construir una ampliación: la cámara va a mostrarla con fuegos artificiales.
    const celebrate = this.registry.get('celebrate') as number | undefined;
    if (celebrate) {
      this.registry.remove('celebrate');
      const x = EXPANSIONS[celebrate - 1];
      if (x) this.time.delayedCall(500, () => this.celebrateRoom(x.room.rect));
    }
  }

  update(time: number, dt: number): void {
    const me = getState().currentUserId;
    for (const s of this.sprites.values()) {
      s.tick(dt);
      if (s.mode !== 'walk' && s.timer <= 0) this.think(s, s.employee.id === me);
    }
    for (const p of this.pets) {
      p.tick(dt);
      if (p.mode !== 'walk' && p.timer <= 0) this.petThink(p);
    }
    this.updateCamera(dt);
    this.updatePrecip(dt);
    // Luces de la bola disco girando.
    this.discoLights.forEach((l, i) => {
      const a = time / 700 + (i * Math.PI * 2) / 3;
      const base = l.getData('base') as { x: number; y: number };
      l.setPosition(base.x + Math.cos(a) * 14, base.y + Math.sin(a) * 7);
    });
  }

  // -------------------------------------------------------------------------
  // Construcción del mundo
  // -------------------------------------------------------------------------

  private floorFor(x: number, y: number, state: GameState): string {
    for (const e of Object.values(state.employees)) {
      if (e.floor !== 'sala' && inRect(plotRect(e.dept, e.plot), x, y)) return e.floor;
    }
    const room = roomAt(x, y);
    return room ? ROOMS[room.id].floor : 'porcelanato';
  }

  private buildFloor(): void {
    const state = getState();
    for (const room of activeRooms()) {
      const r = room.rect;
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          const t = tileTop(x, y);
          const img = this.add.image(t.x, t.y, floorKey(this.floorFor(x, y, state), (x + y) % 2));
          this.floorTiles.set(`${x},${y}`, img.setOrigin(0.5, 0).setScale(INV).setDepth(0));
        }
      }
    }
  }

  private refreshFloor(rect: Rect, state: GameState): void {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        this.floorTiles.get(`${x},${y}`)?.setTexture(floorKey(this.floorFor(x, y, state), (x + y) % 2));
      }
    }
  }

  /** La próxima ampliación se ve como obra: piso apagado, borde de cinta y letrero con el avance del fondo. */
  private buildConstruction(state: GameState): void {
    this.construction = null;
    const next = EXPANSIONS[getBuiltLevel()];
    if (next === undefined) return;
    const r = next.room.rect;
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const t = tileTop(x, y);
        this.add
          .image(t.x, t.y, floorKey(ROOMS[next.room.id].floor, (x + y) % 2))
          .setOrigin(0.5, 0)
          .setScale(INV)
          .setDepth(0)
          .setTint(0x55556a)
          .setAlpha(0.45);
        const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
        if (edge && (x + y) % 2 === 0) {
          this.add.image(t.x, t.y, 'tile_hl').setOrigin(0.5, 0).setScale(INV).setDepth(0.5).setTint(0xf2b134).setAlpha(0.35);
        }
      }
    }
    // Conos de obra en las esquinas.
    for (const [cx, cy] of [[r.x + 1, r.y + 1], [r.x + r.w - 2, r.y + 1], [r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]]) {
      const p = project(cx + 0.5, cy + 0.5);
      const g = this.add.graphics().setDepth(depthOf(cx + 0.5, cy + 0.5, 2));
      g.fillStyle(0xf07f3c, 1).fillTriangle(p.x - 3, p.y, p.x + 3, p.y, p.x, p.y - 9);
      g.fillStyle(0xffffff, 1).fillRect(p.x - 1.6, p.y - 5, 3.2, 1.4);
      g.fillStyle(0x1b1d26, 1).fillRect(p.x - 4, p.y - 0.5, 8, 1.2);
    }
    const c = project(r.x + r.w / 2, r.y + r.h / 2);
    const label = crispText(this, c.x, c.y - 26, '', {
      fontFamily: NUM_FONT,
      fontSize: '7px',
      fontStyle: '900',
      color: '#ffe8b0',
      align: 'center',
      backgroundColor: '#1b1d26e6',
      padding: { x: 5, y: 3 },
    })
      .setOrigin(0.5, 1)
      .setDepth(1_050_000);
    const bar = this.add.graphics().setDepth(1_050_001);
    this.construction = { label, bar, x: c.x, y: c.y - 24 };
    this.tweens.add({ targets: label, y: label.y - 2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.updateConstruction(state);
  }

  private updateConstruction(state: GameState): void {
    const next = EXPANSIONS[getBuiltLevel()];
    if (this.construction === null || next === undefined) return;
    const fund = officeFund(state);
    const prev = getBuiltLevel() === 0 ? 0 : EXPANSIONS[getBuiltLevel() - 1].cost;
    const pct = Math.max(0, Math.min(1, (fund.total - prev) / (next.cost - prev)));
    const room = ROOMS[next.room.id].name.toUpperCase();
    const progress = `${fund.total.toLocaleString(intlLocale())} / ${next.cost.toLocaleString(intlLocale())}`;
    this.construction.label.setText(L(`🚧 PRÓXIMAMENTE: ${room}\n${progress} monedas`, `🚧 COMING SOON: ${room}\n${progress} coins`));
    const { bar, x, y } = this.construction;
    const w = 60;
    bar.clear();
    bar.fillStyle(0x1b1d26, 0.9).fillRoundedRect(x - w / 2 - 1, y, w + 2, 5, 2);
    bar.fillStyle(0xf2b134, 1).fillRoundedRect(x - w / 2, y + 1, Math.max(2, w * pct), 3, 1.5);
  }

  /** Fuera del horario laboral la oficina se ve de noche (las lámparas siguen encendidas). */
  /**
   * Luz y clima reales de Santiago: el tono sigue la salida y puesta de sol
   * (amanecer rosado, hora dorada, atardecer, noche azul) y encima va el
   * cielo del momento (nubes, neblina, lluvia, tormenta o nieve).
   */
  private buildSky(): void {
    const now = Date.now();
    const w = getWeather();
    const month = Number(new Date(now).toLocaleDateString('en-US', { timeZone: TIME_ZONE, month: 'numeric' })) - 1;
    const sun = sunTimes(w, month);
    const phase = dayPhase(officeClock(now).minutes, sun.sunrise, sun.sunset);
    const size = (MAP_W + MAP_H) * 40;
    const c = project(MAP_W / 2, MAP_H / 2);
    const layer = (depth: number) =>
      // Sobre el mundo pero bajo nombres y globos (que van desde 1.000.000).
      this.add.rectangle(c.x, c.y, size, size, 0xffffff).setDepth(depth).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0);
    if (this.night === null || !this.night.active) this.night = layer(999_000);
    if (this.overcast === null || !this.overcast.active) this.overcast = layer(999_100);

    const [color, alpha] = PHASE_LIGHT[phase];
    this.night.setFillStyle(color);
    this.tweens.add({ targets: this.night, alpha, duration: 2500 });

    const sky = w ? skyOf(w.code) : 'clear';
    const [tint, cloud] = SKY_LIGHT[sky];
    this.overcast.setFillStyle(tint);
    this.tweens.add({ targets: this.overcast, alpha: cloud, duration: 2500 });
    this.setPrecipitation(sky);
  }

  private setPrecipitation(sky: Sky): void {
    const want = { drizzle: 60, rain: 150, storm: 200, snow: 80 }[sky as 'rain'] ?? 0;
    const snow = sky === 'snow';
    const texture = snow ? 'snowflake' : 'raindrop';
    while (this.precip.length > want) this.precip.pop()!.img.destroy();
    for (const d of this.precip) d.img.setTexture(texture);
    while (this.precip.length < want) {
      const img = this.add.image(0, 0, texture).setDepth(999_600).setAlpha(snow ? 0.85 : rand(0.55, 0.9));
      this.precip.push({
        img,
        u: Math.random(),
        v: Math.random(),
        speed: snow ? rand(0.06, 0.12) : sky === 'drizzle' ? rand(0.5, 0.7) : rand(0.9, 1.3),
        drift: snow ? rand(-0.02, 0.02) : 0.12,
      });
    }
    // Tormenta: relámpagos cada tanto (doble destello).
    this.lightning?.remove();
    this.lightning = null;
    if (sky === 'storm') {
      const strike = () => {
        this.cameras.main.flash(90, 220, 230, 255);
        this.time.delayedCall(170, () => this.cameras.main.flash(140, 200, 215, 255));
        this.lightning = this.time.delayedCall(rand(7000, 18000), strike);
      };
      this.lightning = this.time.delayedCall(rand(3000, 9000), strike);
    }
  }

  /** Mueve la lluvia o nieve: cae siempre sobre lo que se ve, con cualquier zoom. */
  private updatePrecip(dt: number): void {
    if (this.precip.length === 0) return;
    const view = this.cameras.main.worldView;
    const zoom = this.cameras.main.zoom;
    const s = dt / 1000;
    for (const d of this.precip) {
      d.v += d.speed * s;
      d.u -= d.drift * s;
      if (d.v > 1.05) {
        d.v -= 1.1;
        d.u = Math.random() * 1.1;
      }
      if (d.u < -0.05) d.u += 1.1;
      d.img.setPosition(view.x + d.u * view.width, view.y + d.v * view.height).setScale(1.6 / zoom);
      if (d.drift > 0.05) d.img.setAngle(12);
    }
  }

  private buildWalls(): void {
    const place = (side: 'n' | 'w', x: number, y: number, kind: 'tall' | 'window' | 'glass') => {
      const h = (kind === 'glass' ? WALL_GLASS : WALL_TALL) + 2;
      const t = tileTop(x, y);
      this.add
        .image(t.x, t.y, wallKey(side, kind))
        .setOrigin(0.5, h / (16 + h))
        .setScale(INV)
        .setDepth(depthOf(x, y, 8));
    };
    for (const room of activeRooms()) {
      const r = room.rect;
      const outer = !EXPANSION_ROOMS.has(room.id);
      for (let x = r.x; x < r.x + r.w; x++) {
        if (hasDoor(x, r.y, 'n')) continue;
        place('n', x, r.y, outer && r.y === 0 ? (x % 4 === 2 ? 'window' : 'tall') : 'glass');
      }
      for (let y = r.y; y < r.y + r.h; y++) {
        if (hasDoor(r.x, y, 'w')) continue;
        place('w', r.x, y, outer && r.x === 0 ? (y % 4 === 2 ? 'window' : 'tall') : 'glass');
      }
    }
  }

  /** Letrero oscuro de cada sala, pegado a su muro norte (o colgando sobre el vidrio). */
  private buildSigns(): void {
    for (const room of activeRooms()) {
      const def = ROOMS[room.id];
      const r = room.rect;
      const key = `sign_${room.id}`;
      const size = buildSign(this, key, def.name, def.color, 'n');
      const tall = r.y === 0;
      const zTop = tall ? WALL_TALL - 7 : WALL_GLASS + size.h + 3;
      const lenTiles = size.w / 16;
      const x0 = r.x + Math.max(0.5, (r.w - lenTiles) / 2);
      const p = project(x0, r.y + (tall ? 0.26 : 0.12));
      // Profundidad del extremo derecho del muro: si no, los tramos siguientes lo tapan.
      this.add
        .image(p.x, p.y - zTop, key)
        .setOrigin(0, 0)
        .setScale(1 / SIGN_RES)
        .setDepth(depthOf(r.x + r.w, r.y, 9));
    }
  }

  private light(key: string, x: number, y: number, size: number, alpha: number, depth = 1.2): Phaser.GameObjects.Image {
    return this.add
      .image(x, y, key)
      .setDisplaySize(size, size / 2)
      .setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth);
  }

  /** Pozos de luz cálida del cielo y reflejo de las tiras LED en el piso. */
  private buildAmbientLights(): void {
    for (const room of activeRooms()) {
      const r = room.rect;
      const outdoor = room.id === 'terraza';
      for (let y = r.y + 2; y < r.y + r.h; y += 5) {
        for (let x = r.x + 2; x < r.x + r.w; x += 5) {
          const p = project(x + 0.5, y + 0.5);
          const l = this.light(outdoor ? 'light_white' : 'light_warm', p.x, p.y, 150, outdoor ? 0.08 : 0.1);
          this.tweens.add({ targets: l, alpha: outdoor ? 0.11 : 0.13, duration: rand(2500, 4000), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        }
      }
    }
    // Reflejo de la tira LED de los muros exteriores de la oficina original (36×28).
    for (let x = 0; x < 36; x += 2) {
      const p = project(x + 1, 0.4);
      this.light('light_warm', p.x, p.y, 60, 0.12);
    }
    for (let y = 0; y < 28; y += 2) {
      const p = project(0.4, y + 1);
      this.light('light_warm', p.x, p.y, 60, 0.12);
    }
  }

  private makeItem(itemId: string, x: number, y: number, rot: Rot): Phaser.GameObjects.Image {
    const t = tileTop(x, y);
    const o = itemOrigin(itemId, rot);
    const f = footprint(itemId, x, y, rot);
    const img = this.add.image(t.x, t.y, itemKey(itemId, rot)).setOrigin(o.ox, o.oy).setScale(INV);
    img.setDepth(ITEM_BY_ID[itemId].flat ? 1 + (x + y) * 0.001 : depthOf(f.x + f.w - 0.5, f.y + f.d - 0.5, 2));
    return img;
  }

  /** Luces y efectos propios de cada objeto. Devuelve lo creado para poder borrarlo. */
  private decorateItem(itemId: string, x: number, y: number, rot: Rot, img: Phaser.GameObjects.Image): Phaser.GameObjects.GameObject[] {
    const f = footprint(itemId, x, y, rot);
    const c = project(f.x + f.w / 2, f.y + f.d / 2);
    const out: Phaser.GameObjects.GameObject[] = [];
    if (DESKS.has(itemId)) {
      const l = this.light('light_cyan', c.x, c.y - 4, 46, 0.22, img.depth - 0.1);
      this.tweens.add({ targets: l, alpha: 0.3, duration: rand(900, 1600), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      out.push(l);
    }
    if (itemId === 'lampara') out.push(this.light('light_warm', c.x, c.y, 90, 0.4));
    if (itemId === 'neon') out.push(this.light('light_pink', c.x, c.y, 70, 0.35));
    if (itemId === 'arcade') out.push(this.light('light_cyan', c.x, c.y, 50, 0.3));
    if (itemId === 'acuario' || itemId === 'fuente') out.push(this.light('light_cyan', c.x, c.y, 80, 0.25));
    if (itemId === 'pecera' || itemId === 'pantalla_kpi' || itemId === 'consola') out.push(this.light('light_cyan', c.x, c.y, 44, 0.22));
    if (itemId === 'lampara_lava' || itemId === 'jukebox') {
      const l = this.light('light_pink', c.x, c.y, 64, 0.3);
      this.tweens.add({ targets: l, alpha: 0.45, duration: rand(1200, 2000), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      out.push(l);
    }
    if (itemId === 'portal' || itemId === 'dragon' || itemId === 'unicornio') {
      const l = this.light(itemId === 'portal' ? 'light_pink' : 'light_warm', c.x, c.y - 6, 96, 0.3);
      this.tweens.add({ targets: l, alpha: 0.5, scale: l.scale * 1.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      out.push(l);
    }
    if (itemId === 'cohete' || itemId === 'cofre' || itemId === 'trono' || itemId === 'estatua') {
      const l = this.light('light_warm', c.x, c.y, 80, 0.3);
      this.tweens.add({ targets: l, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
      out.push(l);
    }
    if (itemId === 'bola_disco') {
      for (const key of ['light_pink', 'light_cyan', 'light_warm']) {
        const l = this.light(key, c.x, c.y, 56, 0.45).setData('base', { x: c.x, y: c.y });
        this.discoLights.push(l);
        l.once(Phaser.GameObjects.Events.DESTROY, () => (this.discoLights = this.discoLights.filter((d) => d !== l)));
        out.push(l);
      }
    }
    if (ITEM_BY_ID[itemId]?.category === 'plantas') {
      this.sway(img, itemId, rot);
      this.plants.push({ img, itemId });
      img.once(Phaser.GameObjects.Events.DESTROY, () => (this.plants = this.plants.filter((p) => p.img !== img)));
    }
    if (LEGENDARY.has(itemId)) {
      this.sparkly.push({ img, itemId });
      img.once(Phaser.GameObjects.Events.DESTROY, () => (this.sparkly = this.sparkly.filter((s) => s.img !== img)));
    }
    return out;
  }

  /**
   * Vaivén de las plantas, como con brisa. El pivote pasa a la base (centro de
   * la baldosa) para que se mezan desde la maceta y no desde una esquina.
   */
  private sway(img: Phaser.GameObjects.Image, itemId: string, rot: Rot): void {
    const def = ITEM_BY_ID[itemId];
    const fw = rot === 0 ? def.w : def.d;
    const fd = rot === 0 ? def.d : def.w;
    // Píxeles de textura por unidad de arte (la textura se pinta a ART_SCALE).
    const k = img.width / ((def.w + def.d) * 16);
    const ox = img.originX * img.width;
    const oy = img.originY * img.height;
    const cx = ox + 8 * (fw - fd) * k;
    const cy = oy + 4 * (fw + fd) * k;
    img.setOrigin(cx / img.width, cy / img.height);
    img.setPosition(img.x + (cx - ox) * INV, img.y + (cy - oy) * INV);
    // Las grandes (árbol, jardinera, palmera) se mueven menos que una matita.
    const tall = img.height / k - (def.w + def.d) * 8 > 40;
    const amp = fw * fd > 1 || tall ? 0.9 : 1.8;
    img.setAngle(-amp);
    this.tweens.add({ targets: img, angle: amp, duration: rand(1700, 2900), delay: rand(0, 1800), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** Vida en las plantas: cae una hoja, una flor suelta polen o llega una mariposa. */
  private natureTick(): void {
    const visible = this.plants.filter((p) => p.img.visible && this.cameras.main.worldView.contains(p.img.x, p.img.y));
    if (visible.length === 0) return;
    const { img, itemId } = pick(visible);
    const b = img.getBounds();
    const flowers = FLOWERS.has(itemId);
    const r = Math.random();
    if (flowers && r < 0.3) this.butterfly(b, img.depth);
    else if (flowers && r < 0.65) this.pollen(b, img.depth);
    else this.fallingLeaf(b, img.depth, itemId === 'lavanda' ? 0xb79cff : undefined);
  }

  private fallingLeaf(b: Phaser.Geom.Rectangle, depth: number, tint?: number): void {
    const x = rand(b.left + 3, b.right - 3);
    const y = rand(b.top + 2, b.top + b.height * 0.45);
    const leaf = this.add.image(x, y, 'leaf').setDepth(depth + 0.3).setScale(0.55).setAngle(rand(0, 360));
    if (tint !== undefined) leaf.setTint(tint);
    const fall = rand(14, 22);
    const time = rand(1600, 2400);
    this.tweens.add({ targets: leaf, y: b.bottom - 2 + fall * 0.3, angle: leaf.angle + rand(-200, 200), duration: time, ease: 'Sine.In' });
    // Balanceo de lado a lado mientras cae.
    this.tweens.add({ targets: leaf, x: x + rand(-7, 7), duration: time / 3, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: leaf, alpha: 0, delay: time * 0.75, duration: time * 0.35, onComplete: () => leaf.destroy() });
  }

  private pollen(b: Phaser.Geom.Rectangle, depth: number): void {
    for (let k = 0; k < 3; k++) {
      const p = this.add
        .image(rand(b.left + 3, b.right - 3), rand(b.top + 2, b.top + b.height * 0.4), 'spark')
        .setDepth(depth + 0.3)
        .setScale(0.3)
        .setTint(0xfff2a0)
        .setAlpha(0);
      this.tweens.add({ targets: p, alpha: 0.9, y: p.y - rand(6, 12), x: p.x + rand(-5, 5), duration: rand(900, 1400), delay: k * 220, yoyo: true, onComplete: () => p.destroy() });
    }
  }

  private butterfly(b: Phaser.Geom.Rectangle, depth: number): void {
    const from = { x: b.centerX + rand(-40, 40), y: b.top - rand(20, 34) };
    const bf = this.add.image(from.x, from.y, 'butterfly').setDepth(depth + 0.4).setScale(0.6).setAlpha(0);
    // Aleteo: las alas se cierran y abren muy rápido.
    this.tweens.add({ targets: bf, scaleX: 0.15, duration: 110, yoyo: true, repeat: -1 });
    this.tweens.chain({
      targets: bf,
      tweens: [
        { alpha: 1, x: b.centerX + rand(-4, 4), y: b.top + rand(2, 6), duration: 1400, ease: 'Sine.InOut' },
        { x: '+=6', y: '-=4', duration: 900, ease: 'Sine.InOut', yoyo: true },
        { x: from.x + rand(-30, 30), y: b.top - rand(30, 44), alpha: 0, duration: 1600, ease: 'Sine.In' },
      ],
      onComplete: () => bf.destroy(),
    });
  }

  /** Destellos sobre los objetos legendarios (de a uno por vez, livianos). */
  private sparkle(): void {
    if (this.sparkly.length === 0) return;
    const { img } = pick(this.sparkly);
    if (!img.visible) return;
    const b = img.getBounds();
    const s = this.add
      .image(rand(b.left + 4, b.right - 4), rand(b.top + 2, b.bottom - 10), 'spark')
      .setScale(0.6)
      .setDepth(img.depth + 0.2)
      .setAlpha(0);
    this.tweens.add({ targets: s, alpha: 1, scale: 1, angle: 90, duration: 350, yoyo: true, onComplete: () => s.destroy() });
  }

  private markBlocked(set: Set<string>, itemId: string, x: number, y: number, rot: Rot): void {
    const f = footprint(itemId, x, y, rot);
    for (let j = 0; j < f.d; j++) for (let i = 0; i < f.w; i++) set.add(`${f.x + i},${f.y + j}`);
  }

  private rebuildBlocked(state: GameState): void {
    this.blocked = new Set(this.staticBlocked);
    for (const e of Object.values(state.employees)) {
      const r = plotRect(e.dept, e.plot);
      for (const p of e.placed) {
        if (!ITEM_BY_ID[p.itemId]?.flat) this.markBlocked(this.blocked, p.itemId, r.x + p.x, r.y + p.y, p.rot);
      }
    }
  }

  private renderPlot(e: Employee): void {
    for (const obj of this.plotSprites.get(e.id) ?? []) obj.destroy();
    const r = plotRect(e.dept, e.plot);
    const byUid = new Map<string, Phaser.GameObjects.Image>();
    const objs: Phaser.GameObjects.GameObject[] = [];
    const known = this.knownUids.get(e.id);
    for (const p of e.placed) {
      if (ITEM_BY_ID[p.itemId] === undefined) continue;
      const img = this.makeItem(p.itemId, r.x + p.x, r.y + p.y, p.rot);
      byUid.set(p.uid, img);
      objs.push(img, ...this.decorateItem(p.itemId, r.x + p.x, r.y + p.y, p.rot, img));
      // Lo recién colocado (por cualquiera) cae desde arriba con rebote.
      if (known !== undefined && !known.has(p.uid)) this.dropIn(img, p.itemId);
    }
    this.knownUids.set(e.id, new Set(e.placed.map((p) => p.uid)));
    this.plotSprites.set(e.id, objs);
    this.plotItemSprites.set(e.id, byUid);
  }

  private dropIn(img: Phaser.GameObjects.Image, itemId: string): void {
    const y = img.y;
    img.setY(y - 28).setAlpha(0).setScale(INV * 0.7, INV * 1.3);
    this.tweens.add({ targets: img, y, alpha: 1, duration: 380, ease: 'Quad.In' });
    this.tweens.add({ targets: img, scaleX: INV, scaleY: INV, delay: 380, duration: 520, ease: 'Elastic.Out' });
    this.time.delayedCall(380, () => {
      const legendary = LEGENDARY.has(itemId);
      const n = legendary ? 16 : 8;
      for (let k = 0; k < n; k++) {
        const a = (Math.PI * 2 * k) / n;
        const dust = this.add.image(img.x, y - 4, legendary ? 'spark' : 'star').setDepth(900_000).setScale(0.45);
        this.tweens.add({
          targets: dust,
          x: img.x + Math.cos(a) * (legendary ? 26 : 18),
          y: y - 4 + Math.sin(a) * (legendary ? 13 : 9),
          alpha: 0,
          scale: 0.9,
          duration: 650,
          ease: 'Quad.Out',
          onComplete: () => dust.destroy(),
        });
      }
      if (legendary) this.cameras.main.shake(180, 0.002);
    });
  }

  // -------------------------------------------------------------------------
  // Colaboradores
  // -------------------------------------------------------------------------

  private seatOf(e: Employee): Seat {
    const r = plotRect(e.dept, e.plot);
    // Su silla es la que está dentro del puesto: las que dejó por la oficina son para todos.
    const chair = e.placed.find((p) => ITEM_BY_ID[p.itemId]?.seat && inRect(r, r.x + p.x, r.y + p.y));
    if (chair) return { x: r.x + chair.x, y: r.y + chair.y, facing: chair.rot === 0 ? 'v' : 'u' };
    // Sin silla: de pie en una baldosa libre del puesto.
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) if (!this.blocked.has(`${x},${y}`)) return { x, y, facing: 'v' };
    }
    return { x: r.x, y: r.y + r.h, facing: 'v' };
  }

  private spawn(e: Employee, isMe: boolean): void {
    const seat = this.seatOf(e);
    const s = new EmployeeSprite(this, e, seat.x, seat.y, isMe);
    s.sitAt(seat, rand(2000, 30000));
    s.setOnline(this.online.has(e.id));
    s.body.on('pointerup', () => {
      if (!this.dragging && this.decorFor === null) bridge.emit('employee:clicked', e.id);
    });
    this.sprites.set(e.id, s);
  }

  /**
   * Decide qué hace un colaborador cuando se le acaba el tiempo. Prioridades:
   * reunión en curso, colación en el casino, su pausa de la hora y, el resto
   * del tiempo, sentado trabajando en su puesto.
   */
  private think(s: EmployeeSprite, isMe: boolean): void {
    const e = s.employee;
    const now = Date.now();
    // Reunión en curso: a la sala, y ahí se queda hasta que termine.
    const meeting = activeMeetingFor(getState(), e.id);
    if (meeting && this.gather(s, 'meeting', this.meetingSpot(e.id, meeting), L(['🗓️ ¡A la reunión!', 'Voy a la sala 🏃', '📋', '¡Vamos!'], ['🗓️ Meeting time!', 'Heading to the room 🏃', '📋', "Let's go!"]))) return;
    // Colación: todos al casino a almorzar.
    if (isLunchTime(now) && this.gather(s, 'lunch', this.lunchSpot(e.id), L(['🍽️ ¡A almorzar!', '¡Hambre! 🍲', 'Al casino 🥗', '🍕'], ['🍽️ Lunch time!', 'Starving! 🍲', 'To the cafeteria 🥗', '🍕']))) return;
    this.gatheredAt.delete(e.id);
    this.gatherSaid.delete(e.id);

    // Su pausa de la hora: estira las piernas, va al casino o visita a alguien.
    // Uno mismo se mueve con clics, así que no tiene pausas automáticas.
    if (!isMe && isOnBreak(e.id, Object.keys(getState().employees), now)) {
      // Al levantarse del puesto, primero se estira (y a veces bosteza).
      if (s.mode === 'sit') {
        s.standUp(1600);
        s.gesture('stretch', 1500);
        if (Math.random() < 0.35) s.say(pick(L(['🥱', '¡Una pausa!', '☕ ¿Café?', '💪'], ['🥱', 'Break time!', '☕ Coffee?', '💪'])), 2200);
        return;
      }
      const dest = this.randomDestination(e);
      if (dest === null) {
        s.timer = 10_000;
        return;
      }
      const stay = rand(25_000, 70_000);
      this.goTo(s, dest, () => {
        s.idle(stay);
        if (dest.kind === 'casino') s.gesture('drink', stay);
        if (dest.kind === 'visit' && dest.with) this.chat(s, dest.with);
      });
      return;
    }

    // Trabajando: sentado en su puesto.
    const seat = this.seatOf(e);
    const work = isMe ? 60_000 : rand(20_000, 40_000);
    if (s.mode === 'sit' && s.tile.x === seat.x && s.tile.y === seat.y) {
      s.timer = work;
      // A ratos atiende el teléfono (en Ventas, más seguido).
      if (!isMe && isWorkTime(now) && !s.doing('phone') && Math.random() < (e.dept === 'ventas' ? 0.12 : 0.05)) {
        const call = rand(8000, 16_000);
        s.gesture('phone', call);
        s.timer = Math.max(work, call);
        if (Math.random() < 0.6) s.say(pick(L(['📞', '¿Aló? 📞', 'Sí, le envío la cotización 📄', 'Perfecto, quedamos así 👍', '📱'], ['📞', 'Hello? 📞', "Sure, I'll send you the quote 📄", "Perfect, it's a deal 👍", '📱'])), 2600);
      }
      return;
    }
    this.goTo(s, seat, () => s.sitAt(seat, work));
  }

  /** Lleva a la persona a su lugar en una reunión o en la colación, y la deja ahí. */
  private gather(s: EmployeeSprite, kind: 'meeting' | 'lunch', spot: Spot | null, lines: string[]): boolean {
    if (spot === null) return false;
    const id = s.employee.id;
    if (this.gatheredAt.get(id) !== kind) this.gatherSaid.delete(id);
    this.gatheredAt.set(id, kind);
    const settle = () => (spot.seat ? s.sitAt(spot, 20_000) : s.idle(20_000));
    if (s.tile.x === spot.x && s.tile.y === spot.y) settle();
    else {
      if (!this.gatherSaid.has(id)) {
        this.gatherSaid.add(id);
        s.say(pick(lines), 2500);
      }
      this.goTo(s, spot, settle);
    }
    return true;
  }

  private goTo(s: EmployeeSprite, dest: Point, onArrive: () => void): boolean {
    const path = findPath(s.tile, dest, this.blocked);
    if (path === null) {
      s.fx = dest.x + 0.5;
      s.fy = dest.y + 0.5;
      onArrive();
      return false;
    }
    s.walk(path, onArrive);
    return true;
  }

  private freeTileIn(rect: Rect): Point | null {
    const plots = Object.values(getState().employees).map((e) => plotRect(e.dept, e.plot));
    for (let k = 0; k < 40; k++) {
      const x = rect.x + Math.floor(Math.random() * rect.w);
      const y = rect.y + Math.floor(Math.random() * rect.h);
      if (this.blocked.has(`${x},${y}`)) continue;
      if (plots.some((p) => inRect(p, x, y))) continue;
      return { x, y };
    }
    return null;
  }

  /** Lugar de cada asistente en la sala de reuniones. */
  private meetingSpot(id: string, m: Meeting): Spot | null {
    const people = m.attendees.length ? m.attendees : Object.keys(getState().employees);
    const r = ROOM_BY_ID.reuniones.rect;
    return this.roomSpot(id, people, r, { x: r.x + 6, y: r.y + 4 });
  }

  /** Lugar de cada persona en el casino a la hora de colación. */
  private lunchSpot(id: string): Spot | null {
    const r = ROOM_BY_ID.cafeteria.rect;
    return this.roomSpot(id, Object.keys(getState().employees), r, { x: r.x + 6, y: r.y + 4 });
  }

  /**
   * Lugar de cada persona cuando el grupo se junta en una sala: primero las
   * sillas y, si no alcanzan, de pie cerca de `center`. El orden es estable
   * (por nombre) para que nadie se cruce de puesto.
   */
  private roomSpot(id: string, ids: string[], r: Rect, center: Point): Spot | null {
    const state = getState();
    const people = ids.filter((x) => state.employees[x] !== undefined).sort((a, b) => state.employees[a].name.localeCompare(state.employees[b].name));
    const index = people.indexOf(id);
    if (index < 0) return null;
    const chairs = activeStaticItems()
      .filter((s) => s.itemId === 'silla' && inRect(r, s.x, s.y))
      .map((s) => ({ x: s.x, y: s.y, seat: true, facing: (s.rot === 0 ? 'v' : 'u') as 'u' | 'v' }));
    if (index < chairs.length) return chairs[index];
    const free: Point[] = [];
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) if (!this.blocked.has(`${x},${y}`) && !chairs.some((c) => c.x === x && c.y === y)) free.push({ x, y });
    }
    free.sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
    const p = free[index - chairs.length];
    return p ? { ...p, seat: false, facing: 'v' } : null;
  }

  /** Dónde está juntada cada persona ahora (reunión o colación) y si ya lo anunció. */
  private gatheredAt = new Map<string, 'meeting' | 'lunch'>();
  private gatherSaid = new Set<string>();
  /** Último saludo entre cada par (para no saludarse a cada rato). */
  private greeted = new Map<string, number>();
  /** Bruno (golden) y Mandarina (gata naranja). */
  private pets: PetSprite[] = [];

  // -------------------------------------------------------------------------
  // Mascotas
  // -------------------------------------------------------------------------

  private spawnPets(): void {
    for (const p of this.pets) p.destroy();
    this.pets = [];
    const pets: [PetSprite['kind'], string, RoomId][] = [
      ['dog', 'Bruno', 'ventas'],
      ['cat', 'Mandarina', 'cafeteria'],
    ];
    for (const [kind, name, room] of pets) {
      const t = this.freeTileIn(ROOM_BY_ID[room].rect) ?? { x: 11, y: 17 };
      const p = new PetSprite(this, kind, name, t.x, t.y);
      p.timer = rand(500, 3000);
      p.body.on('pointerup', () => {
        if (!this.dragging && this.decorFor === null) this.petClicked(p);
      });
      this.pets.push(p);
    }
  }

  /** Dónde duermen fuera del horario: Bruno junto al sofá del casino, Mandarina en un rincón de TI. */
  private petBed(p: PetSprite): Point {
    const want = p.kind === 'dog' ? { x: 26, y: 27 } : { x: 22, y: 9 };
    if (!this.blocked.has(`${want.x},${want.y}`) && roomAt(want.x, want.y) !== null) return want;
    return this.freeTileIn(ROOM_BY_ID[p.kind === 'dog' ? 'cafeteria' : 'ti'].rect) ?? p.tile;
  }

  /** Una baldosa libre junto a alguien (para echarse a sus pies). */
  private besidePerson(s: EmployeeSprite): Point | null {
    const t = s.tile;
    const options = [
      { x: t.x + 1, y: t.y },
      { x: t.x, y: t.y + 1 },
      { x: t.x - 1, y: t.y },
      { x: t.x, y: t.y - 1 },
    ].filter((n) => !this.blocked.has(`${n.x},${n.y}`) && roomAt(n.x, n.y) !== null && canCross(t.x, t.y, n.x, n.y));
    return options.length > 0 ? pick(options) : null;
  }

  private petThink(p: PetSprite): void {
    const now = Date.now();
    const go = (dest: Point | null, then: () => void) => {
      const path = dest ? findPath(p.tile, dest, this.blocked) : null;
      if (path === null) {
        p.dash = false;
        p.rest('stand', rand(2500, 5000));
        return;
      }
      p.walk(path, then);
    };
    const randomRoom = () => this.freeTileIn(pick(activeRooms()).rect);
    const people = [...this.sprites.values()];

    // Fuera del horario: a su camita a dormir.
    if (!isWorkTime(now)) {
      const bed = this.petBed(p);
      if (p.tile.x === bed.x && p.tile.y === bed.y) p.rest('lie', 60_000);
      else go(bed, () => p.rest('lie', 60_000));
      return;
    }
    const r = Math.random();
    if (p.kind === 'dog') {
      // En la colación, Bruno va al casino a pedir algo con cara de pena.
      if (isLunchTime(now)) {
        const diners = people.filter((s) => s.mode === 'sit' && roomAt(s.tile.x, s.tile.y)?.id === 'cafeteria');
        const dest = diners.length > 0 ? this.besidePerson(pick(diners)) : this.freeTileIn(ROOM_BY_ID.cafeteria.rect);
        go(dest, () => {
          p.rest('sit', rand(12_000, 25_000));
          p.emote(pick(['🥺', '🍖?', '🐶', '❤️']));
        });
        return;
      }
      if (r < 0.35 && people.length > 0) {
        const friend = pick(people);
        go(this.besidePerson(friend), () => {
          p.rest('sit', rand(10_000, 20_000));
          if (Math.random() < 0.5) p.emote('❤️');
          if (Math.random() < 0.4) friend.say(pick(L([`¡Hola ${p.name}! 🐶`, '¿Quién es un buen perro? 🐕', `¡${p.name}! ❤️`, '🐶'], [`Hi ${p.name}! 🐶`, "Who's a good dog? 🐕", `${p.name}! ❤️`, '🐶'])), 2600);
        });
      } else if (r < 0.6 && people.length > 0) {
        go(this.besidePerson(pick(people)), () => p.rest('lie', rand(30_000, 70_000)));
      } else if (r < 0.85) {
        go(randomRoom(), () => {
          p.rest('stand', rand(4000, 10_000));
          if (Math.random() < 0.3) p.emote('🐾');
        });
      } else {
        p.rest('sit', rand(6000, 12_000));
        if (Math.random() < 0.4) p.emote(L('¡Guau!', 'Woof!'));
      }
      return;
    }
    // Mandarina: duerme mucho, acompaña a quien trabaja y a veces le dan "cinco minutos".
    if (r < 0.45) {
      go(randomRoom(), () => {
        p.rest('lie', rand(40_000, 120_000));
        p.emote('💤');
      });
    } else if (r < 0.7 && people.length > 0) {
      const workers = people.filter((s) => s.mode === 'sit');
      go(this.besidePerson(pick(workers.length > 0 ? workers : people)), () => {
        p.rest('sit', rand(15_000, 30_000));
        if (Math.random() < 0.5) p.emote('😺');
      });
    } else if (r < 0.9) {
      go(randomRoom(), () => p.rest('stand', rand(5000, 12_000)));
    } else {
      p.dash = true;
      p.emote('💨');
      go(randomRoom(), () => p.rest('stand', 3000));
    }
  }

  /** Cariño con un clic: salta, corazones y su sonido. */
  private petClicked(p: PetSprite): void {
    if (p.kind === 'cat' && p.mode === 'lie') {
      p.emote(pick(L(['Prrr… 💤', '😽', 'Prrr ❤️'], ['Purrr… 💤', '😽', 'Purrr ❤️'])));
    } else {
      p.hop();
      p.emote(p.kind === 'dog' ? pick(L(['¡Guau! 🐶', '¡Guau guau! ❤️', '🐾❤️'], ['Woof! 🐶', 'Woof woof! ❤️', '🐾❤️'])) : pick(L(['¡Miau! 😺', 'Miau ❤️', '😸'], ['Meow! 😺', 'Meow ❤️', '😸'])));
      if (p.mode !== 'walk') p.rest(p.kind === 'dog' ? 'stand' : 'sit', 5000);
    }
    const x = p.body.x;
    const y = p.body.y - (p.kind === 'dog' ? 12 : 9);
    for (let k = 0; k < 3; k++) {
      const h = this.add.image(x + rand(-5, 5), y, 'heart').setDepth(1_100_000).setScale(0.45).setAlpha(0);
      this.tweens.add({ targets: h, alpha: { from: 1, to: 0 }, y: y - rand(12, 20), scale: 0.7, delay: k * 160, duration: 1100, ease: 'Quad.Out', onComplete: () => h.destroy() });
    }
  }

  /** Letrero flotante sobre la mesa mientras hay una reunión en curso. */
  private updateMeetingSign(state: GameState): void {
    for (const o of this.meetingSign) o.destroy();
    this.meetingSign = [];
    const live = (state.meetings ?? []).find((m) => m.status === 'active');
    if (live === undefined) return;
    const r = ROOM_BY_ID.reuniones.rect;
    const c = project(r.x + 6, r.y + 4);
    // Bien arriba, para no tapar los nombres de quienes están en la mesa.
    const label = crispText(this, c.x, c.y - 62, L(`🔴 EN REUNIÓN · ${live.title}`, `🔴 IN A MEETING · ${live.title}`), {
      fontFamily: NUM_FONT,
      fontSize: '6.5px',
      fontStyle: '900',
      color: '#ffffff',
      backgroundColor: '#c0392bee',
      padding: { x: 5, y: 2.5 },
    })
      .setOrigin(0.5, 1)
      .setDepth(1_050_000);
    this.tweens.add({ targets: label, y: label.y - 2, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const glow = this.light('light_warm', c.x, c.y, 180, 0.15, 1.3);
    this.tweens.add({ targets: glow, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.meetingSign = [label, glow];
  }

  private randomDestination(e: Employee): Destination | null {
    const r = Math.random();
    const others = Object.values(getState().employees).filter((o) => o.id !== e.id);
    const room = (id: keyof typeof ROOM_BY_ID) => ROOM_BY_ID[id].rect;
    const at = (p: Point | null, kind: Destination['kind'], withId?: string): Destination | null => (p ? { ...p, kind, with: withId } : null);
    // Con ampliaciones construidas, a veces se van a disfrutarlas.
    const extras = EXPANSIONS.slice(0, getBuiltLevel()).map((x) => x.room.id);
    if (extras.length > 0 && r < 0.25) return at(this.freeTileIn(room(pick(extras))), 'room');
    if (r < 0.45) return at(this.freeTileIn(room('cafeteria')), 'casino');
    if (r < 0.55) return at(this.freeTileIn(room('reuniones')), 'room');
    if (r < 0.8 && others.length > 0) {
      // Visitar a un compañero: pararse frente a su escritorio y conversar.
      const o = pick(others);
      const p = plotRect(o.dept, o.plot);
      const spot = { x: p.x + 1 + Math.floor(Math.random() * (p.w - 1)), y: p.y + p.h };
      return this.blocked.has(`${spot.x},${spot.y}`) || roomAt(spot.x, spot.y) === null ? null : at(spot, 'visit', o.id);
    }
    return at(this.freeTileIn(room(e.dept)), 'room');
  }

  /**
   * Conversación de pasillo: quien llega saluda con la mano y se turnan los
   * globos con el compañero (si está en su puesto).
   */
  private chat(s: EmployeeSprite, otherId: string): void {
    const o = this.sprites.get(otherId);
    s.gesture('wave', 1800);
    s.say(pick(L(['¡Hola! 👋', '¿Cómo va todo?', '¡Buenas!', '¿Un café? ☕', '¿Viste el correo? 📧'], ['Hi! 👋', 'How is it going?', 'Hey there!', 'Coffee? ☕', 'Did you see the email? 📧'])), 3000);
    if (o === undefined || o.mode === 'walk') return;
    const lines: [EmployeeSprite, string[]][] = [
      [o, L(['¡Hola! 👋', '¡Todo bien! 😄', 'Aquí, en la lucha 💪', 'Dale, en un rato ☕'], ['Hi! 👋', 'All good! 😄', 'Hanging in there 💪', 'Sure, in a bit ☕'])],
      [s, L(['¿Cerraste lo de ayer?', 'Buena esa 👏', '¿Almorzamos juntos? 🍽️', 'Te mando el archivo 📎'], ["Did you close yesterday's deal?", 'Nice one 👏', 'Lunch together? 🍽️', "I'll send you the file 📎"])],
      [o, L(['¡Sí! 🎉', 'Jajaja 😂', 'Va, te aviso 👍', 'Gracias 🙌'], ['Yes! 🎉', 'Hahaha 😂', "Okay, I'll let you know 👍", 'Thanks 🙌'])],
      [s, L(['Nos vemos 👋', '¡Éxito! 💪', '👍', '😄'], ['See you 👋', 'Good luck! 💪', '👍', '😄'])],
    ];
    lines.forEach(([who, opts], i) => this.time.delayedCall(2600 * (i + 1), () => this.sprites.get(who.employee.id) === who && who.say(pick(opts), 2800)));
  }

  /** Saludo al cruzarse: si dos se encuentran cerca, uno saluda (cada par, de vez en cuando). */
  private greetings(): void {
    if (!isWorkTime(Date.now())) return;
    // Quien pasa junto a una mascota a veces la saluda.
    for (const p of this.pets) {
      for (const sp of this.sprites.values()) {
        if (sp.mode === 'sit' || Math.hypot(sp.fx - p.fx, sp.fy - p.fy) > 1.4) continue;
        const key = `${p.name}|${sp.employee.id}`;
        if ((this.greeted.get(key) ?? -Infinity) > this.time.now - 120_000) continue;
        this.greeted.set(key, this.time.now);
        if (Math.random() < 0.5) sp.say(pick(L([`¡Hola ${p.name}! ${p.kind === 'dog' ? '🐶' : '🐱'}`, '❤️', p.kind === 'dog' ? '¿Quién es un buen perro?' : '¡Michi! 😺'], [`Hi ${p.name}! ${p.kind === 'dog' ? '🐶' : '🐱'}`, '❤️', p.kind === 'dog' ? "Who's a good dog?" : 'Kitty! 😺'])), 2400);
      }
    }
    const all = [...this.sprites.values()].filter((s) => s.mode !== 'sit');
    const now = this.time.now;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (Math.hypot(a.fx - b.fx, a.fy - b.fy) > 1.8) continue;
        const key = [a.employee.id, b.employee.id].sort().join('|');
        if ((this.greeted.get(key) ?? -Infinity) > now - 90_000) continue;
        this.greeted.set(key, now);
        const who = Math.random() < 0.5 ? a : b;
        if (who.mode === 'idle') who.gesture('wave', 1600);
        who.say(pick(L(['👋', '¡Hola!', '¡Buenas! 👋', '😄'], ['👋', 'Hi!', 'Hey there! 👋', '😄'])), 2000);
        return;
      }
    }
  }

  private ambient(): void {
    const all = [...this.sprites.values()];
    if (all.length === 0) return;
    if (!isWorkTime(Date.now())) {
      // Después de la jornada, solo algún bostezo de vez en cuando.
      if (Math.random() < 0.15) pick(all).say(pick(L(['💤', '🌙', '¡Hasta mañana!', '😴'], ['💤', '🌙', 'See you tomorrow!', '😴'])));
      return;
    }
    if (isLunchTime(Date.now())) {
      pick(all).say(pick(LUNCH_TALK));
      return;
    }
    pick(all).say(Math.random() < 0.45 ? pick(CHATTER) : pick(EMOTES));
  }

  // -------------------------------------------------------------------------
  // Cambios de estado
  // -------------------------------------------------------------------------

  private onState(next: GameState): void {
    const prev = this.lastState;
    this.lastState = next;
    if (prev === null) return;

    // Se construyó una ampliación: se rehace el mundo y luego se celebra.
    const level = officeFund(next).level;
    if (level !== getBuiltLevel()) {
      if (level > getBuiltLevel()) this.registry.set('celebrate', level);
      if (this.decorFor !== null) bridge.emit('decor:mode', null);
      this.scene.restart();
      return;
    }
    if (officeFund(prev).total !== officeFund(next).total) this.updateConstruction(next);

    // Cambió alguna reunión: todos reconsideran adónde ir (de a poco, para que no salgan en fila).
    if (prev.meetings !== next.meetings) {
      const wasLive = (prev.meetings ?? []).filter((m) => m.status === 'active').map((m) => m.id).join();
      const isLive = (next.meetings ?? []).filter((m) => m.status === 'active').map((m) => m.id).join();
      if (wasLive !== isLive) {
        for (const s of this.sprites.values()) if (s.mode !== 'walk') s.timer = rand(100, 2500);
        this.updateMeetingSign(next);
        if (isLive && !wasLive) this.time.delayedCall(800, () => this.showRoom('reuniones', false));
      }
    }
    let layoutChanged = false;

    for (const [id, e] of Object.entries(next.employees)) {
      const before = prev.employees[id];
      if (before === undefined) {
        this.renderPlot(e);
        this.refreshFloor(plotRect(e.dept, e.plot), next);
        layoutChanged = true;
        continue;
      }
      if (before === e) continue;
      if (before.placed !== e.placed) {
        this.renderPlot(e);
        layoutChanged = true;
      }
      if (before.floor !== e.floor) this.refreshFloor(plotRect(e.dept, e.plot), next);
    }
    for (const id of Object.keys(prev.employees)) {
      if (next.employees[id] !== undefined) continue;
      const old = prev.employees[id];
      for (const obj of this.plotSprites.get(id) ?? []) obj.destroy();
      this.plotSprites.delete(id);
      this.refreshFloor(plotRect(old.dept, old.plot), next);
      this.sprites.get(id)?.destroy();
      this.sprites.delete(id);
      layoutChanged = true;
    }
    if (layoutChanged) this.rebuildBlocked(next);

    for (const [id, e] of Object.entries(next.employees)) {
      const s = this.sprites.get(id);
      if (s === undefined) this.spawn(e, next.currentUserId === id);
      else {
        s.update(e);
        if (prev.currentUserId !== next.currentUserId) s.setMe(next.currentUserId === id);
        if (prev.employees[id]?.placed !== e.placed && s.mode === 'sit') s.sitAt(this.seatOf(e), s.timer);
      }
    }
    if (this.decorFor !== null) this.refreshGhost();
  }

  // -------------------------------------------------------------------------
  // Cámara e input
  // -------------------------------------------------------------------------

  private setupCamera(): void {
    const cam = this.cameras.main;
    const center = project(MAP_W / 2, MAP_H / 2);
    const worldW = (MAP_W + MAP_H) * 16;
    cam.setZoom(Phaser.Math.Clamp((this.scale.width / worldW) * 1.1, 1, 3));
    this.targetZoom = cam.zoom;
    cam.centerOn(center.x, center.y - 20);
  }

  /** Zoom que se acerca suave a su objetivo manteniendo fijo el punto bajo el mouse; inercia al soltar. */
  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    if (cam.zoomEffect.isRunning || cam.panEffect.isRunning) {
      this.targetZoom = cam.zoom;
      return;
    }
    if (Math.abs(this.targetZoom - cam.zoom) > 0.001) {
      const k = 1 - Math.pow(0.0001, dt / 1000);
      const a = this.zoomAnchor ?? { x: cam.width / 2, y: cam.height / 2 };
      const before = cam.getWorldPoint(a.x, a.y);
      cam.setZoom(cam.zoom + (this.targetZoom - cam.zoom) * Math.min(1, k * 1.4));
      const after = cam.getWorldPoint(a.x, a.y);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
    }
    if (!this.dragging && (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.y) > 0.01)) {
      cam.scrollX -= (this.velocity.x * dt) / cam.zoom;
      cam.scrollY -= (this.velocity.y * dt) / cam.zoom;
      const decay = Math.pow(0.004, dt / 1000);
      this.velocity.x *= decay;
      this.velocity.y *= decay;
    }
  }

  private setupInput(): void {
    const cam = this.cameras.main;
    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStart = { x: p.x, y: p.y };
      this.dragging = false;
      this.velocity = { x: 0, y: 0 };
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && this.dragStart) {
        if (!this.dragging && Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) > 5) this.dragging = true;
        if (this.dragging) {
          const dx = p.x - p.prevPosition.x;
          const dy = p.y - p.prevPosition.y;
          cam.scrollX -= dx / cam.zoom;
          cam.scrollY -= dy / cam.zoom;
          const dtm = Math.max(8, this.game.loop.delta);
          this.velocity = { x: (dx / dtm) * 0.6 + this.velocity.x * 0.4, y: (dy / dtm) * 0.6 + this.velocity.y * 0.4 };
        }
      }
      this.onHover(p);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const wasDrag = this.dragging;
      this.dragStart = null;
      this.time.delayedCall(0, () => (this.dragging = false));
      if (wasDrag) return;
      this.velocity = { x: 0, y: 0 };
      if (p.rightButtonReleased()) {
        if (this.decorFor !== null) this.cancelDecorAction();
        return;
      }
      const { tx, ty } = this.tileUnder(p);
      if (this.decorFor !== null) {
        this.decorClick(tx, ty);
        return;
      }
      if (over.length > 0) return;
      this.walkMeTo(tx, ty);
    });

    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAnchor = { x: p.x, y: p.y };
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom * (dy > 0 ? 0.85 : 1.18), 0.9, 6);
    });

    this.input.keyboard?.on('keydown-R', () => this.rotateDecor());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.decorFor === null) return;
      if (this.decorPick !== null || this.decorHeld !== null) this.cancelDecorAction();
      else bridge.emit('decor:mode', null);
    });
    this.input.keyboard?.on('keydown-DELETE', () => this.storeHeld());
  }

  private tileUnder(p: Phaser.Input.Pointer): { tx: number; ty: number } {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return screenToTile(w.x, w.y);
  }

  private onHover(p: Phaser.Input.Pointer): void {
    const { tx, ty } = this.tileUnder(p);
    const inside = tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
    this.hover.setVisible(inside && this.decorFor === null);
    if (inside) {
      const t = tileTop(tx, ty);
      this.hover.setPosition(t.x, t.y);
    }
    if (this.decorFor !== null) this.moveGhost(tx, ty);
  }

  private walkMeTo(tx: number, ty: number): void {
    const me = getState().currentUserId;
    const s = me ? this.sprites.get(me) : undefined;
    if (s === undefined || roomAt(tx, ty) === null) return;
    const seat = this.seatOf(s.employee);
    if (tx === seat.x && ty === seat.y) {
      this.goTo(s, seat, () => s.sitAt(seat, 60_000));
      return;
    }
    if (this.blocked.has(`${tx},${ty}`)) return;
    const path = findPath(s.tile, { x: tx, y: ty }, this.blocked);
    if (path === null) return;
    s.walk(path, () => s.idle(45_000));
    const t = tileTop(tx, ty);
    const mark = this.add.image(t.x, t.y, 'tile_hl').setOrigin(0.5, 0).setScale(INV).setDepth(2).setTint(0xffd25a);
    this.tweens.add({ targets: mark, alpha: 0, duration: 600, onComplete: () => mark.destroy() });
  }

  private focusOn(id: string, zoom = 3): void {
    const s = this.sprites.get(id);
    if (s === undefined) return;
    const p = project(s.fx, s.fy);
    const cam = this.cameras.main;
    this.velocity = { x: 0, y: 0 };
    cam.pan(p.x, p.y - 14, 700, 'Cubic.easeInOut');
    cam.zoomTo(Math.max(cam.zoom, zoom), 700, 'Cubic.easeInOut');
  }

  // -------------------------------------------------------------------------
  // Modo decoración
  // -------------------------------------------------------------------------

  private me(): Employee | undefined {
    return this.decorFor ? getState().employees[this.decorFor] : undefined;
  }

  private setDecor(id: string | null): void {
    this.cancelDecorAction();
    if (this.decorFor !== null && this.decorChanged) announceDecor(this.decorFor);
    this.decorChanged = false;
    for (const m of this.plotMarks) m.destroy();
    this.plotMarks = [];
    this.decorFor = id;
    const e = this.me();
    if (e === undefined) {
      this.decorFor = null;
      return;
    }
    const r = plotRect(e.dept, e.plot);
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const t = tileTop(x, y);
        const m = this.add.image(t.x, t.y, 'tile_hl').setOrigin(0.5, 0).setScale(INV).setDepth(1.5).setTint(0x8fe3ff).setAlpha(0);
        this.tweens.add({ targets: m, alpha: 0.6, duration: 250, delay: (x - r.x + y - r.y) * 25 });
        this.plotMarks.push(m);
      }
    }
    const c = project(r.x + r.w / 2, r.y + r.h / 2);
    this.velocity = { x: 0, y: 0 };
    this.cameras.main.pan(c.x, c.y - 12, 700, 'Cubic.easeInOut');
    this.cameras.main.zoomTo(4, 700, 'Cubic.easeInOut');
    bridge.emit(
      'decor:hint',
      L(
        `Elige un objeto de tu bodega y déjalo en tu puesto o en cualquier sala (menos ${ROOMS.gerencia.name}). Clic en uno tuyo para moverlo.`,
        `Pick an item from your storage and drop it at your desk or in any room (except ${ROOMS.gerencia.name}). Click one of yours to move it.`,
      ),
    );
  }

  private pickForDecor(itemId: string | null): void {
    if (this.decorFor === null) return;
    this.cancelDecorAction();
    this.decorPick = itemId;
    this.decorRot = 0;
    if (itemId !== null) {
      bridge.emit('decor:hint', L(`Colocando ${ITEM_BY_ID[itemId].name}: clic para dejarlo · R gira · Esc cancela`, `Placing ${ITEM_BY_ID[itemId].name}: click to drop · R rotates · Esc cancels`));
      this.refreshGhost();
    }
  }

  private rotateDecor(): void {
    if (this.decorFor === null || (this.decorPick === null && this.decorHeld === null)) return;
    this.decorRot = this.decorRot === 0 ? 1 : 0;
    this.refreshGhost();
  }

  private cancelDecorAction(): void {
    if (this.decorHeld !== null && this.decorFor !== null) {
      this.plotItemSprites.get(this.decorFor)?.get(this.decorHeld.uid)?.setVisible(true);
    }
    this.decorPick = null;
    this.decorHeld = null;
    this.ghost?.destroy();
    this.ghost = null;
    bridge.emit('decor:holding', null);
  }

  private currentGhostItem(): string | null {
    return this.decorPick ?? this.decorHeld?.itemId ?? null;
  }

  private refreshGhost(): void {
    const id = this.currentGhostItem();
    if (id === null) {
      this.ghost?.destroy();
      this.ghost = null;
      return;
    }
    const key = itemKey(id, this.decorRot);
    if (this.ghost === null) this.ghost = this.add.image(0, 0, key).setAlpha(0.85).setScale(INV);
    this.ghost.setTexture(key);
    const o = itemOrigin(id, this.decorRot);
    this.ghost.setOrigin(o.ox, o.oy);
    this.moveGhost(this.lastGhostTile.tx, this.lastGhostTile.ty);
  }

  private moveGhost(tx: number, ty: number): void {
    this.lastGhostTile = { tx, ty };
    const id = this.currentGhostItem();
    const e = this.me();
    if (this.ghost === null || id === null || e === undefined) return;
    const r = plotRect(e.dept, e.plot);
    const t = tileTop(tx, ty);
    this.ghost.setPosition(t.x, t.y);
    this.ghost.setDepth(800_000);
    const ok = canPlace(getState(), e, id, tx - r.x, ty - r.y, this.decorRot, this.decorHeld?.uid);
    this.ghost.setTint(ok ? 0xb8ffc0 : 0xff8080);
    this.ghost.setVisible(tx >= 0 && ty >= 0);
  }

  private decorClick(tx: number, ty: number): void {
    const e = this.me();
    if (e === undefined) return;
    const r = plotRect(e.dept, e.plot);
    const rx = tx - r.x;
    const ry = ty - r.y;

    if (this.decorPick !== null) {
      const id = this.decorPick;
      const res = placeFromInventory(id, rx, ry, this.decorRot);
      bridge.emit('decor:hint', res.message);
      if (res.ok) {
        this.decorChanged = true;
        this.puff(tx, ty, id);
        const left = getState().employees[e.id].inventory[id] ?? 0;
        if (left === 0) this.cancelDecorAction();
      }
      return;
    }

    if (this.decorHeld !== null) {
      const held = this.decorHeld;
      const res = moveItem(held.uid, rx, ry, this.decorRot);
      bridge.emit('decor:hint', res.message);
      if (res.ok) {
        this.decorHeld = null;
        this.ghost?.destroy();
        this.ghost = null;
        bridge.emit('decor:holding', null);
        this.decorChanged = true;
        this.puff(tx, ty, held.itemId, held.uid);
      }
      return;
    }

    // Sus objetos pueden estar en su puesto o repartidos por la oficina.
    const hits = e.placed.filter((p) => {
      const f = footprint(p.itemId, p.x, p.y, p.rot);
      return rx >= f.x && ry >= f.y && rx < f.x + f.w && ry < f.y + f.d;
    });
    const target = hits.find((p) => !ITEM_BY_ID[p.itemId].flat) ?? hits[0];
    if (target === undefined) return;
    this.decorHeld = target;
    this.decorRot = target.rot;
    this.plotItemSprites.get(e.id)?.get(target.uid)?.setVisible(false);
    bridge.emit('decor:holding', target.uid);
    bridge.emit('decor:hint', L(`Moviendo ${ITEM_BY_ID[target.itemId].name}: clic para dejarlo · R gira · Supr guarda en bodega`, `Moving ${ITEM_BY_ID[target.itemId].name}: click to drop · R rotates · Delete puts it in storage`));
    this.refreshGhost();
  }

  private storeHeld(): void {
    if (this.decorHeld === null) return;
    const uid = this.decorHeld.uid;
    this.decorHeld = null;
    this.ghost?.destroy();
    this.ghost = null;
    const res = storeItem(uid);
    if (res.ok) this.decorChanged = true;
    bridge.emit('decor:holding', null);
    bridge.emit('decor:hint', res.message);
  }

  /** Al dejar un objeto: rebote del mueble y estrellitas (más para los legendarios). */
  private puff(tx: number, ty: number, itemId: string, uid?: string): void {
    // Lo recién colocado ya entra con su propia animación (dropIn); esto es para lo que se mueve.
    if (uid === undefined) {
      if (LEGENDARY.has(itemId)) this.cameras.main.flash(220, 255, 226, 150);
      return;
    }
    const e = this.me();
    if (e !== undefined) {
      const img = this.plotItemSprites.get(e.id)?.get(uid);
      if (img) {
        img.setScale(INV * 0.85, INV * 1.15);
        this.tweens.add({ targets: img, scaleX: INV, scaleY: INV, duration: 420, ease: 'Elastic.Out' });
      }
    }
    const legendary = LEGENDARY.has(itemId);
    const c = project(tx + 0.5, ty + 0.5);
    const n = legendary ? 14 : 7;
    for (let k = 0; k < n; k++) {
      const star = this.add.image(c.x, c.y - 6, legendary ? 'spark' : 'star').setDepth(900_000).setScale(0.5);
      const a = (Math.PI * 2 * k) / n;
      this.tweens.add({
        targets: star,
        x: c.x + Math.cos(a) * 18,
        y: c.y - 6 + Math.sin(a) * 9,
        alpha: 0,
        scale: 0.9,
        duration: 600,
        ease: 'Quad.Out',
        onComplete: () => star.destroy(),
      });
    }
    if (legendary) this.cameras.main.flash(220, 255, 226, 150);
  }

  // -------------------------------------------------------------------------
  // Efectos
  // -------------------------------------------------------------------------

  private headOf(id: string): { x: number; y: number } | null {
    const s = this.sprites.get(id);
    if (s === undefined) return null;
    const p = project(s.fx, s.fy);
    return { x: p.x, y: p.y - 34 };
  }

  private fxCoins(id: string, amount: number): void {
    const h = this.headOf(id);
    if (h === null) return;
    // Los premios grandes se celebran con un saltito.
    if (amount >= 15) this.sprites.get(id)?.hop();
    const label = crispText(this, h.x + 3, h.y, `+${amount}`, {
      fontFamily: NUM_FONT,
      fontSize: '9px',
      fontStyle: '900',
      color: '#ffd25a',
      stroke: '#1b1d26',
      strokeThickness: 2.5,
    })
      .setOrigin(0, 1)
      .setDepth(1_300_000);
    const coin = this.add.image(h.x - 3, h.y - 5, 'coin').setDepth(1_300_000);
    this.tweens.add({ targets: [label, coin], y: '-=24', duration: 1700, ease: 'Cubic.Out' });
    this.tweens.add({
      targets: [label, coin],
      alpha: 0,
      delay: 1200,
      duration: 500,
      onComplete: () => {
        label.destroy();
        coin.destroy();
      },
    });
    const n = Math.min(16, 4 + Math.floor(amount / 10));
    for (let k = 0; k < n; k++) {
      const c = this.add.image(h.x, h.y + 8, 'coin').setDepth(1_299_000).setScale(0.7);
      this.tweens.add({ targets: c, x: h.x + rand(-24, 24), angle: rand(-180, 180), duration: 800, ease: 'Sine.Out' });
      this.tweens.add({
        targets: c,
        y: h.y - rand(12, 30),
        duration: 360,
        ease: 'Quad.Out',
        yoyo: true,
        onComplete: () => this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() }),
      });
    }
    this.sprites.get(id)?.say(amount >= 50 ? L('¡Wiii, gracias! 🤩', 'Woohoo, thanks! 🤩') : L('¡Gracias! 😄', 'Thanks! 😄'), 3000);
  }

  private fxLevel(id: string, level: number): void {
    const h = this.headOf(id);
    if (h === null) return;
    const sl = this.sprites.get(id);
    sl?.hop();
    if (sl?.mode === 'idle') sl.gesture('stretch', 1400);
    const t = crispText(this, h.x, h.y - 16, L(`¡NIVEL ${level}!`, `LEVEL ${level}!`), {
      fontSize: '10px',
      fontStyle: '900',
      color: '#ffffff',
      backgroundColor: '#8e5bd6',
      padding: { x: 5, y: 2 },
    })
      .setOrigin(0.5, 1)
      .setDepth(1_400_000)
      .setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 450, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: '-=16', delay: 2400, duration: 600, onComplete: () => t.destroy() });
    for (let k = 0; k < 12; k++) {
      const s = this.add.image(h.x, h.y, 'star').setDepth(1_350_000);
      const a = (Math.PI * 2 * k) / 12;
      this.tweens.add({
        targets: s,
        x: h.x + Math.cos(a) * 34,
        y: h.y + Math.sin(a) * 18,
        alpha: 0,
        angle: 180,
        duration: 1100,
        ease: 'Cubic.Out',
        onComplete: () => s.destroy(),
      });
    }
    if (id === getState().currentUserId) this.cameras.main.flash(260, 255, 236, 170);
  }

  private fxKudos(fromId: string, toId: string): void {
    this.fly(fromId, toId, this.add.image(0, 0, 'heart').setScale(1.2), () => {
      const from = getState().employees[fromId];
      const to = this.sprites.get(toId);
      to?.hop();
      to?.say(L(`¡Gracias${from ? `, ${from.name.split(' ')[0]}` : ''}! 💖`, `Thanks${from ? `, ${from.name.split(' ')[0]}` : ''}! 💖`), 3500);
      if (to?.mode === 'idle') to.gesture('wave', 1500);
    });
    this.sprites.get(fromId)?.say(L('¡Bien hecho! 👏', 'Well done! 👏'), 2500);
  }

  private fxGift(fromId: string, toId: string, itemId: string): void {
    // Adornos del vestuario no tienen sprite propio: vuela una caja de regalo.
    const icon = ITEM_BY_ID[itemId] ? this.add.image(0, 0, itemKey(itemId, 0)).setScale(INV * 0.8) : this.add.image(0, 0, 'star').setScale(1.4).setTint(0xff6fb0);
    this.fly(fromId, toId, icon, () => {
      this.sprites.get(toId)?.say(L(`¡Un regalo! 🎁 ${ITEM_BY_ID[itemId]?.name ?? ''}`, `A gift! 🎁 ${ITEM_BY_ID[itemId]?.name ?? ''}`), 4000);
      this.fxSparks(toId);
    });
    this.sprites.get(fromId)?.say('🎁', 2500);
  }

  /** Destello dorado alrededor de la cabeza (al recibir un regalo). */
  private fxSparks(id: string): void {
    const h = this.headOf(id);
    if (h === null) return;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = this.add.image(h.x, h.y, 'spark').setDepth(1_300_000).setScale(0.8);
      this.tweens.add({
        targets: s,
        x: h.x + Math.cos(a) * 30,
        y: h.y + Math.sin(a) * 16,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.Out',
        onComplete: () => s.destroy(),
      });
    }
  }

  /** Cámara a una sala (construida o en obra). */
  private showRoom(id: string, zoom = true): void {
    const room = ROOM_BY_ID[id as keyof typeof ROOM_BY_ID];
    if (room === undefined) return;
    const r = room.rect;
    const c = project(r.x + r.w / 2, r.y + r.h / 2);
    const cam = this.cameras.main;
    this.velocity = { x: 0, y: 0 };
    cam.pan(c.x, c.y - 10, 900, 'Cubic.easeInOut');
    if (zoom) cam.zoomTo(Phaser.Math.Clamp(this.scale.width / ((r.w + r.h) * 16 * 1.3), 1.4, 3.5), 900, 'Cubic.easeInOut');
  }

  /** Inauguración de una ampliación: la cámara viaja a la zona nueva entre fuegos artificiales. */
  private celebrateRoom(r: Rect): void {
    const c = project(r.x + r.w / 2, r.y + r.h / 2);
    const cam = this.cameras.main;
    cam.pan(c.x, c.y - 10, 1400, 'Cubic.easeInOut');
    cam.zoomTo(Phaser.Math.Clamp(this.scale.width / ((r.w + r.h) * 16 * 1.2), 1.4, 3), 1400, 'Cubic.easeInOut');
    cam.flash(500, 255, 240, 200);
    const colors = [0xffd25a, 0xff6fb0, 0x5ff2ff, 0x8fe38f, 0xb07ce8];
    for (let k = 0; k < 9; k++) {
      this.time.delayedCall(700 + k * 380, () => {
        const p = project(r.x + rand(1, r.w - 1), r.y + rand(1, r.h - 1));
        this.firework(p.x, p.y - rand(30, 60), pick(colors));
      });
    }
    // Las baldosas aparecen en ola.
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const t = this.floorTiles.get(`${x},${y}`);
        if (t === undefined) continue;
        t.setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, duration: 300, delay: 200 + (x - r.x + y - r.y) * 35 });
      }
    }
  }

  private firework(x: number, y: number, color: number): void {
    const n = 18;
    for (let k = 0; k < n; k++) {
      const a = (Math.PI * 2 * k) / n;
      const s = this.add.image(x, y, 'spark').setDepth(1_400_000).setTint(color).setScale(0.7);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * rand(22, 34),
        y: y + Math.sin(a) * rand(22, 34) + 10,
        alpha: 0,
        scale: 0.2,
        duration: rand(900, 1300),
        ease: 'Quad.Out',
        onComplete: () => s.destroy(),
      });
    }
    const flash = this.light('light_white', x, y, 90, 0.5, 1_399_000);
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
  }

  /** Logro desbloqueado: trofeo que sube con anillo de estrellas. */
  private fxAchievement(id: string, achId: string): void {
    const h = this.headOf(id);
    const a = ACHIEVEMENTS.find((x) => x.id === achId);
    if (h === null || a === undefined) return;
    const t = crispText(this, h.x, h.y - 6, `${a.icon} ${a.name}`, {
      fontFamily: NUM_FONT,
      fontSize: '7px',
      fontStyle: '900',
      color: '#1b1d26',
      backgroundColor: '#ffd25a',
      padding: { x: 4, y: 2 },
    })
      .setOrigin(0.5, 1)
      .setDepth(1_400_000)
      .setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 500, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: '-=18', alpha: 0, delay: 2600, duration: 700, onComplete: () => t.destroy() });
    const ring = this.add.graphics().setDepth(1_350_000);
    const state = { r: 4, a: 1 };
    this.tweens.add({
      targets: state,
      r: 40,
      a: 0,
      duration: 900,
      ease: 'Cubic.Out',
      onUpdate: () => ring.clear().lineStyle(2, 0xffd25a, state.a).strokeEllipse(h.x, h.y, state.r * 2, state.r),
      onComplete: () => ring.destroy(),
    });
    this.fxSparks(id);
  }

  /** Compra: el objeto aparece flotando sobre la cabeza con un "¡Nuevo!". */
  private fxPurchase(id: string, itemId: string): void {
    const h = this.headOf(id);
    if (h === null) return;
    const objs: Phaser.GameObjects.GameObject[] = [];
    if (ITEM_BY_ID[itemId]) {
      const icon = this.add.image(h.x, h.y - 4, itemKey(itemId, 0)).setOrigin(0.5, 1).setScale(0).setDepth(1_350_000);
      this.tweens.add({ targets: icon, scale: INV * 0.75, duration: 450, ease: 'Back.Out' });
      objs.push(icon);
    } else {
      const c = COSMETIC_BY_ID[itemId];
      const icon = crispText(this, h.x, h.y - 4, c?.slot === 'hat' ? '🎩' : c?.slot === 'face' ? '🕶️' : '🎀', { fontSize: '12px' })
        .setOrigin(0.5, 1)
        .setDepth(1_350_000)
        .setScale(0);
      this.tweens.add({ targets: icon, scale: 1, duration: 450, ease: 'Back.Out' });
      objs.push(icon);
    }
    const tag = crispText(this, h.x, h.y - 2, L('¡NUEVO!', 'NEW!'), {
      fontFamily: NUM_FONT,
      fontSize: '6px',
      fontStyle: '900',
      color: '#ffffff',
      backgroundColor: '#e86fa8',
      padding: { x: 3, y: 1 },
    })
      .setOrigin(0.5, 0)
      .setDepth(1_360_000);
    objs.push(tag);
    this.tweens.add({ targets: objs, y: '-=14', delay: 300, duration: 1600, ease: 'Sine.Out' });
    this.tweens.add({ targets: objs, alpha: 0, delay: 1800, duration: 500, onComplete: () => objs.forEach((o) => o.destroy()) });
    for (let k = 0; k < 6; k++) {
      const s = this.add.image(h.x + rand(-14, 14), h.y - rand(4, 22), 'spark').setDepth(1_355_000).setScale(0).setTint(0xffd25a);
      this.tweens.add({ targets: s, scale: 0.8, alpha: 0, delay: k * 90, duration: 700, onComplete: () => s.destroy() });
    }
  }

  /** Aporte al fondo: monedas que vuelan desde la persona hasta el letrero de la obra. */
  private fxContribute(id: string, amount: number): void {
    const a = this.headOf(id);
    const target = this.construction;
    if (a === null || target === null) return;
    const n = Math.min(14, 3 + Math.floor(amount / 25));
    for (let k = 0; k < n; k++) {
      const coin = this.add.image(a.x, a.y, 'coin').setDepth(1_300_000).setScale(0.8);
      const mid = { x: (a.x + target.x) / 2 + rand(-30, 30), y: Math.min(a.y, target.y) - rand(30, 70) };
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(a.x, a.y),
        new Phaser.Math.Vector2(mid.x, mid.y),
        new Phaser.Math.Vector2(target.x, target.y),
      );
      const f = { t: 0 };
      this.tweens.add({
        targets: f,
        t: 1,
        delay: k * 70,
        duration: 1100,
        ease: 'Sine.InOut',
        onUpdate: () => {
          const p = curve.getPoint(f.t);
          coin.setPosition(p.x, p.y);
        },
        onComplete: () => {
          coin.destroy();
          if (k === n - 1 && this.construction) {
            const lbl = this.construction.label;
            this.tweens.add({ targets: lbl, scale: 1.15, duration: 120, yoyo: true });
          }
        },
      });
    }
    this.sprites.get(id)?.say(L(`🏗️ +${amount} para la oficina`, `🏗️ +${amount} for the office`), 3000);
  }

  /** Lleva `obj` de la cabeza de una persona a la de otra en arco y lo hace estallar al llegar. */
  private fly(fromId: string, toId: string, obj: Phaser.GameObjects.Image, onArrive: () => void): void {
    const a = this.headOf(fromId);
    const b = this.headOf(toId);
    if (a === null || b === null) {
      obj.destroy();
      if (b !== null) onArrive();
      return;
    }
    const heart = obj.setPosition(a.x, a.y).setDepth(1_300_000);
    const endScale = heart.scale * 2;
    const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 40 };
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(a.x, a.y),
      new Phaser.Math.Vector2(mid.x, mid.y),
      new Phaser.Math.Vector2(b.x, b.y),
    );
    const follower = { t: 0 };
    this.tweens.add({
      targets: follower,
      t: 1,
      duration: Math.min(1800, 500 + Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) * 2),
      ease: 'Sine.InOut',
      onUpdate: () => {
        const p = curve.getPoint(follower.t);
        heart.setPosition(p.x, p.y);
      },
      onComplete: () => {
        this.tweens.add({ targets: heart, scale: endScale, alpha: 0, duration: 400, onComplete: () => heart.destroy() });
        onArrive();
      },
    });
    const view = this.cameras.main.worldView;
    if (!view.contains(b.x, b.y)) this.focusOn(toId, this.cameras.main.zoom);
  }
}
