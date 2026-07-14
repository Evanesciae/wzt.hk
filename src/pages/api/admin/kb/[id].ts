import type { APIRoute } from 'astro';
import { deleteKbNote, updateKbNote } from '../../../../server/database';

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  if (!body.title?.trim() || !body.summary?.trim() || !body.category) {
    return Response.json({ error: 'INVALID_NOTE' }, { status: 422 });
  }
  try {
    updateKbNote(id, {
      title: String(body.title).trim(), summary: String(body.summary).trim(), category: String(body.category),
      tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : [],
      body: typeof body.body === 'string' ? body.body : '', draft: Boolean(body.draft), featured: Boolean(body.featured), strict: Boolean(body.strict),
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  if (!params.id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  deleteKbNote(params.id);
  return Response.json({ ok: true });
};
