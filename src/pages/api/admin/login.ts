import type { APIRoute } from 'astro';
import { login, setSessionCookie, validOrigin } from '../../../server/auth';

const attempts = new Map<string, { count: number; reset: number }>();

export const POST: APIRoute = async ({ request, cookies, clientAddress, url }) => {
  if (!validOrigin(request)) return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const key = clientAddress || 'unknown';
  const now = Date.now();
  const attempt = attempts.get(key);
  if (attempt && attempt.reset > now && attempt.count >= 8) {
    return Response.json({ error: 'TOO_MANY_ATTEMPTS' }, { status: 429 });
  }
  let body: { username?: string; password?: string };
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const result = await login(body.username ?? '', body.password ?? '');
  if (!result) {
    const current = attempt?.reset && attempt.reset > now ? attempt : { count: 0, reset: now + 15 * 60_000 };
    current.count += 1;
    attempts.set(key, current);
    await new Promise((resolve) => setTimeout(resolve, 350));
    return Response.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }
  attempts.delete(key);
  setSessionCookie(cookies, result.token, process.env.NODE_ENV === 'production' || url.protocol === 'https:');
  return Response.json({ ok: true, csrfToken: result.csrfToken });
};
