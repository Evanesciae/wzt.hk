import { env } from 'cloudflare:workers';

type Bindings = { DB: D1Database; MEDIA: R2Bucket };
type PasteboardRow = {
  id: string;
  content: string;
  content_type: string;
  created_at: string;
  object_key?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
};

export type PasteboardItem = {
  id: string;
  content: string;
  type: 'text' | 'link' | 'code' | 'json' | 'file';
  createdAt: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
};

function database() {
  return (env as unknown as Bindings).DB;
}

function storage() {
  return (env as unknown as Bindings).MEDIA;
}

export function validPasteboardChannel(channel: string | null | undefined): channel is string {
  return Boolean(channel && /^[a-f0-9]{64}$/.test(channel));
}

function toItem(row: PasteboardRow): PasteboardItem {
  const allowed = new Set(['text', 'link', 'code', 'json', 'file']);
  return {
    id: row.id,
    content: row.content,
    type: allowed.has(row.content_type) ? row.content_type as PasteboardItem['type'] : 'text',
    createdAt: row.created_at,
    fileName: row.file_name ? String(row.file_name) : undefined,
    mimeType: row.mime_type ? String(row.mime_type) : undefined,
    fileSize: row.file_size == null ? undefined : Number(row.file_size),
  };
}

async function cleanupExpiredItems() {
  const expired = await database()
    .prepare(`SELECT object_key FROM pasteboard_items
      WHERE unixepoch(created_at) <= unixepoch('now', '-1 day') AND object_key IS NOT NULL`)
    .all<{ object_key: string }>();
  const keys = (expired.results ?? []).map((row) => row.object_key).filter(Boolean);
  if (keys.length) await storage().delete(keys);
  await database()
    .prepare("DELETE FROM pasteboard_items WHERE unixepoch(created_at) <= unixepoch('now', '-1 day')")
    .run();
}

async function trimChannelItems(channel: string) {
  const excess = await database()
    .prepare(`SELECT id, object_key FROM pasteboard_items
      WHERE channel_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 100`)
    .bind(channel)
    .all<{ id: string; object_key?: string | null }>();
  const rows = excess.results ?? [];
  const keys = rows.map((row) => row.object_key).filter((key): key is string => Boolean(key));
  if (keys.length) await storage().delete(keys);
  if (rows.length) {
    await database().batch(rows.map((row) => database()
      .prepare('DELETE FROM pasteboard_items WHERE id = ? AND channel_id = ?')
      .bind(row.id, channel)));
  }
}

export async function listPasteboardItems(channel: string) {
  const result = await database()
    .prepare(`SELECT id, content, content_type, created_at, object_key, file_name, mime_type, file_size
      FROM pasteboard_items
      WHERE channel_id = ? AND unixepoch(created_at) > unixepoch('now', '-1 day')
      ORDER BY created_at DESC
      LIMIT 100`)
    .bind(channel)
    .all<PasteboardRow>();
  return (result.results ?? []).map(toItem);
}

export async function createPasteboardItem(
  channel: string,
  input: { content: string; type: PasteboardItem['type'] },
) {
  await cleanupExpiredItems();
  const item: PasteboardItem = {
    id: crypto.randomUUID(),
    content: input.content,
    type: input.type,
    createdAt: new Date().toISOString(),
  };
  await database()
    .prepare(`INSERT INTO pasteboard_items (id, channel_id, content, content_type, created_at)
      VALUES (?, ?, ?, ?, ?)`)
    .bind(item.id, channel, item.content, item.type, item.createdAt)
    .run();
  await trimChannelItems(channel);
  return item;
}

export async function createPasteboardFile(channel: string, file: File) {
  await cleanupExpiredItems();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const fileName = file.name.slice(0, 240) || 'file';
  const mimeType = file.type || 'application/octet-stream';
  const objectKey = `pasteboard/${channel}/${id}`;
  await storage().put(objectKey, file.stream(), {
    httpMetadata: { contentType: mimeType, cacheControl: 'private, max-age=0, no-store' },
    customMetadata: { originalName: fileName, createdAt },
  });
  try {
    await database()
      .prepare(`INSERT INTO pasteboard_items
        (id, channel_id, content, content_type, created_at, object_key, file_name, mime_type, file_size)
        VALUES (?, ?, ?, 'file', ?, ?, ?, ?, ?)`)
      .bind(id, channel, fileName, createdAt, objectKey, fileName, mimeType, file.size)
      .run();
  } catch (error) {
    await storage().delete(objectKey);
    throw error;
  }
  await trimChannelItems(channel);
  return { id, content: fileName, type: 'file' as const, createdAt, fileName, mimeType, fileSize: file.size };
}

export async function getPasteboardFile(channel: string, id: string) {
  const row = await database()
    .prepare(`SELECT object_key, file_name, mime_type, file_size FROM pasteboard_items
      WHERE id = ? AND channel_id = ? AND content_type = 'file'
        AND unixepoch(created_at) > unixepoch('now', '-1 day')`)
    .bind(id, channel)
    .first<{ object_key: string; file_name: string; mime_type: string; file_size: number }>();
  if (!row?.object_key) return undefined;
  const object = await storage().get(row.object_key);
  return object ? { object, fileName: row.file_name, mimeType: row.mime_type, fileSize: Number(row.file_size) } : undefined;
}

export async function deletePasteboardItem(channel: string, id: string) {
  const existing = await database()
    .prepare('SELECT object_key FROM pasteboard_items WHERE id = ? AND channel_id = ?')
    .bind(id, channel)
    .first<{ object_key?: string }>();
  if (existing?.object_key) await storage().delete(existing.object_key);
  const result = await database()
    .prepare('DELETE FROM pasteboard_items WHERE id = ? AND channel_id = ?')
    .bind(id, channel)
    .run();
  return Number(result.meta?.changes ?? 0) > 0;
}
