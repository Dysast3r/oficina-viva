import * as Phaser from 'phaser';

/** Espera las fuentes antes de crear textos y letreros (si no, se usa la de respaldo). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const fonts = Promise.all([
      document.fonts.load('600 10px Nunito'),
      document.fonts.load('800 10px Nunito'),
      document.fonts.load('900 10px Nunito'),
    ]).catch(() => undefined);
    const timeout = new Promise((r) => setTimeout(r, 2500));
    // El juego puede destruirse mientras se espera (StrictMode monta dos veces).
    let alive = true;
    this.events.once(Phaser.Scenes.Events.DESTROY, () => (alive = false));
    void Promise.race([fonts, timeout]).then(() => {
      if (alive) this.scene.start('office');
    });
  }
}
