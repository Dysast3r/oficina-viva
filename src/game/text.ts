import * as Phaser from 'phaser';

/**
 * Texto que se ve nítido con `pixelArt: true` y zoom de cámara (técnica de
 * Agent-Quest): se renderiza a alta resolución y con filtro LINEAR, que
 * Phaser resetea en cada updateText, así que se reaplica.
 */
const RES = Math.max(6, Math.ceil((window.devicePixelRatio || 1) * 5));

export const UI_FONT = 'Nunito, "Segoe UI", sans-serif';
export const NUM_FONT = 'Nunito, "Segoe UI", sans-serif';

export function crispText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, { fontFamily: UI_FONT, resolution: RES, ...style });
  const linear = () => t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  linear();
  const original = t.updateText.bind(t);
  t.updateText = () => {
    const r = original();
    linear();
    return r;
  };
  return t;
}
