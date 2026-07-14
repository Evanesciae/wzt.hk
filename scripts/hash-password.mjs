import { hash } from '@node-rs/argon2';

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: npm run admin:password -- "at-least-12-characters"');
  process.exit(1);
}
console.log(await hash(password, { memoryCost: 19456, timeCost: 3, parallelism: 1, outputLen: 32 }));

