import type { ScheduledController } from '@cloudflare/workers-types';
import { handle } from '@astrojs/cloudflare/handler';
import { runSync, type NtuEnv } from './server/ntu/service';
export default {
  fetch: handle,
  async scheduled(_event: ScheduledController, env: NtuEnv) {
    try { await runSync(env); } catch { console.error('NTU scheduled sync did not complete; inspect the private dashboard.'); }
  },
};
