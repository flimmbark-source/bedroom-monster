import path from 'node:path';
import { defineConfig } from 'vite';

// If your repo is named something else, set base to "/<repo-name>/".
export default defineConfig({
  base: '/bedroom-monster/',
  resolve: {
    alias: {
      '@game': path.resolve(__dirname, 'src/game'),
      '@scenes': path.resolve(__dirname, 'src/scenes'),
      '@ui': path.resolve(__dirname, 'src/ui'),
    },
  },
});
