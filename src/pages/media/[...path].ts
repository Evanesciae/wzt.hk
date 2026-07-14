import type { APIRoute } from 'astro';
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { publicMediaPath } from '../../server/media';

export const GET: APIRoute = async ({ params, request }) => {
  if (!params.path) return new Response('Not found', { status: 404 });
  try {
    const path = publicMediaPath(params.path);
    const info = await stat(path);
    const etag = `"${info.size}-${Math.floor(info.mtimeMs)}"`;
    if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304 });
    const data = await readFile(path);
    const contentType = extname(path).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg';
    return new Response(data, {
      headers: { 'content-type': contentType, 'cache-control': 'public, max-age=31536000, immutable', etag },
    });
  } catch { return new Response('Not found', { status: 404 }); }
};
