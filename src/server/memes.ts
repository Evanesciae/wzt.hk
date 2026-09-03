import { env } from 'cloudflare:workers';

type Row = Record<string, unknown>;
type Bindings = { DB: D1Database; MEDIA: R2Bucket };

const MAX_MEME_SIZE = 25 * 1024 * 1024;
const MEME_TYPES: Record<string, string> = {
  'image/gif': 'gif',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpeg',
};

export interface Meme {
  id: string;
  title: string;
  series: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

function bindings() {
  return env as unknown as Bindings;
}

export function memeUrl(meme: Pick<Meme, 'filePath'>) {
  return `/media/${meme.filePath}`;
}

function rowToMeme(row: Row): Meme {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    series: String(row.series ?? ''),
    filePath: String(row.file_path),
    mimeType: String(row.mime_type),
    fileSize: Number(row.file_size),
    createdAt: String(row.created_at),
  };
}

export async function listMemes() {
  const result = await bindings().DB
    .prepare('SELECT * FROM memes ORDER BY created_at DESC, id DESC')
    .all<Row>();
  return (result.results ?? []).map(rowToMeme);
}

export async function createMeme(file: File, title: string, series: string): Promise<Meme> {
  const ext = MEME_TYPES[file.type];
  if (!ext) throw new Error('UNSUPPORTED_FILE_TYPE');
  if (file.size === 0 || file.size > MAX_MEME_SIZE) throw new Error('INVALID_FILE_SIZE');

  const id = crypto.randomUUID();
  const filePath = `memes/${id}.${ext}`;
  const key = `public/${filePath}`;
  await bindings().MEDIA.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { originalName: file.name.slice(0, 256) },
  });
  try {
    await bindings().DB.prepare(
      'INSERT INTO memes (id,title,series,file_path,mime_type,file_size) VALUES (?,?,?,?,?,?)',
    ).bind(id, title, series, filePath, file.type, file.size).run();
  } catch (error) {
    await bindings().MEDIA.delete(key);
    throw error;
  }
  return {
    id,
    title,
    series,
    filePath,
    mimeType: file.type,
    fileSize: file.size,
    createdAt: new Date().toISOString(),
  };
}

export async function updateMeme(id: string, patch: { title: string; series: string }) {
  await bindings().DB.prepare('UPDATE memes SET title=?, series=? WHERE id=?')
    .bind(patch.title, patch.series, id).run();
}

export async function deleteMeme(id: string) {
  const row = await bindings().DB.prepare('SELECT file_path FROM memes WHERE id=?')
    .bind(id).first<Row>();
  if (!row) return false;
  await bindings().DB.prepare('DELETE FROM memes WHERE id=?').bind(id).run();
  await bindings().MEDIA.delete(`public/${String(row.file_path)}`);
  return true;
}
