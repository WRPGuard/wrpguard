// Packs @wrpguard/core and @wrpguard/cli for release and verifies what an npm user would get:
// a clean `npm install` of the tarballs, LICENSE.md, no `workspace:` ranges, no "private", and
// the installed CLI's version and exit codes on the fixtures. Writes release/: the tarballs,
// a CycloneDX SBOM and SHA256SUMS. Run `pnpm build` first.
import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'release');
const packages = ['core', 'cli'];
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const version = readJson(join(root, 'packages/core/package.json')).version;

function fail(message) {
  console.error(`pack-release: ${message}`);
  process.exit(1);
}
function sh(command, cwd) {
  return execSync(command, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
const tarballs = packages.map((name) => {
  const dir = join(root, 'packages', name);
  if (readJson(join(dir, 'package.json')).version !== version) fail(`@wrpguard/${name} version differs from core (${version})`);
  if (!existsSync(join(dir, 'dist'))) fail(`packages/${name}/dist is missing; run pnpm build first`);
  sh(`pnpm pack --pack-destination "${out}"`, dir);
  const file = `wrpguard-${name}-${version}.tgz`;
  if (!existsSync(join(out, file))) fail(`pnpm pack did not produce ${file}`);
  return file;
});

// Install exactly the tarballs, as a user would, in a throwaway project.
const project = join(out, 'install-check');
mkdirSync(project);
writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'wrpguard-release', version, private: true }));
sh(`npm install --no-audit --no-fund --ignore-scripts ${tarballs.map((file) => `"${join(out, file)}"`).join(' ')}`, project);

for (const name of packages) {
  const dir = join(project, 'node_modules', '@wrpguard', name);
  const manifest = readJson(join(dir, 'package.json'));
  if ('private' in manifest) fail(`@wrpguard/${name} is marked private`);
  if (JSON.stringify(manifest.dependencies ?? {}).includes('workspace:')) fail(`@wrpguard/${name} has a workspace: range`);
  if (!existsSync(join(dir, 'LICENSE.md'))) fail(`@wrpguard/${name} has no LICENSE.md`);
}

const bin = join(project, 'node_modules', '@wrpguard', 'cli', 'dist', 'bin.js');
const reported = sh(`node "${bin}" --version`).trim();
if (reported !== version) fail(`installed wrpguard --version prints ${reported}, expected ${version}`);
const context = ['--service', 'onboarding', '--intended-use', 'age-check'];
for (const [request, expected] of [['request-pass.json', 0], ['request-overask.json', 2], ['request-indeterminate.json', 3]]) {
  const args = [bin, 'check', '--scope', join(root, 'fixtures', 'scope.json'), '--request', join(root, 'fixtures', request), ...context];
  const { status } = spawnSync(process.execPath, args, { stdio: 'ignore' });
  if (status !== expected) fail(`installed wrpguard exited ${String(status)} on ${request}, expected ${String(expected)}`);
}

const sbom = `wrpguard-${version}.cdx.json`;
writeFileSync(join(out, sbom), sh('npm sbom --sbom-format cyclonedx --omit dev', project));
rmSync(project, { recursive: true, force: true });

const sums = [...tarballs, sbom].map((file) => `${createHash('sha256').update(readFileSync(join(out, file))).digest('hex')}  ${file}`);
writeFileSync(join(out, 'SHA256SUMS'), `${sums.join('\n')}\n`);
console.log(sums.join('\n'));
console.log(`pack-release: ${version} packed, installed from tarballs and verified`);
