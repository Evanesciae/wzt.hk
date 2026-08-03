import type { APIRoute } from 'astro';
import { deleteCityPlace, listCityPlacePhotoIds, updateCityPlace } from '../../../../server/database';
import { deleteCityPhotoFiles } from '../../../../server/media';
import { cityPlaceTypeSet, citySlugs } from '../../../../data/cities';
import type { CityPlaceType, CitySlug } from '../../../../server/types';

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const city = String(body.city ?? '') as CitySlug;
  const type = String(body.type ?? '').trim() as CityPlaceType;
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!citySlugs.has(city) || !body.name?.trim() || !cityPlaceTypeSet.has(type)
    || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: 'INVALID_PLACE' }, { status: 422 });
  }
  try {
    await updateCityPlace(id, {
      city,
      name: String(body.name).trim(),
      type,
      district: body.district?.trim() || undefined,
      lat,
      lng,
      note: body.note?.trim() || undefined,
      draft: Boolean(body.draft),
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
  try {
    for (const photoId of await listCityPlacePhotoIds(id)) await deleteCityPhotoFiles(photoId);
    await deleteCityPlace(id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
};
