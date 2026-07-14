import type { APIRoute } from 'astro';
import { deleteFlight } from '../../../../server/database';

export const DELETE: APIRoute = async ({ params }) => {
  if (!params.id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  deleteFlight(params.id);
  return Response.json({ ok: true });
};
