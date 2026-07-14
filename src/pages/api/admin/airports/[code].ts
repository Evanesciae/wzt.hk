import type { APIRoute } from 'astro';
import { deleteAirport } from '../../../../server/database';

export const DELETE: APIRoute = async ({ params }) => {
  if (!params.code) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    deleteAirport(params.code);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DELETE_FAILED';
    return Response.json({ error: message }, { status: message === 'AIRPORT_IN_USE' ? 409 : 500 });
  }
};
