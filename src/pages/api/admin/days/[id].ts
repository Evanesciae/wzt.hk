import type { APIRoute } from 'astro';
import { deleteDay, listDayPhotoIds, updateDay } from '../../../../server/database';
import { deletePhotoFiles } from '../../../../server/media';

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  if (!body.date || !body.city?.trim()) return Response.json({ error: 'INVALID_DAY' }, { status: 422 });
  try {
    updateDay(id, {
      date: String(body.date), city: String(body.city).trim(),
      title: body.title?.trim() || undefined, summary: body.summary?.trim() || undefined,
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
  for (const photoId of listDayPhotoIds(id)) await deletePhotoFiles(photoId);
  deleteDay(id);
  return Response.json({ ok: true });
};
