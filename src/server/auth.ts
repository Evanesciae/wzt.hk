import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { AstroCookies } from 'astro';
import { getDatabase } from './database';

const COOKIE_NAME = 'wzt_admin_session';
const SESSION_DAYS = 30;

interface SessionRow { token_hash: string; user_id: string; username: string; csrf_token: string; expires_at: string }
export interface AdminSession { userId: string; username: string; csrfToken: string; expiresAt: string }

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!passwordHash) return false;
  const db = getDatabase();
  const existing = db.prepare('SELECT id,password_hash FROM users WHERE username=?').get(username) as
    { id: string; password_hash: string } | undefined;
  if (!existing) db.prepare('INSERT INTO users (id,username,password_hash,created_at) VALUES (?,?,?,?)')
    .run(randomUUID(), username, passwordHash, new Date().toISOString());
  else if (existing.password_hash !== passwordHash) {
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash, existing.id);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return true;
}

export async function login(username: string, password: string) {
  await ensureAdminUser();
  const row = getDatabase().prepare('SELECT id,username,password_hash FROM users WHERE username=?')
    .get(username) as { id: string; username: string; password_hash: string } | undefined;
  if (!row || !(await verify(row.password_hash, password))) return;
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  const db = getDatabase();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  db.prepare('INSERT INTO sessions (token_hash,user_id,csrf_token,expires_at,created_at) VALUES (?,?,?,?,?)')
    .run(sha256(token), row.id, csrfToken, expiresAt, new Date().toISOString());
  return { token, csrfToken, expiresAt };
}

export function setSessionCookie(cookies: AstroCookies, token: string, secure: boolean) {
  cookies.set(COOKIE_NAME, token, {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400,
  });
}

export function clearSession(cookies: AstroCookies) {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (token) getDatabase().prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token));
  cookies.delete(COOKIE_NAME, { path: '/' });
}

export function getSession(cookies: AstroCookies): AdminSession | undefined {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token) return;
  const row = getDatabase().prepare(`SELECT s.token_hash,s.user_id,u.username,s.csrf_token,s.expires_at
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`)
    .get(sha256(token), new Date().toISOString()) as SessionRow | undefined;
  if (!row) return;
  return { userId: row.user_id, username: row.username, csrfToken: row.csrf_token, expiresAt: row.expires_at };
}

export function validCsrf(session: AdminSession, value: string | null) {
  if (!value) return false;
  const expected = Buffer.from(session.csrfToken);
  const actual = Buffer.from(value);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function validOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export async function makePasswordHash(password: string) {
  return hash(password, { memoryCost: 19456, timeCost: 3, parallelism: 1, outputLen: 32 });
}
