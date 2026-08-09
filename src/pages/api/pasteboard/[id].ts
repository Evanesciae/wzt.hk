import type { APIRoute } from 'astro';
import { deletePasteboardItem, validPasteboardChannel } from '../../../server/pasteboard';

export const DELETE: APIRoute = async ({ params, url }) => {
  const channel = url.searchParams.get('channel');
  const id = params.id;
  if (!id || !validPasteboardChannel(channel)) {
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }
  try {
    const deleted = await deletePasteboardItem(channel, id);
    return Response.json({ ok: true, deleted }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to delete pasteboard item', error);
    return Response.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
};
