import type { APIRoute } from 'astro';
import { reorderDays } from '../../../../../../server/database';

export const PUT: APIRoute = async ({ params, request }) => {
  const tripId = params.id;
  if (!tripId) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  let body: { dayIds?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const dayIds = Array.isArray(body.dayIds) ? body.dayIds.filter((id): id is string => typeof id === 'string') : [];
  if (dayIds.length === 0) return Response.json({ error: 'INVALID_ORDER' }, { status: 422 });
  reorderDays(tripId, dayIds);
  return Response.json({ ok: true });
};
