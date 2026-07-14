import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://wzt.hk',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  build: {
    format: 'directory',
  },
  vite: {
    // MapLibre is intentionally isolated in a lazy-loaded map chunk (~1 MB minified).
    build: { chunkSizeWarningLimit: 1100 },
  },
});
