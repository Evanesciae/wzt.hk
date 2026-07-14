import type { APIRoute } from 'astro';
import { createDay } from '../../../../server/database';

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  if (!body.tripId || !body.date || !body.city?.trim()) return Response.json({ error: 'INVALID_DAY' }, { status: 422 });
  try {
    const id = createDay(String(body.tripId), {
      date: String(body.date), city: String(body.city).trim(),
      title: body.title?.trim() || undefined, summary: body.summary?.trim() || undefined,
    });
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'CREATE_FAILED' }, { status: 500 });
  }
};
