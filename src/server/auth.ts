import { env } from 'cloudflare:workers';
import type { AstroCookies } from 'astro';

const COOKIE_NAME = 'wzt_admin_session';
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 210_000;

type Bindings = {
  DB: D1Database;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD_HASH?: string;
};

interface SessionRow {
  token_hash: string;
  user_id: string;
  username: string;
  csrf_token: string;
  expires_at: string;
}

export interface AdminSession {
  userId: string;
  username: string;
  csrfToken: string;
  expiresAt: string;
}

function bindings() {
  return env as unknown as Bindings;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomToken(size: number) {
  return encode(crypto.getRandomValues(new Uint8Array(size)));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function equalBytes(expected: Uint8Array, actual: Uint8Array) {
  if (expected.length !== actual.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ actual[index];
  return difference === 0;
}

async function verifyPassword(stored: string, password: string) {
  const [algorithm, iterationsText, saltText, expectedText] = stored.split('$');
  if (algorithm !== 'pbkdf2-sha256' || !saltText || !expectedText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: decode(saltText), iterations },
    key,
    256,
  );
  return equalBytes(decode(expectedText), new Uint8Array(derived));
}

export async function ensureAdminUser() {
  const { DB, ADMIN_USERNAME = 'admin', ADMIN_PASSWORD_HASH } = bindings();
  if (!ADMIN_PASSWORD_HASH) return false;
  const existing = await DB.prepare('SELECT id,password_hash FROM users WHERE username=?')
    .bind(ADMIN_USERNAME)
    .first<{ id: string; password_hash: string }>();
  if (!existing) {
    await DB.prepare('INSERT INTO users (id,username,password_hash,created_at) VALUES (?,?,?,?)')
      .bind(crypto.randomUUID(), ADMIN_USERNAME, ADMIN_PASSWORD_HASH, new Date().toISOString())
      .run();
  } else if (existing.password_hash !== ADMIN_PASSWORD_HASH) {
    await DB.batch([
      DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(ADMIN_PASSWORD_HASH, existing.id),
      DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(existing.id),
    ]);
  }
  return true;
}

export async function login(username: string, password: string) {
  await ensureAdminUser();
  const { DB } = bindings();
  const row = await DB.prepare('SELECT id,username,password_hash FROM users WHERE username=?')
    .bind(username)
    .first<{ id: string; username: string; password_hash: string }>();
  if (!row || !await verifyPassword(row.password_hash, password)) return;
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await DB.batch([
    DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(new Date().toISOString()),
    DB.prepare('INSERT INTO sessions (token_hash,user_id,csrf_token,expires_at,created_at) VALUES (?,?,?,?,?)')
      .bind(await sha256(token), row.id, csrfToken, expiresAt, new Date().toISOString()),
  ]);
  return { token, csrfToken, expiresAt };
}

export function setSessionCookie(cookies: AstroCookies, token: string, secure: boolean) {
  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSession(cookies: AstroCookies) {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (token) await bindings().DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
  cookies.delete(COOKIE_NAME, { path: '/' });
}

export async function getSession(cookies: AstroCookies): Promise<AdminSession | undefined> {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token) return;
  const row = await bindings().DB.prepare(
    `SELECT s.token_hash,s.user_id,u.username,s.csrf_token,s.expires_at
     FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.expires_at>?`,
  ).bind(await sha256(token), new Date().toISOString()).first<SessionRow>();
  if (!row) return;
  return {
    userId: row.user_id,
    username: row.username,
    csrfToken: row.csrf_token,
    expiresAt: row.expires_at,
  };
}

export function validCsrf(session: AdminSession, value: string | null) {
  if (!value) return false;
  return equalBytes(new TextEncoder().encode(session.csrfToken), new TextEncoder().encode(value));
}

export function validOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export async function makePasswordHash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${encode(salt)}$${encode(new Uint8Array(derived))}`;
}
