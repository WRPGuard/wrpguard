/**
 * T18 and CLI behavior (ADR-001 §8). Runs the real command implementation in-process against
 * real files; `pnpm smoke` repeats the exit-code table against the compiled binary.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { EXIT_CODES, run } from '../src/cli.js';
import { VERSION } from '../src/version.js';

const FIXTURES = fileURLToPath(new URL('../../../fixtures/', import.meta.url));
const fx = (name: string): string => join(FIXTURES, name);
const CONTEXT_ARGS = ['--service', 'onboarding', '--intended-use', 'age-check'];
const TMP = mkdtempSync(join(tmpdir(), 'wrpguard-cli-test-'));

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

async function cli(...argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const code = await run(argv, { stdout: (t) => (stdout += t), stderr: (t) => (stderr += t) });
  return { code, stdout, stderr };
}

function check(request: string, ...extra: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return cli('check', '--scope', fx('scope.json'), '--request', request, ...extra);
}

function tempFile(name: string, content: string | Buffer): string {
  const path = join(TMP, name);
  writeFileSync(path, content);
  return path;
}

describe('T18 exit codes per documented result', () => {
  const table: [string, string[], number][] = [
    ['request-pass.json', CONTEXT_ARGS, 0],
    ['request-mdoc-pass.json', CONTEXT_ARGS, 0],
    ['request-overask.json', CONTEXT_ARGS, 2],
    ['request-claim-sets-overask.json', CONTEXT_ARGS, 2],
    ['request-indeterminate.json', CONTEXT_ARGS, 3],
    ['request-unsupported-format.json', CONTEXT_ARGS, 3],
    ['request-credential-sets-unsupported.json', CONTEXT_ARGS, 3],
    ['request-pass.json', [], 3],
    ['request-pass.json', ['--service', 'checkout', '--intended-use', 'age-check'], 2],
    ['request-malformed-path.json', CONTEXT_ARGS, 1],
  ];
  for (const [request, extra, expected] of table) {
    it(`${request} ${extra.join(' ') || '(no context)'} => exit ${String(expected)}`, async () => {
      for (const json of [false, true]) {
        const { code } = await check(fx(request), ...extra, ...(json ? ['--json'] : []));
        expect(code).toBe(expected);
      }
    });
  }

  it('exit code constants match ADR-001', () => {
    expect(EXIT_CODES).toEqual({ pass: 0, error: 1, fail: 2, indeterminate: 3 });
  });
});

describe('--json output', () => {
  it('prints exactly one parseable report on stdout and nothing on stderr', async () => {
    const { stdout, stderr } = await check(fx('request-overask.json'), ...CONTEXT_ARGS, '--json');
    expect(stderr).toBe('');
    const report = JSON.parse(stdout) as { decision: string; findings: { code: string }[]; scopeTrust: string };
    expect(report.decision).toBe('fail');
    expect(report.findings.map((f) => f.code)).toEqual(['UNREGISTERED_CLAIM_PATH']);
    expect(report.scopeTrust).toBe('caller-supplied-unverified');
  });

  it('prints an invalid_input document for malformed input', async () => {
    const { code, stdout } = await check(fx('request-malformed-path.json'), ...CONTEXT_ARGS, '--json');
    expect(code).toBe(1);
    const error = JSON.parse(stdout) as { status: string; issues: { code: string; pointer: string }[] };
    expect(error.status).toBe('invalid_input');
    expect(error.issues).toMatchObject([{ code: 'MALFORMED_DCQL', pointer: '/credentials/0/claims/0/path/1' }]);
  });

  it('is byte-identical across runs (determinism)', async () => {
    const first = await check(fx('request-credential-sets-unsupported.json'), ...CONTEXT_ARGS, '--json');
    const second = await check(fx('request-credential-sets-unsupported.json'), ...CONTEXT_ARGS, '--json');
    expect(second.stdout).toBe(first.stdout);
  });

  it('escapes display-unsafe characters but stays valid JSON with the exact value', async () => {
    const rlo = String.fromCharCode(0x202e);
    const csi = String.fromCharCode(0x9b);
    const vct = `https://example.org/${rlo}evil${csi}2J`;
    const request = tempFile('hostile.json', JSON.stringify({ credentials: [{ id: 'x', format: 'dc+sd-jwt', meta: { vct_values: [vct] }, claims: [{ path: ['a'] }] }] }));
    const { stdout } = await check(request, ...CONTEXT_ARGS, '--json');
    expect(stdout).not.toContain(rlo);
    expect(stdout).not.toContain(csi);
    const report = JSON.parse(stdout) as { findings: { credentialType: string }[] };
    expect(report.findings[0]?.credentialType).toBe(vct);
  });
});

describe('human output', () => {
  it('shows decision, unverified-scope wording and the disclaimer on stdout', async () => {
    const { code, stdout, stderr } = await check(fx('request-overask.json'), ...CONTEXT_ARGS);
    expect(code).toBe(2);
    expect(stderr).toBe('');
    expect(stdout).toContain('WRPGuard preflight: FAIL (exit 2)');
    expect(stdout).toContain('caller-supplied, unverified');
    expect(stdout).toContain('UNREGISTERED_CLAIM_PATH (WRPG-CLM-01) at dcqlQuery/credentials/0/claims/1/path');
    expect(stdout).toContain('not proof of registration authenticity');
  });

  it('writes invalid-input details to stderr, not stdout', async () => {
    const { code, stdout, stderr } = await check(fx('request-malformed-path.json'), ...CONTEXT_ARGS);
    expect(code).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('INVALID INPUT');
    expect(stderr).toContain('MALFORMED_DCQL');
  });

  it('escapes hostile identifiers and unknown property names', async () => {
    const rlo = String.fromCharCode(0x202e);
    const esc = String.fromCharCode(0x1b);
    const request = tempFile(
      'hostile-key.json',
      JSON.stringify({ credentials: [{ id: 'x', format: 'dc+sd-jwt', meta: { vct_values: ['https://example.org/credentials/age-attestation'] }, claims: [{ path: ['age_over_18'] }], [`${esc}[2J${rlo}`]: 1 }] }),
    );
    const { code, stdout } = await check(request, ...CONTEXT_ARGS);
    expect(code).toBe(3);
    expect(stdout).not.toContain(esc);
    expect(stdout).not.toContain(rlo);
    expect(stdout).toContain('\\u001b');
  });
});

describe('usage and I/O errors => exit 1', () => {
  const usage: [string, string[]][] = [
    ['no command', []],
    ['unknown command', ['lint']],
    ['unknown option', ['check', '--scope', fx('scope.json'), '--request', fx('request-pass.json'), '--fast']],
    ['missing --scope', ['check', '--request', fx('request-pass.json')]],
    ['missing --request', ['check', '--scope', fx('scope.json')]],
    ['repeated --scope', ['check', '--scope', fx('scope.json'), '--scope', fx('scope.json'), '--request', fx('request-pass.json')]],
    ['extra positional', ['check', 'extra', '--scope', fx('scope.json'), '--request', fx('request-pass.json')]],
    ['option without value', ['check', '--scope']],
    // Reviewer finding F5: exit 0 must not be reachable without an evaluation.
    ['--help combined with check', ['check', '--scope', fx('scope.json'), '--request', fx('request-overask.json'), '--help']],
    ['--version combined with check', ['check', '--version']],
    ['--help with --version', ['--help', '--version']],
  ];
  for (const [label, argv] of usage) {
    it(label, async () => {
      const { code, stdout, stderr } = await cli(...argv);
      expect(code).toBe(1);
      expect(stdout).toBe('');
      expect(stderr).toContain('wrpguard --help');
    });
  }

  it('missing file', async () => {
    const { code, stderr } = await check(join(TMP, 'does-not-exist.json'), ...CONTEXT_ARGS);
    expect(code).toBe(1);
    expect(stderr).toContain('--request: file not found');
  });

  it('directory instead of file', async () => {
    const { code, stderr } = await cli('check', '--scope', TMP, '--request', fx('request-pass.json'));
    expect(code).toBe(1);
    expect(stderr).toContain('--scope: not a regular file');
  });

  // Reviewer note: opening a FIFO without a writer used to block forever (POSIX only).
  it.skipIf(process.platform === 'win32')('a FIFO is rejected without hanging', async () => {
    const fifo = join(TMP, 'request.fifo');
    expect(spawnSync('mkfifo', [fifo]).status).toBe(0);
    const { code, stderr } = await check(fifo, ...CONTEXT_ARGS);
    expect(code).toBe(1);
    expect(stderr).toContain('not a regular file');
  });

  it('file larger than maxInputBytes is refused before parsing', async () => {
    const big = tempFile('big.json', Buffer.alloc(2 * 1024 * 1024, 0x20));
    const { code, stdout } = await check(big, ...CONTEXT_ARGS, '--json');
    expect(code).toBe(1);
    expect(JSON.parse(stdout)).toMatchObject({ status: 'invalid_input', issues: [{ code: 'INPUT_TOO_LARGE', source: 'dcqlQuery' }] });
  });

  it('invalid UTF-8 is malformed input', async () => {
    const bad = tempFile('bad-utf8.json', Buffer.from([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]));
    const { code, stdout } = await check(bad, ...CONTEXT_ARGS, '--json');
    expect(code).toBe(1);
    expect(JSON.parse(stdout)).toMatchObject({ issues: [{ code: 'MALFORMED_DCQL' }] });
  });

  it('a UTF-8 BOM (common on Windows) is accepted', async () => {
    const withBom = tempFile('bom.json', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), readFileSync(fx('request-pass.json'))]));
    expect((await check(withBom, ...CONTEXT_ARGS)).code).toBe(0);
  });

  it('empty --service is malformed context', async () => {
    const { code, stdout } = await check(fx('request-pass.json'), '--service', '', '--intended-use', 'age-check', '--json');
    expect(code).toBe(1);
    expect(JSON.parse(stdout)).toMatchObject({ issues: [{ code: 'MALFORMED_CONTEXT' }] });
  });
});

describe('--registration-cert (ETSI TS 119 475, WRPG-CRT-01/02)', () => {
  const cert = (file: string, request: string, ...extra: string[]) =>
    cli('check', '--registration-cert', fx(file), '--request', fx(request), ...extra);

  it.each([
    ['registration-cert.jwt', 'request-pass.json', [], 0],
    ['registration-cert.json', 'request-pass.json', [], 0],
    ['registration-cert.jwt', 'request-mdoc-pass.json', ['--intended-use', 'age-check'], 0],
    ['registration-cert.jwt', 'request-overask.json', [], 2],
    ['registration-cert.jwt', 'request-pass.json', ['--intended-use', 'other'], 2],
    ['registration-cert.json', 'request-indeterminate.json', [], 3],
    ['registration-cert.jwt', 'request-malformed-path.json', [], 1],
  ] as const)('%s + %s %j => exit %i', async (file, request, extra, expected) => {
    expect((await cert(file, request, ...extra)).code).toBe(expected);
    const json = await cert(file, request, ...extra, '--json');
    expect(json.code).toBe(expected);
    expect(json.stderr).toBe('');
  });

  it('human output names the certificate and says the signature is not verified', async () => {
    const { stdout } = await cert('registration-cert.jwt', 'request-pass.json');
    expect(stdout).toContain('Registration certificate: subject "synthetic-rp-0001", intended use "age-check" (decoded, signature NOT verified)');
  });

  it.each([
    ['--service with a certificate', ['--registration-cert', fx('registration-cert.jwt'), '--request', fx('request-pass.json'), '--service', 'x'], 'no service identifier'],
    ['both --scope and --registration-cert', ['--scope', fx('scope.json'), '--registration-cert', fx('registration-cert.jwt'), '--request', fx('request-pass.json')], 'not both'],
    ['neither declaration option', ['--request', fx('request-pass.json')], '--scope or --registration-cert'],
    ['--registration-cert twice', ['--registration-cert', fx('registration-cert.jwt'), '--registration-cert', fx('registration-cert.jwt'), '--request', fx('request-pass.json')], 'more than once'],
  ])('usage error: %s', async (_name, args, message) => {
    const { code, stdout, stderr } = await cli('check', ...args);
    expect(code).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain(message);
  });

  it('a binary (CWT) certificate file is invalid input with a hint', async () => {
    const path = tempFile('cert.cwt', Buffer.from([0xd2, 0x84, 0x43, 0xa1, 0x01, 0x26, 0xff]));
    const { code, stderr } = await cli('check', '--registration-cert', path, '--request', fx('request-pass.json'));
    expect(code).toBe(1);
    expect(stderr).toContain('MALFORMED_SCOPE');
    expect(stderr).toContain('rc-wrp+cwt');
  });
});

describe('help and version', () => {
  it('--help prints usage with exit codes', async () => {
    const { code, stdout } = await cli('--help');
    expect(code).toBe(0);
    expect(stdout).toContain('wrpguard check --scope <file> --request <file>');
    expect(stdout).toContain('3  indeterminate');
  });

  it('--version matches package.json', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(VERSION).toBe(pkg.version);
    expect((await cli('--version')).stdout).toBe(`${pkg.version}\n`);
  });
});
