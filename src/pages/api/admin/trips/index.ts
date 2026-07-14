import type { APIRoute } from 'astro';
import { createTrip } from '../../../../server/database';
import { safeSlug } from '../../../../server/forms';
import type { TripStatus } from '../../../../server/types';

const statuses = new Set<TripStatus>(['upcoming', 'planning', 'archived']);

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const id = safeSlug(body.id);
  if (!id || !body.title?.trim() || !body.destination?.trim() || !statuses.has(body.status) || !body.startDate || !body.endDate) {
    return Response.json({ error: 'INVALID_TRIP' }, { status: 422 });
  }
  try {
    createTrip({
      id, title: String(body.title).trim(), destination: String(body.destination).trim(), status: body.status,
      startDate: String(body.startDate), endDate: String(body.endDate), summary: String(body.summary ?? ''),
    });
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error && error.message === 'INVALID_STATUS' ? 'INVALID_STATUS' : 'CREATE_FAILED' }, { status: 500 });
  }
};
