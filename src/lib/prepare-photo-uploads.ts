const IMAGE_BINDING_LIMIT_BYTES = 20_000_000;
const TARGET_BYTES = 18_000_000;
const MAX_EDGE = 4096;
const QUALITY_STEPS = [0.9, 0.82, 0.74, 0.66];

export interface PreparedPhotoUploads {
  files: File[];
  compressedCount: number;
  originalBytes: number;
  preparedBytes: number;
}

interface PrepareProgress {
  index: number;
  total: number;
  fileName: string;
}

function blobFromCanvas(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('IMAGE_COMPRESSION_FAILED')),
      'image/webp',
      quality,
    );
  });
}

async function compressPhoto(file: File) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`无法在浏览器中压缩 ${file.name}，请先导出为 JPEG、PNG 或 WebP 后重试。`);
  }

  try {
    let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('IMAGE_COMPRESSION_FAILED');
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of QUALITY_STEPS) {
        const blob = await blobFromCanvas(canvas, quality);
        if (blob.size <= TARGET_BYTES) {
          const stem = file.name.replace(/\.[^.]+$/, '') || 'photo';
          return new File([blob], `${stem}.webp`, {
            type: 'image/webp',
            lastModified: file.lastModified,
          });
        }
      }

      scale *= 0.8;
    }
  } finally {
    bitmap.close();
  }

  throw new Error(`压缩 ${file.name} 后仍然过大，请先缩小图片尺寸后重试。`);
}

export async function preparePhotoUploads(
  incomingFiles: File[],
  onCompress?: (progress: PrepareProgress) => void,
): Promise<PreparedPhotoUploads> {
  const files: File[] = [];
  let compressedCount = 0;
  let originalBytes = 0;
  let preparedBytes = 0;

  for (const [index, file] of incomingFiles.entries()) {
    originalBytes += file.size;
    if (file.size <= IMAGE_BINDING_LIMIT_BYTES) {
      files.push(file);
      preparedBytes += file.size;
      continue;
    }

    onCompress?.({ index: index + 1, total: incomingFiles.length, fileName: file.name });
    const compressed = await compressPhoto(file);
    files.push(compressed);
    preparedBytes += compressed.size;
    compressedCount += 1;
  }

  return { files, compressedCount, originalBytes, preparedBytes };
}
