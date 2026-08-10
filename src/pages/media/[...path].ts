import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

type Bindings = {
  MEDIA: R2Bucket;
  IMAGES: ImagesBinding;
  LOCAL_MEDIA_ORIGIN?: string;
};

function contentHeaders(object: R2ObjectBody, path: string) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has('content-type')) {
    const extension = path.toLowerCase().split('.').pop();
    const contentType = extension === 'png' ? 'image/png'
      : extension === 'webp' ? 'image/webp'
        : extension === 'gif' ? 'image/gif'
          : 'image/jpeg';
    headers.set('content-type', contentType);
  }
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return headers;
}

async function transformImage(bindings: Bindings, originalPath: string, width: number) {
  const key = `originals/${originalPath}`;
  const original = await bindings.MEDIA.get(key);
  if (!original) return null;
  try {
    const result = await bindings.IMAGES
      .input(original.body)
      .transform({ width, fit: 'scale-down' })
      .output({ format: 'image/webp', quality: 90 });
    const response = result.response();
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(response.body, { status: response.status, headers });
  } catch {
    // Some legacy originals exceed the Images binding input limit. They are
    // still browser-compatible, so return the source instead of a broken image.
    const fallback = await bindings.MEDIA.get(key);
    return fallback
      ? new Response(fallback.body, { headers: contentHeaders(fallback, originalPath) })
      : null;
  }
}

async function fetchLocalFallback(bindings: Bindings, path: string, url: URL) {
  if (!bindings.LOCAL_MEDIA_ORIGIN) return null;
  const fallback = new URL(`/media/${path}`, bindings.LOCAL_MEDIA_ORIGIN);
  fallback.search = url.search;
  const response = await fetch(fallback);
  return response.ok ? response : null;
}

export const GET: APIRoute = async ({ params, request, url }) => {
  if (!params.path || params.path.includes('..')) return new Response('Not found', { status: 404 });
  const bindings = env as unknown as Bindings;
  const width = Number(url.searchParams.get('width'));
  const requestedWidth = Number.isInteger(width) && width > 0 && width <= 4096 ? width : undefined;

  if (requestedWidth) {
    return await transformImage(bindings, params.path, requestedWidth)
      ?? await fetchLocalFallback(bindings, params.path, url)
      ?? new Response('Not found', { status: 404 });
  }

  const object = await bindings.MEDIA.get(`public/${params.path}`);
  if (!object) {
    const legacyVariant = params.path.match(/^(.*)-(\d+)\.(?:jpe?g|png|webp)$/i);
    if (legacyVariant) {
      const generated = await transformImage(bindings, `${legacyVariant[1]}.jpeg`, Number(legacyVariant[2]));
      if (generated) return generated;
    }
    const fallback = await fetchLocalFallback(bindings, params.path, url);
    if (fallback) return fallback;
    return new Response('Not found', { status: 404 });
  }
  if (request.headers.get('if-none-match') === object.httpEtag) return new Response(null, { status: 304 });
  return new Response(object.body, { headers: contentHeaders(object, params.path) });
};
