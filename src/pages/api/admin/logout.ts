import type { APIRoute } from 'astro';
import { clearSession } from '../../../server/auth';

export const POST: APIRoute = ({ cookies }) => {
  clearSession(cookies);
  return Response.json({ ok: true });
};
