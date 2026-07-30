import type { APIRoute } from 'astro';
import { reorderCityPhotos } from '../../../../../../server/database';

export const PUT: APIRoute = async ({ params, request }) => {
  const placeId = params.id;
  if (!placeId) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  let body: { photoIds?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const photoIds = Array.isArray(body.photoIds) ? body.photoIds.filter((id): id is string => typeof id === 'string') : [];
  if (photoIds.length === 0) return Response.json({ error: 'INVALID_ORDER' }, { status: 422 });
  await reorderCityPhotos(placeId, photoIds);
  return Response.json({ ok: true });
};
