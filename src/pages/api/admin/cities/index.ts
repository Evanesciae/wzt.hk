import type { APIRoute } from 'astro';
import { createCityPlace } from '../../../../server/database';
import { cityPlaceTypeSet, citySlugs } from '../../../../data/cities';
import { safeSlug } from '../../../../server/forms';
import type { CityPlaceType, CitySlug, CityVisitStatus } from '../../../../server/types';

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const id = safeSlug(body.id);
  const city = String(body.city ?? '') as CitySlug;
  const type = String(body.type ?? '').trim() as CityPlaceType;
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const visitStatus = String(body.visitStatus ?? 'want') as CityVisitStatus;
  const rating = body.rating === '' || body.rating == null ? undefined : Number(body.rating);
  if (!id || !citySlugs.has(city) || !body.name?.trim() || !cityPlaceTypeSet.has(type)
    || !['want', 'visited'].includes(visitStatus)
    || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180
    || (rating !== undefined && (!Number.isFinite(rating) || rating < 1 || rating > 5))) {
    return Response.json({ error: 'INVALID_PLACE' }, { status: 422 });
  }
  try {
    await createCityPlace({
      id,
      city,
      name: String(body.name).trim(),
      type,
      district: body.district?.trim() || undefined,
      lat,
      lng,
      note: body.note?.trim() || undefined,
      visitStatus,
      favorite: Boolean(body.favorite),
      recommendation: body.recommendation?.trim() || undefined,
      address: body.address?.trim() || undefined,
      tags: Array.isArray(body.tags) ? body.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 20) : [],
      rating,
      lastVisitedAt: body.lastVisitedAt || undefined,
      tripId: body.tripId || undefined,
      draft: Boolean(body.draft),
    });
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'CREATE_FAILED' }, { status: 500 });
  }
};
