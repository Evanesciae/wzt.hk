import { env } from 'cloudflare:workers';
import { validPasteboardChannel } from './pasteboard';

type Bindings = { DB: D1Database };
type BookmarkRow = {
  id: string;
  title: string;
  url: string;
  created_at: string;
};

export type Bookmark = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
};

function database() {
  return (env as unknown as Bindings).DB;
}

export { validPasteboardChannel as validBookmarkChannel };

export function normalizeBookmarkUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function toBookmark(row: BookmarkRow): Bookmark {
  return { id: row.id, title: row.title, url: row.url, createdAt: row.created_at };
}

export async function listBookmarks(channel: string) {
  const result = await database()
    .prepare(`SELECT id, title, url, created_at
      FROM pasteboard_bookmarks WHERE channel_id = ?
      ORDER BY created_at DESC LIMIT 500`)
    .bind(channel)
    .all<BookmarkRow>();
  return (result.results ?? []).map(toBookmark);
}

export async function createBookmark(channel: string, input: { title: string; url: string }) {
  const existing = await database()
    .prepare(`SELECT id, title, url, created_at FROM pasteboard_bookmarks
      WHERE channel_id = ? AND url = ? LIMIT 1`)
    .bind(channel, input.url)
    .first<BookmarkRow>();
  if (existing) return toBookmark(existing);

  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    title: input.title,
    url: input.url,
    createdAt: new Date().toISOString(),
  };
  await database()
    .prepare(`INSERT INTO pasteboard_bookmarks (id, channel_id, title, url, created_at)
      VALUES (?, ?, ?, ?, ?)`)
    .bind(bookmark.id, channel, bookmark.title, bookmark.url, bookmark.createdAt)
    .run();
  return bookmark;
}

export async function deleteBookmark(channel: string, id: string) {
  const result = await database()
    .prepare('DELETE FROM pasteboard_bookmarks WHERE id = ? AND channel_id = ?')
    .bind(id, channel)
    .run();
  return Number(result.meta?.changes ?? 0) > 0;
}
