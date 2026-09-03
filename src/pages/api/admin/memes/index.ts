import type { APIRoute } from 'astro';
import { createMeme, listMemes } from '../../../../server/memes';

export const GET: APIRoute = async () => {
  return Response.json({ memes: await listMemes() });
};

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const files = form.getAll('files').filter((value): value is File => value instanceof File);
  if (files.length === 0 || files.length > 30) return Response.json({ error: 'INVALID_FILE_COUNT' }, { status: 422 });
  const series = String(form.get('series') ?? '').trim().slice(0, 30);

  const uploaded: unknown[] = [];
  const errors: { fileName: string; error: string }[] = [];
  for (const file of files) {
    try {
      const title = file.name.replace(/\.[^.]+$/, '').slice(0, 100);
      uploaded.push(await createMeme(file, title, series));
    } catch (error) {
      errors.push({ fileName: file.name, error: error instanceof Error ? error.message : 'UPLOAD_FAILED' });
    }
  }
  return Response.json({ uploaded, errors });
};
