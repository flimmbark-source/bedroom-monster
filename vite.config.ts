import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const base = process.env.NODE_ENV === 'production' ? '/bedroom-monster/' : '/';

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
      '@game': fileURLToPath(new URL('./src/game', import.meta.url)),
      '@monsters': fileURLToPath(new URL('./src/monsters', import.meta.url)),
      '@scenes': fileURLToPath(new URL('./src/scenes', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
});
