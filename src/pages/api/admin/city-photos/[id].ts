import type { APIRoute } from 'astro';
import { getCityPhoto, setCityCoverPhoto } from '../../../../server/database';
import { deleteCityPhotoFiles } from '../../../../server/media';

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  let body: { featured?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const photo = getCityPhoto(id);
  if (!photo) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (body.featured !== true || !setCityCoverPhoto(photo.placeId, id)) {
    return Response.json({ error: 'INVALID_UPDATE' }, { status: 422 });
  }
  return Response.json({ ok: true });
};

export const DELETE: APIRoute = async ({ params }) => {
  if (!params.id || !(await deleteCityPhotoFiles(params.id))) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  return Response.json({ ok: true });
};
