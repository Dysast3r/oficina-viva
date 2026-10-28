import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { OfficeScene } from './scenes/OfficeScene';

/** Canvas de Phaser a pantalla completa; React dibuja la UI encima. */
export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      backgroundColor: '#121319',
      pixelArt: true,
      roundPixels: false,
      scale: { mode: Phaser.Scale.RESIZE, width: container.clientWidth, height: container.clientHeight },
      scene: [BootScene, OfficeScene],
      banner: false,
    });
    // Solo en desarrollo: acceso desde la consola para depurar.
    if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
    return () => game.destroy(true);
  }, []);

  return <div ref={containerRef} className="game-canvas" />;
}
