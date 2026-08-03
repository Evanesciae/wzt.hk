import { webcrypto } from 'node:crypto';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const password = process.argv[2] === '--stdin' ? await readStdin() : process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: npm run admin:password -- "a password with at least 12 characters"');
  process.exit(1);
}

const iterations = 100_000;
const encode = (bytes) => Buffer.from(bytes).toString('base64url');
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await webcrypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveBits'],
);
const derived = await webcrypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
  key,
  256,
);

console.log(`pbkdf2-sha256$${iterations}$${encode(salt)}$${encode(new Uint8Array(derived))}`);
