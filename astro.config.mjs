import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

const pasteboardDeployment = process.env.WZT_DEPLOY_TARGET === 'pasteboard';

export default defineConfig({
  site: pasteboardDeployment ? 'https://paste.wzt.hk' : 'https://wzt.hk',
  output: 'server',
  adapter: cloudflare({
    configPath: pasteboardDeployment ? './wrangler.pasteboard.jsonc' : undefined,
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
