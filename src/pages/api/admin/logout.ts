import type { APIRoute } from 'astro';
import { clearSession } from '../../../server/auth';

export const POST: APIRoute = async ({ cookies }) => {
  await clearSession(cookies);
  return Response.json({ ok: true });
};
