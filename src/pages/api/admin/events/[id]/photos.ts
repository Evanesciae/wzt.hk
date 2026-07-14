import type { APIRoute } from 'astro';
import { processUpload } from '../../../../../server/media';

export const POST: APIRoute = async ({ params, request }) => {
  if (!params.id) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  const form = await request.formData();
  const files = form.getAll('photos').filter((value): value is File => value instanceof File);
  if (files.length === 0 || files.length > 30) return Response.json({ error: 'INVALID_FILE_COUNT' }, { status: 422 });
  const alt = String(form.get('alt') ?? '');
  const caption = String(form.get('caption') ?? '') || undefined;
  const eventId = params.id;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        const photos = [];
        for (const [fileIndex, file] of files.entries()) {
          send({ type: 'progress', phase: 'processing', fileIndex: fileIndex + 1, totalFiles: files.length, fileName: file.name, overall: Math.round((fileIndex / files.length) * 100) });
          photos.push(await processUpload(eventId, file, alt, caption, (progress) => {
            const overall = Math.round(((fileIndex + progress.percent / 100) / files.length) * 100);
            send({ type: 'progress', phase: progress.stage, fileIndex: fileIndex + 1, totalFiles: files.length, fileName: file.name, overall, ...progress });
          }));
        }
        send({ type: 'complete', photos });
      } catch (error) {
        console.error(error);
        send({ type: 'error', error: error instanceof Error ? error.message : 'UPLOAD_FAILED' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-store',
      'x-accel-buffering': 'no',
    },
  });
};
