import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://wzt.hk',
  output: 'server',
  adapter: cloudflare({
    imageService: 'cloudflare-binding',
    sessionKVBindingName: 'SESSION',
  }),
  build: {
    format: 'directory',
  },
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
  vite: {
    build: { chunkSizeWarningLimit: 1100 },
    server: { strictPort: true },
  },
});
