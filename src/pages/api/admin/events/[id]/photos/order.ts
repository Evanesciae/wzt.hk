import type { APIRoute } from 'astro';
import { reorderEventPhotos } from '../../../../../../server/database';

export const PUT: APIRoute = async ({ params, request }) => {
  const eventId = params.id;
  if (!eventId) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  let body: { photoIds?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const photoIds = Array.isArray(body.photoIds) ? body.photoIds.filter((id): id is string => typeof id === 'string') : [];
  if (photoIds.length === 0) return Response.json({ error: 'INVALID_ORDER' }, { status: 422 });
  reorderEventPhotos(eventId, photoIds);
  return Response.json({ ok: true });
};
