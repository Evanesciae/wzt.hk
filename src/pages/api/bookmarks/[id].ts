import type { APIRoute } from 'astro';
import { deleteBookmark, validBookmarkChannel } from '../../../server/bookmarks';

export const DELETE: APIRoute = async ({ params, url }) => {
  const channel = url.searchParams.get('channel');
  const id = params.id;
  if (!id || !validBookmarkChannel(channel)) {
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }
  try {
    const deleted = await deleteBookmark(channel, id);
    return Response.json({ ok: true, deleted }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to delete bookmark', error);
    return Response.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
};
