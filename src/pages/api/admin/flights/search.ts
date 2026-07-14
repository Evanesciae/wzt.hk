import type { APIRoute } from 'astro';
import { searchFlights } from '../../../../server/flights';

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const flightNumber = String(body.flightNumber ?? '').trim().toUpperCase();
  const date = String(body.date ?? '').slice(0, 10);
  if (!flightNumber || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: 'INVALID_SEARCH' }, { status: 422 });
  try {
    const results = await searchFlights(flightNumber, date);
    return Response.json({
      provider: process.env.AVIATIONSTACK_API_KEY ? 'aviationstack' : 'demo',
      results,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'SEARCH_FAILED' }, { status: 502 });
  }
};
