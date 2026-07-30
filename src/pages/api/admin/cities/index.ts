import type { APIRoute } from 'astro';
import { createCityPlace } from '../../../../server/database';
import { citySlugs } from '../../../../data/cities';
import { safeSlug } from '../../../../server/forms';
import type { CitySlug } from '../../../../server/types';

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const id = safeSlug(body.id);
  const city = String(body.city ?? '') as CitySlug;
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!id || !citySlugs.has(city) || !body.name?.trim() || !body.type?.trim()
    || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: 'INVALID_PLACE' }, { status: 422 });
  }
  try {
    await createCityPlace({
      id,
      city,
      name: String(body.name).trim(),
      type: String(body.type).trim(),
      district: body.district?.trim() || undefined,
      lat,
      lng,
      note: body.note?.trim() || undefined,
      draft: Boolean(body.draft),
    });
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'CREATE_FAILED' }, { status: 500 });
  }
};
