import type { APIRoute } from 'astro';
import { upsertFlight } from '../../../../server/database';
import type { FlightInput } from '../../../../server/database';

export const POST: APIRoute = async ({ request }) => {
  let body: FlightInput;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const precision = body.datePrecision ?? 'day';
  if ((precision !== 'unknown' && !body.date) || (!body.flightNumber && precision === 'day')
    || !body.fromAirport?.code || !body.toAirport?.code) {
    return Response.json({ error: 'INVALID_FLIGHT' }, { status: 422 });
  }
  try {
    const id = await upsertFlight(body);
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'CREATE_FAILED' }, { status: 500 });
  }
};
