// Runs the COMPILED `wrpguard` binary against the synthetic fixtures and checks exit codes
// (ACCEPTANCE T18, AGENTS.md completion gate). Requires `pnpm build` first.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const bin = 'packages/cli/dist/bin.js';
if (!existsSync(new URL(`../${bin}`, import.meta.url))) {
  console.error(`smoke: ${bin} not found; run "pnpm build" first`);
  process.exit(1);
}

const context = ['--service', 'onboarding', '--intended-use', 'age-check'];
const cases = [
  ['request-pass.json', context, 0],
  ['request-mdoc-pass.json', context, 0],
  ['request-overask.json', context, 2],
  ['request-claim-sets-overask.json', context, 2],
  ['request-indeterminate.json', context, 3],
  ['request-unsupported-format.json', context, 3],
  ['request-credential-sets-unsupported.json', context, 3],
  ['request-pass.json', [], 3],
  ['request-malformed-path.json', context, 1],
];

let failures = 0;
for (const [request, extra, expected] of cases) {
  for (const json of [false, true]) {
    const args = [bin, 'check', '--scope', 'fixtures/scope.json', '--request', `fixtures/${request}`, ...extra];
    if (json) args.push('--json');
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    let note = '';
    if (json) {
      try {
        const document = JSON.parse(result.stdout);
        note = document.decision ?? document.status;
      } catch {
        note = 'INVALID JSON ON STDOUT';
        failures++;
      }
    }
    const ok = result.status === expected;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} exit=${String(result.status)} expected=${String(expected)} ${json ? '--json ' : '       '}${request} ${extra.length ? '(context)' : '(no context)'} ${note}`);
  }
}

const usage = spawnSync(process.execPath, [bin, 'check'], { cwd: root, encoding: 'utf8' });
const usageOk = usage.status === 1 && usage.stdout === '';
if (!usageOk) failures++;
console.log(`${usageOk ? 'ok  ' : 'FAIL'} exit=${String(usage.status)} expected=1 usage error (missing options)`);

// The library example (examples/basic) must keep producing its documented outcomes.
const example = spawnSync(process.execPath, ['examples/basic/preflight.mjs'], { cwd: root, encoding: 'utf8' });
const expectedExample = [
  'age-only: pass -> send',
  'age-and-birth-date: fail -> blocked (UNREGISTERED_CLAIM_PATH at /credentials/0/claims/1/path)',
  'no-claims-list: indeterminate -> blocked (MISSING_CLAIM_SELECTION at /credentials/0)',
];
const exampleOk = example.status === 0 && example.stdout.trim().split(/\r?\n/).join('\n') === expectedExample.join('\n');
if (!exampleOk) failures++;
console.log(`${exampleOk ? 'ok  ' : 'FAIL'} exit=${String(example.status)} expected=0 examples/basic/preflight.mjs output`);

if (failures > 0) {
  console.error(`smoke: ${String(failures)} failure(s)`);
  process.exit(1);
}
console.log('smoke: all CLI exit codes and the library example as documented');
