import type { APIRoute } from 'astro';
import { createKbNote } from '../../../../server/database';
import { safeSlug } from '../../../../server/forms';

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const id = safeSlug(body.id);
  if (!id || !body.title?.trim() || !body.summary?.trim() || !body.category) {
    return Response.json({ error: 'INVALID_NOTE' }, { status: 422 });
  }
  try {
    createKbNote(id, {
      title: String(body.title).trim(), summary: String(body.summary).trim(), category: String(body.category),
      tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : [],
      body: typeof body.body === 'string' ? body.body : '', draft: Boolean(body.draft), featured: Boolean(body.featured), strict: Boolean(body.strict),
    });
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'CREATE_FAILED' }, { status: 500 });
  }
};
