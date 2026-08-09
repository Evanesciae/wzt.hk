import type { APIRoute } from 'astro';
import { getPasteboardFile, validPasteboardChannel } from '../../../../server/pasteboard';

function asciiFileName(value: string) {
  const name = value.replace(/[\\/\r\n";]/g, '_').replace(/[^\x20-\x7e]/g, '_').slice(0, 160);
  return name || 'download';
}

export const GET: APIRoute = async ({ params, url, request }) => {
  const channel = url.searchParams.get('channel');
  const id = params.id;
  if (!id || !validPasteboardChannel(channel)) return new Response('Not found', { status: 404 });
  const file = await getPasteboardFile(channel, id);
  if (!file) return new Response('Not found', { status: 404 });
  if (request.headers.get('if-none-match') === file.object.httpEtag) return new Response(null, { status: 304 });
  const headers = new Headers();
  file.object.writeHttpMetadata(headers);
  headers.set('Content-Type', file.mimeType || 'application/octet-stream');
  headers.set('Content-Length', String(file.fileSize));
  headers.set('Content-Disposition', `attachment; filename="${asciiFileName(file.fileName)}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('ETag', file.object.httpEtag);
  return new Response(file.object.body, { headers });
};
