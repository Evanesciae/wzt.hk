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
  vite: {
    build: { chunkSizeWarningLimit: 1100 },
  },
});
