import type { APIRoute } from 'astro';
import { deleteTrip, listTripPhotoIds, updateTrip } from '../../../../server/database';
import { deletePhotoFiles } from '../../../../server/media';
import type { TripStatus } from '../../../../server/types';

const statuses = new Set<TripStatus>(['upcoming', 'planning', 'archived']);

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  if (!body.title?.trim() || !body.destination?.trim() || !statuses.has(body.status) || !body.startDate || !body.endDate) {
    return Response.json({ error: 'INVALID_TRIP' }, { status: 422 });
  }
  const pendingItems = Array.isArray(body.pendingItems) ? body.pendingItems.filter((item): item is string => typeof item === 'string') : [];
  try {
    updateTrip(id, {
      title: String(body.title).trim(), destination: String(body.destination).trim(), status: body.status,
      startDate: String(body.startDate), endDate: String(body.endDate), summary: String(body.summary ?? ''),
      pendingItems, body: typeof body.body === 'string' ? body.body : '', draft: Boolean(body.draft), featured: Boolean(body.featured),
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  for (const photoId of listTripPhotoIds(id)) await deletePhotoFiles(photoId);
  deleteTrip(id);
  return Response.json({ ok: true });
};
