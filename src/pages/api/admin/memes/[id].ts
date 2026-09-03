import type { APIRoute } from 'astro';
import { deleteMeme, updateMeme } from '../../../../server/memes';

export const PATCH: APIRoute = async ({ params, request }) => {
  if (!params.id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  try {
    await updateMeme(params.id, {
      title: String(body.title ?? '').trim().slice(0, 100),
      series: String(body.series ?? '').trim().slice(0, 30),
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  if (!params.id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  const deleted = await deleteMeme(params.id);
  return Response.json({ ok: deleted });
};
