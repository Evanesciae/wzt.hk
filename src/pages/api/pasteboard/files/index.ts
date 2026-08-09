import type { APIRoute } from 'astro';
import { createPasteboardFile, validPasteboardChannel } from '../../../../server/pasteboard';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const headers = { 'Cache-Control': 'no-store' };

export const POST: APIRoute = async ({ request }) => {
  const declaredSize = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_FILE_SIZE + 1_000_000) {
    return Response.json({ error: 'FILE_TOO_LARGE' }, { status: 413, headers });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400, headers });
  }
  const channel = form.get('channel');
  const file = form.get('file');
  if (typeof channel !== 'string' || !validPasteboardChannel(channel) || !(file instanceof File)) {
    return Response.json({ error: 'INVALID_UPLOAD' }, { status: 422, headers });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'FILE_TOO_LARGE' }, { status: 413, headers });
  }
  try {
    const item = await createPasteboardFile(channel, file);
    return Response.json({ item }, { status: 201, headers });
  } catch (error) {
    console.error('Unable to upload pasteboard file', error);
    return Response.json({ error: 'UPLOAD_FAILED' }, { status: 500, headers });
  }
};
