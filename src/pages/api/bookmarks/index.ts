import type { APIRoute } from 'astro';
import {
  createBookmark,
  listBookmarks,
  normalizeBookmarkUrl,
  validBookmarkChannel,
} from '../../../server/bookmarks';

const headers = { 'Cache-Control': 'no-store' };

export const GET: APIRoute = async ({ url }) => {
  const channel = url.searchParams.get('channel');
  if (!validBookmarkChannel(channel)) {
    return Response.json({ error: 'INVALID_CHANNEL' }, { status: 400, headers });
  }
  try {
    return Response.json({ bookmarks: await listBookmarks(channel) }, { headers });
  } catch (error) {
    console.error('Unable to load bookmarks', error);
    return Response.json({ error: 'LOAD_FAILED' }, { status: 500, headers });
  }
};

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400, headers });
  }

  const channel = typeof body.channel === 'string' ? body.channel : undefined;
  const url = typeof body.url === 'string' ? normalizeBookmarkUrl(body.url) : undefined;
  let title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!validBookmarkChannel(channel) || !url || title.length > 160) {
    return Response.json({ error: 'INVALID_BOOKMARK' }, { status: 422, headers });
  }
  if (!title) title = new URL(url).hostname.replace(/^www\./, '');

  try {
    return Response.json({ bookmark: await createBookmark(channel, { title, url }) }, { status: 201, headers });
  } catch (error) {
    console.error('Unable to create bookmark', error);
    return Response.json({ error: 'CREATE_FAILED' }, { status: 500, headers });
  }
};
