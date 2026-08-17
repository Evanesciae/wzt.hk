interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

interface R2ObjectBody {
  readonly body: ReadableStream<Uint8Array>;
  readonly httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream<Uint8Array> | ArrayBuffer | Blob | string,
    options?: { httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

interface ImageInfo {
  format: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

interface ImageTransformationResult {
  response(): Response;
}

interface ImageTransformer {
  transform(options: {
    width?: number;
    height?: number;
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop';
  }): ImageTransformer;
  output(options: { format: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'; quality?: number }): Promise<ImageTransformationResult>;
}

interface ImagesBinding {
  info(stream: ReadableStream<Uint8Array>): Promise<ImageInfo>;
  input(stream: ReadableStream<Uint8Array>): ImageTransformer;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

declare module 'cloudflare:workers' {
  export const env: Env;
}
