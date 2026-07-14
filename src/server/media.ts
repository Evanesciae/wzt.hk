import { mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { addPhotoRecord, deletePhotoRecord, getEventContext, getPhoto } from './database';
import type { PhotoVariant } from './types';

const require = createRequire(import.meta.url);
const { parse: parseExif } = require('exifr') as { parse: (buffer: Buffer, options?: Record<string, unknown>) => Promise<Record<string, unknown>> };

const execFileAsync = promisify(execFile);
const MAX_UPLOAD = 100 * 1024 * 1024;
const MAX_WEB_WIDTH = 4096;
const dataRoot = resolve(process.env.MEDIA_DIR ?? join(process.cwd(), 'data', 'media'));

export interface UploadProgress {
  stage: 'saving' | 'decoding' | 'resizing' | 'complete';
  percent: number;
  width?: number;
  variant?: number;
  totalVariants?: number;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
}

function extension(file: File) {
  const ext = extname(file.name).toLowerCase();
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.heic', '.heif'];
  return allowed.includes(ext) ? ext : '';
}

async function sharpInput(originalPath: string, ext: string, tempPath: string) {
  try {
    await sharp(originalPath).metadata();
    return originalPath;
  } catch (error) {
    if (!['.heic', '.heif'].includes(ext)) throw error;
    try {
      await execFileAsync('heif-convert', [originalPath, tempPath]);
      return tempPath;
    } catch {
      if (process.platform !== 'darwin') throw new Error('HEIC_UNSUPPORTED');
      await execFileAsync('/usr/bin/sips', ['-s', 'format', 'jpeg', originalPath, '--out', tempPath]);
      return tempPath;
    }
  }
}

export async function processUpload(
  eventId: string,
  file: File,
  alt: string,
  caption?: string,
  onProgress?: (progress: UploadProgress) => void,
) {
  const context = getEventContext(eventId);
  if (!context) throw new Error('EVENT_NOT_FOUND');
  if (file.size === 0 || file.size > MAX_UPLOAD) throw new Error('INVALID_FILE_SIZE');
  const ext = extension(file);
  if (!ext) throw new Error('UNSUPPORTED_FILE_TYPE');

  const photoId = randomUUID();
  const trip = safeSegment(context.trip_id);
  const event = safeSegment(context.public_id);
  const originalDir = join(dataRoot, 'originals', trip, event);
  const publicDir = join(dataRoot, 'public', trip, event);
  await mkdir(originalDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });
  const originalPath = join(originalDir, `${photoId}${ext}`);
  const tempPath = join(originalDir, `${photoId}-converted.jpg`);
  const variants: PhotoVariant[] = [];
  const generatedPaths: string[] = [];
  let inputPath = originalPath;
  try {
    onProgress?.({ stage: 'saving', percent: 2 });
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(originalPath, fileBuffer, { flag: 'wx' });
    let takenAt: string | undefined;
    try {
      const exif = await parseExif(fileBuffer, { pick: ['DateTimeOriginal'] });
      const raw = exif?.DateTimeOriginal;
      if (raw) {
        // ponytail: exifr returns DateTimeOriginal as a Date object; only strings need the YYYY:MM:DD → YYYY-MM-DD fixup
        const parsed = raw instanceof Date
          ? raw
          : new Date(String(raw).replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
        if (!isNaN(parsed.getTime())) takenAt = parsed.toISOString();
      }
    } catch { /* EXIF 解析失败，使用上传时间作为回退 */ }
    onProgress?.({ stage: 'decoding', percent: 7 });
    inputPath = await sharpInput(originalPath, ext, tempPath);
    const metadata = await sharp(inputPath).metadata();
    const originalWidth = metadata.autoOrient.width ?? metadata.width ?? MAX_WEB_WIDTH;
    const maxWidth = Math.min(originalWidth, MAX_WEB_WIDTH);
    const widths = [...new Set([640, 1280, 2048, MAX_WEB_WIDTH]
      .filter((width) => width < maxWidth).concat(maxWidth))];

    for (const [index, width] of widths.entries()) {
      onProgress?.({
        stage: 'resizing', percent: 10 + Math.round((index / widths.length) * 85),
        width, variant: index + 1, totalVariants: widths.length,
      });
      const filename = `${photoId}-${width}.jpg`;
      const outputPath = join(publicDir, filename);
      generatedPaths.push(outputPath);
      const info = await sharp(inputPath)
        .autoOrient()
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: 90, chromaSubsampling: '4:4:4', progressive: true, optimiseCoding: true })
        .timeout({ seconds: 120 })
        .toFile(outputPath);
      variants.push({ width: info.width, height: info.height, size: info.size, path: `${trip}/${event}/${filename}` });
      onProgress?.({
        stage: 'resizing', percent: 10 + Math.round(((index + 1) / widths.length) * 85),
        width, variant: index + 1, totalVariants: widths.length,
      });
    }
    if (inputPath === tempPath) await rm(tempPath, { force: true });
    const resolvedAlt = alt || file.name.replace(extname(file.name), '');
    addPhotoRecord({
      id: photoId, eventId, originalPath: `${trip}/${event}/${photoId}${ext}`,
      variants, alt: resolvedAlt, caption, featured: false, takenAt,
    });
    onProgress?.({ stage: 'complete', percent: 100 });
    return { id: photoId, eventId, originalPath: `${trip}/${event}/${photoId}${ext}`, variants, alt: resolvedAlt, caption, featured: false, takenAt };
  } catch (error) {
    await Promise.all([
      rm(originalPath, { force: true }),
      rm(tempPath, { force: true }),
      ...generatedPaths.map((path) => rm(path, { force: true })),
    ]);
    throw error;
  }
}

export function publicMediaPath(relative: string) {
  const root = join(dataRoot, 'public');
  const absolute = resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(root + sep)) throw new Error('INVALID_PATH');
  return absolute;
}

export async function deletePhotoFiles(photoId: string) {
  const photo = getPhoto(photoId);
  if (!photo) return false;
  await rm(join(dataRoot, 'originals', photo.originalPath), { force: true });
  await Promise.all(photo.variants.map((variant) => rm(join(dataRoot, 'public', variant.path), { force: true })));
  deletePhotoRecord(photoId);
  return true;
}
