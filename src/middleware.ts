import { defineMiddleware } from 'astro:middleware';
import { adminAuthDisabled, getSession, validCsrf, validOrigin } from './server/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const nextWithPageCachePolicy = async () => {
    const response = await next();
    // Every page is SSR'd from D1, so no HTML may be edge-cached
    // (the zone caches HTML by default; /media/* keeps its immutable headers).
    if (!response.headers.get('content-type')?.includes('text/html')) return response;
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store, max-age=0');
    headers.set('CDN-Cache-Control', 'no-store');
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
  if (context.url.hostname === 'paste.wzt.hk' && path === '/') {
    return context.rewrite('/pasteboard');
  }
  if (context.url.hostname === 'meme.wzt.hk') {
    // meme.wzt.hk is gallery-only: expose the memes page, its media and
    // bundled assets; everything else on the main site is not served here.
    const allowed = path === '/' || path.startsWith('/memes') || path.startsWith('/media/')
      || path.startsWith('/_astro/') || path === '/favicon.svg';
    // no-store because this zone's edge cache shares entries across hostnames,
    // and a cacheable 404 here would leak onto the main site's paths.
    if (!allowed) return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store, max-age=0', 'CDN-Cache-Control': 'no-store' },
    });
    if (path === '/') return context.rewrite('/memes');
  }
  const isAdminPage = path.startsWith('/admin') && path !== '/admin/login';
  const isAdminApi = path.startsWith('/api/admin');
  const isLoginApi = path === '/api/admin/login';
  if (!isAdminPage && !isAdminApi) return nextWithPageCachePolicy();
  if (adminAuthDisabled()) return nextWithPageCachePolicy();

  const session = await getSession(context.cookies);
  if (session) context.locals.adminSession = session;
  if (!session && !isLoginApi) {
    if (isAdminApi) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    return context.redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  }

  if (isAdminApi && !isLoginApi && !['GET', 'HEAD', 'OPTIONS'].includes(context.request.method)) {
    if (!session || !validOrigin(context.request) || !validCsrf(session, context.request.headers.get('x-csrf-token'))) {
      return Response.json({ error: 'INVALID_CSRF' }, { status: 403 });
    }
  }
  return nextWithPageCachePolicy();
});
