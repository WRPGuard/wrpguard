// Removes a build output directory relative to the current package (cross-platform `rm -rf`).
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2];
if (target !== 'dist') {
  console.error('clean.mjs only removes "dist"');
  process.exit(1);
}
rmSync(resolve(process.cwd(), target), { recursive: true, force: true });
