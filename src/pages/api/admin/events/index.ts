import type { APIRoute } from 'astro';
import { createEvent, type EventInput } from '../../../../server/database';
import { parseLocation } from '../../../../server/forms';
import type { EventType } from '../../../../server/types';

const types = new Set<EventType>(['place', 'transit', 'meal', 'stay', 'note']);

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  if (!body.dayId || !body.title?.trim() || !types.has(body.type)) {
    return Response.json({ error: 'INVALID_EVENT' }, { status: 422 });
  }
  const input: EventInput = {
    dayId: String(body.dayId), afterEventId: body.afterEventId ? String(body.afterEventId) : undefined,
    type: body.type, title: String(body.title).trim(), time: body.time || undefined,
    note: body.note || undefined, location: parseLocation(body), data: body.data && typeof body.data === 'object' ? body.data : {},
  };
  try { return Response.json({ ok: true, id: createEvent(input) }, { status: 201 }); }
  catch (error) { console.error(error); return Response.json({ error: 'CREATE_FAILED' }, { status: 500 }); }
};

