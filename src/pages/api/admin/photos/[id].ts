import type { APIRoute } from 'astro';
import { deletePhotoFiles } from '../../../../server/media';

export const DELETE: APIRoute = async ({ params }) => {
  if (!params.id || !(await deletePhotoFiles(params.id))) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  return Response.json({ ok: true });
};

