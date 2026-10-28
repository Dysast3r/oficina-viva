import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Puerto fijo poco común para no chocar con otros proyectos (3000, 5173...).
export default defineConfig({
  plugins: [react()],
  server: { port: 4460, strictPort: true },
  preview: { port: 4461, strictPort: true },
  // Phaser (~1,5 MB) va en su propio archivo: cambia poco y queda en caché.
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
