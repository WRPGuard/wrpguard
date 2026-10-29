// Decides whether the release workflow publishes (see .github/workflows/release.yml).
// A push releases the package version only if its CHANGELOG heading is dated
// ("## 1.2.3 (YYYY-MM-DD)") and npm does not have that version yet. A manual real publish
// also requires the dated heading; manual dry runs always run.
// Writes `run=true|false` to $GITHUB_OUTPUT when set; exits 1 on an inconsistent release.
import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const event = process.env.EVENT ?? 'workflow_dispatch';
const dryRun = process.env.DRY_RUN === 'true';

export function changelogStatus(changelog, version) {
  const heading = changelog.split(/\r?\n/).find((line) => line.startsWith(`## ${version} `));
  if (heading === undefined) return 'missing';
  return /^## \S+ \(\d{4}-\d{2}-\d{2}\)$/.test(heading) ? 'dated' : 'undated';
}

export function decide({ event, dryRun, status, onNpm }) {
  if (event === 'push') {
    if (onNpm) return { run: false, reason: 'this version is already on npm' };
    if (status !== 'dated') return { run: false, reason: `the CHANGELOG heading for this version is ${status}` };
    return { run: true, reason: 'dated CHANGELOG heading and not on npm yet' };
  }
  if (!dryRun && status !== 'dated') return { error: 'date the CHANGELOG heading for this version before publishing' };
  return { run: true, reason: dryRun ? 'manual dry run' : 'manual release' };
}

function npmHasVersion(name, version) {
  if (!/^[0-9A-Za-z.+-]+$/.test(version)) throw new Error(`unexpected version ${JSON.stringify(version)}`);
  try {
    // A fixed command string (version validated above) works with npm.cmd on Windows too.
    return execSync(`npm view ${name}@${version} version`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === version;
  } catch {
    return false; // npm exits non-zero (E404) when the version does not exist
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = JSON.parse(read('packages/core/package.json')).version;
  const cliVersion = JSON.parse(read('packages/cli/package.json')).version;
  if (cliVersion !== version) {
    console.error(`release-plan: @wrpguard/cli is ${cliVersion} but @wrpguard/core is ${version}`);
    process.exit(1);
  }
  const status = changelogStatus(read('CHANGELOG.md'), version);
  const onNpm = npmHasVersion('@wrpguard/core', version);
  const decision = decide({ event, dryRun, status, onNpm });
  if ('error' in decision) {
    console.error(`release-plan: ${version}: ${decision.error}`);
    process.exit(1);
  }
  console.log(`release-plan: ${version}: ${decision.run ? 'release' : 'skip'} (${decision.reason})`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${String(decision.run)}\n`);
}
