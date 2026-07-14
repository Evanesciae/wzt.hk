import { defineMiddleware } from 'astro:middleware';
import { getSession, validCsrf, validOrigin } from './server/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isAdminPage = path.startsWith('/admin') && path !== '/admin/login';
  const isAdminApi = path.startsWith('/api/admin');
  const isLoginApi = path === '/api/admin/login';
  if (!isAdminPage && !isAdminApi) return next();

  const session = getSession(context.cookies);
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
  return next();
});

