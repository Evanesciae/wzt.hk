import type { APIRoute } from 'astro';
import { deleteEvent, listEventPhotos, updateEvent } from '../../../../server/database';
import { parseLocation } from '../../../../server/forms';
import { deletePhotoFiles } from '../../../../server/media';
import type { EventType } from '../../../../server/types';

const types = new Set<EventType>(['place', 'transit', 'meal', 'stay', 'note']);

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  if (!body.title?.trim() || !types.has(body.type)) return Response.json({ error: 'INVALID_EVENT' }, { status: 422 });
  updateEvent(id, {
    type: body.type, title: String(body.title).trim(), time: body.time || undefined,
    note: body.note || undefined, location: parseLocation(body), data: body.data && typeof body.data === 'object' ? body.data : {},
  });
  return Response.json({ ok: true });
};

export const DELETE: APIRoute = async ({ params }) => {
  if (!params.id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  for (const photo of listEventPhotos(params.id)) await deletePhotoFiles(photo.id);
  deleteEvent(params.id);
  return Response.json({ ok: true });
};
