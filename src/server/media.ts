import { env } from 'cloudflare:workers';
import {
  addCityPhotoRecord,
  addPhotoRecord,
  deleteCityPhotoRecord,
  deletePhotoRecord,
  getCityPhoto,
  getCityPlaceContext,
  getEventContext,
  getPhoto,
} from './database';
import type { PhotoVariant } from './types';

const MAX_UPLOAD = 100 * 1024 * 1024;
const MAX_IMAGE_BINDING_INPUT = 20_000_000;
const MAX_WEB_WIDTH = 4096;
const WIDTHS = [320, 640, 1280, 2048, MAX_WEB_WIDTH];
const WEB_IMAGE_QUALITY = 82;

type Bindings = {
  MEDIA: R2Bucket;
  IMAGES: ImagesBinding;
};

export interface UploadProgress {
  stage: 'saving' | 'decoding' | 'resizing' | 'complete';
  percent: number;
  width?: number;
  variant?: number;
  totalVariants?: number;
}

function bindings() {
  return env as unknown as Bindings;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
}

function extension(file: File) {
  const match = file.name.toLowerCase().match(/\.(jpe?g|png|webp|gif|tiff?|heic|heif)$/);
  return match ? `.${match[1]}` : '';
}

interface ProcessedImage {
  id: string;
  originalPath: string;
  variants: PhotoVariant[];
  alt: string;
  caption?: string;
  featured: boolean;
  takenAt?: string;
}

async function processImageUpload(
  groupName: string,
  itemName: string,
  file: File,
  alt: string,
  caption?: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<ProcessedImage> {
  if (file.size === 0 || file.size > MAX_UPLOAD) throw new Error('INVALID_FILE_SIZE');
  if (file.size > MAX_IMAGE_BINDING_INPUT) throw new Error('IMAGE_REQUIRES_COMPRESSION');
  const ext = extension(file);
  if (!ext || !file.type.startsWith('image/')) throw new Error('UNSUPPORTED_FILE_TYPE');

  const photoId = crypto.randomUUID();
  const group = safeSegment(groupName);
  const item = safeSegment(itemName);
  const originalPath = `${group}/${item}/${photoId}${ext}`;
  const key = `originals/${originalPath}`;
  const storedKeys = [key];

  try {
    onProgress?.({ stage: 'decoding', percent: 5 });
    const info = await bindings().IMAGES.info(file.stream());
    if (!('width' in info) || !info.width || !info.height) throw new Error('UNSUPPORTED_FILE_TYPE');
    const originalWidth = info.width;
    const originalHeight = info.height;

    onProgress?.({ stage: 'saving', percent: 15 });
    await bindings().MEDIA.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'private, max-age=0, no-store',
      },
      customMetadata: {
        originalName: file.name.slice(0, 256),
        width: String(info.width),
        height: String(info.height),
      },
    });

    const maxWidth = Math.min(originalWidth, MAX_WEB_WIDTH);
    const widths = [...new Set(WIDTHS.filter((width) => width < maxWidth).concat(maxWidth))];
    const variantBase = originalPath.replace(/\.[^.]+$/, '');
    const variants: PhotoVariant[] = [];
    for (const [index, width] of widths.entries()) {
      const variantPath = `${variantBase}-${width}.webp`;
      const transformed = await bindings().IMAGES
        .input(file.stream())
        .transform({ width, fit: 'scale-down' })
        .output({ format: 'image/webp', quality: WEB_IMAGE_QUALITY });
      const response = transformed.response();
      if (!response.ok || !response.body) throw new Error('IMAGE_TRANSFORM_FAILED');
      const variantKey = `public/${variantPath}`;
      await bindings().MEDIA.put(variantKey, response.body, {
        httpMetadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: {
          source: originalPath,
          width: String(width),
          height: String(Math.max(1, Math.round(originalHeight * width / originalWidth))),
        },
      });
      storedKeys.push(variantKey);
      onProgress?.({
        stage: 'resizing',
        percent: 20 + Math.round(((index + 1) / widths.length) * 75),
        width,
        variant: index + 1,
        totalVariants: widths.length,
      });
      variants.push({
        width,
        height: Math.max(1, Math.round(originalHeight * width / originalWidth)),
        size: 0,
        path: variantPath,
      });
    }

    onProgress?.({ stage: 'complete', percent: 100 });
    return {
      id: photoId,
      originalPath,
      variants,
      alt: alt || file.name.replace(/\.[^.]+$/, ''),
      caption,
      featured: false,
    };
  } catch (error) {
    await bindings().MEDIA.delete(storedKeys);
    throw error;
  }
}

export async function processUpload(
  eventId: string,
  file: File,
  alt: string,
  caption?: string,
  onProgress?: (progress: UploadProgress) => void,
) {
  const context = await getEventContext(eventId);
  if (!context) throw new Error('EVENT_NOT_FOUND');
  const image = await processImageUpload(context.trip_id, context.public_id, file, alt, caption, onProgress);
  await addPhotoRecord({ ...image, eventId });
  return { ...image, eventId };
}

export async function processCityUpload(
  placeId: string,
  file: File,
  alt: string,
  caption?: string,
  onProgress?: (progress: UploadProgress) => void,
) {
  const context = await getCityPlaceContext(placeId);
  if (!context) throw new Error('PLACE_NOT_FOUND');
  const image = await processImageUpload(`cities-${context.city}`, context.id, file, alt, caption, onProgress);
  const { takenAt: _takenAt, ...cityImage } = image;
  await addCityPhotoRecord({ ...cityImage, placeId });
  return { ...cityImage, placeId };
}

async function deleteStoredPhoto(originalPath: string, variants: PhotoVariant[]) {
  const keys = [
    `originals/${originalPath}`,
    ...variants.filter((variant) => !variant.path.includes('?')).map((variant) => `public/${variant.path}`),
  ];
  await bindings().MEDIA.delete(keys);
}

export async function deletePhotoFiles(photoId: string) {
  const photo = await getPhoto(photoId);
  if (!photo) return false;
  await deleteStoredPhoto(photo.originalPath, photo.variants);
  await deletePhotoRecord(photoId);
  return true;
}

export async function deleteCityPhotoFiles(photoId: string) {
  const photo = await getCityPhoto(photoId);
  if (!photo) return false;
  await deleteStoredPhoto(photo.originalPath, photo.variants);
  await deleteCityPhotoRecord(photoId);
  return true;
}
