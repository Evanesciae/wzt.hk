import { readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, relative, sep } from 'node:path';

const sourceDirectory = join(process.cwd(), 'data', 'media', 'originals');
const bucket = process.env.R2_BUCKET || 'wzt-hk-media-preview';
const concurrency = Math.max(1, Number(process.env.UPLOAD_CONCURRENCY) || 4);
const wrangler = join(process.cwd(), 'node_modules', '.bin', 'wrangler');

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function runWrangler(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(wrangler, args, {
      cwd: process.cwd(),
      env: { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(output.trim() || `Wrangler exited with code ${code}`));
    });
  });
}

async function upload(file, attempt = 1) {
  const key = `originals/${relative(sourceDirectory, file).split(sep).join('/')}`;
  try {
    await runWrangler([
      'r2', 'object', 'put', `${bucket}/${key}`,
      '--remote',
      '--file', file,
      '--content-type', 'image/jpeg',
      '--cache-control', 'public, max-age=31536000, immutable',
    ]);
  } catch (error) {
    if (attempt >= 3) throw new Error(`${key}: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    return upload(file, attempt + 1);
  }
}

const files = await collectFiles(sourceDirectory);
const bytes = (await Promise.all(files.map(async (file) => (await stat(file)).size)))
  .reduce((sum, size) => sum + size, 0);
let cursor = 0;
let completed = 0;

console.log(`Uploading ${files.length} originals (${(bytes / 1024 / 1024).toFixed(1)} MB) to ${bucket}...`);

async function worker() {
  while (cursor < files.length) {
    const index = cursor++;
    await upload(files[index]);
    completed += 1;
    if (completed % 10 === 0 || completed === files.length) {
      console.log(`Uploaded ${completed}/${files.length}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
console.log('Media upload complete.');
