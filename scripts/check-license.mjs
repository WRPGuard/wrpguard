// Checks that every package ships the owner-selected license: the same LICENSE.md as the
// repository root (npm packs it from each package directory) and the matching SPDX id.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SPDX_ID = 'PolyForm-Noncommercial-1.0.0';
const NOTICE = 'Required Notice: Copyright 2026 Vynx Labs LLC (licensing@vynx-labs.dev)\n';
const packageDirs = ['packages/core', 'packages/cli'];

const problems = [];
const license = readFileSync(join(root, 'LICENSE.md'), 'utf8');
if (!license.startsWith(NOTICE)) problems.push('LICENSE.md: missing or changed Required Notice line');
if (!license.includes('# PolyForm Noncommercial License 1.0.0')) problems.push('LICENSE.md: not the PolyForm Noncommercial 1.0.0 text');

for (const dir of ['.', ...packageDirs]) {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
  if (manifest.license !== SPDX_ID) problems.push(`${dir}/package.json: license must be "${SPDX_ID}"`);
}
for (const dir of packageDirs) {
  let copy;
  try {
    copy = readFileSync(join(root, dir, 'LICENSE.md'), 'utf8');
  } catch {
    copy = undefined;
  }
  if (copy !== license) problems.push(`${dir}/LICENSE.md: missing or different from the root LICENSE.md`);
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`check-license: ${SPDX_ID} in the root and ${String(packageDirs.length)} packages`);
