import type { APIRoute } from 'astro';
import { upsertAirport } from '../../../../server/database';
import type { Airport } from '../../../../server/types';

export const POST: APIRoute = async ({ request }) => {
  let body: Airport;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  if (!body.code || !body.name || !body.city || !Number.isFinite(Number(body.lat)) || !Number.isFinite(Number(body.lng))) {
    return Response.json({ error: 'INVALID_AIRPORT' }, { status: 422 });
  }
  try {
    const code = upsertAirport({
      code: String(body.code).trim().toUpperCase(),
      icao: body.icao ? String(body.icao).trim().toUpperCase() : undefined,
      name: String(body.name).trim(),
      city: String(body.city).trim(),
      country: String(body.country ?? '').trim(),
      lat: Number(body.lat),
      lng: Number(body.lng),
      timezone: body.timezone ? String(body.timezone).trim() : undefined,
    });
    return Response.json({ ok: true, code }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'SAVE_FAILED' }, { status: 500 });
  }
};
