import type { APIRoute } from 'astro';
import {
  createPasteboardItem,
  listPasteboardItems,
  validPasteboardChannel,
  type PasteboardItem,
} from '../../../server/pasteboard';

const jsonHeaders = { 'Cache-Control': 'no-store' };
const validTypes = new Set<PasteboardItem['type']>(['text', 'link', 'code', 'json']);

export const GET: APIRoute = async ({ url }) => {
  const channel = url.searchParams.get('channel');
  if (!validPasteboardChannel(channel)) {
    return Response.json({ error: 'INVALID_CHANNEL' }, { status: 400, headers: jsonHeaders });
  }
  try {
    const items = await listPasteboardItems(channel);
    return Response.json({ items }, { headers: jsonHeaders });
  } catch (error) {
    console.error('Unable to load pasteboard items', error);
    return Response.json({ error: 'LOAD_FAILED' }, { status: 500, headers: jsonHeaders });
  }
};
export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400, headers: jsonHeaders });
  }

  const channel = typeof body.channel === 'string' ? body.channel : undefined;
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const type = typeof body.type === 'string' && validTypes.has(body.type as PasteboardItem['type'])
    ? body.type as PasteboardItem['type']
    : 'text';
  if (!validPasteboardChannel(channel) || !content || content.length > 20_000) {
    return Response.json({ error: 'INVALID_ITEM' }, { status: 422, headers: jsonHeaders });
  }

  try {
    const item = await createPasteboardItem(channel, { content, type });
    return Response.json({ item }, { status: 201, headers: jsonHeaders });
  } catch (error) {
    console.error('Unable to create pasteboard item', error);
    return Response.json({ error: 'CREATE_FAILED' }, { status: 500, headers: jsonHeaders });
  }
};
