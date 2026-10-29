/**
 * `wrpguard` command implementation (ADR-001 §8). Offline: reads two local files, writes to
 * stdout/stderr, makes no network calls and writes no files. The declaration is a
 * wrpguard.scope/1 file (--scope) or an ETSI TS 119 475 registration certificate
 * (--registration-cert, WRPG-CRT-01/02).
 */
import { parseArgs } from 'node:util';
import {
  DEFAULT_LIMITS,
  POLICY_VERSION,
  REPORT_VERSION,
  escapeControlCharacters,
  evaluateDcqlRegistrationCertificate,
  evaluateDcqlScopeFromJson,
  type EvaluationContext,
  type InputErrorReport,
  type InputIssue,
} from '@wrpguard/core';
import { readInputFile } from './files.js';
import { EXIT_CODES, renderInputError, renderJson, renderReport } from './format.js';
import { VERSION } from './version.js';

export { EXIT_CODES } from './format.js';

export interface CliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface CliOptions {
  /** Print stack traces for internal errors (WRPGUARD_DEBUG=1). */
  readonly debug?: boolean;
}

export const USAGE = `Usage:
  wrpguard check --scope <file> --request <file> [--service <id>] [--intended-use <id>] [--json]
  wrpguard check --registration-cert <file> --request <file> [--intended-use <id>] [--json]
  wrpguard --help | --version

Checks offline whether an OpenID4VP 1.0 DCQL query (--request) fits a caller-supplied,
UNVERIFIED declaration: a scope file (--scope, schema wrpguard.scope/1) or an ETSI TS 119 475
registration certificate (--registration-cert, signature NOT verified).

Options:
  --scope <file>              scope declaration JSON (wrpguard.scope/1)
  --registration-cert <file>  registration certificate: compact JWT (rc-wrp+jwt) or its JSON payload
  --request <file>            bare DCQL query JSON (the value of "dcql_query")
  --service <id>              service the request will be sent for; must equal scope.serviceId
                              (not allowed with --registration-cert: certificates have no service ID)
  --intended-use <id>         intended use the request is for; must equal scope.intendedUseId, or
                              the certificate intended_use_id (optional with --registration-cert)
  --json                      print one JSON document (report or invalid-input report) to stdout
  -h, --help            show this help
  --version             show version

Exit codes:
  0  pass           matches the supplied declaration under ${POLICY_VERSION}
  2  fail           detected mismatch
  3  indeterminate  insufficient or unsupported evidence (e.g. missing --service/--intended-use)
  1  error          invalid input, usage error, unreadable file, internal error

"pass" is not proof of registration authenticity, certificate validity, legal
authorization, consent, or EUDI/OpenID4VP conformance.
`;

class UsageError extends Error {}

export async function run(argv: readonly string[], io: CliIo, options: CliOptions = {}): Promise<number> {
  try {
    return await runCommand(argv, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`wrpguard: ${escapeControlCharacters(error.message)}\nRun "wrpguard --help" for usage.\n`);
      return EXIT_CODES.error;
    }
    io.stderr('wrpguard: internal error; no decision was made.\n');
    if (options.debug === true && error instanceof Error && error.stack !== undefined) {
      io.stderr(`${escapeControlCharacters(error.stack)}\n`);
    }
    return EXIT_CODES.error;
  }
}

async function runCommand(argv: readonly string[], io: CliIo): Promise<number> {
  const args = parseCommandLine(argv);
  if (args.help) {
    io.stdout(USAGE);
    return 0;
  }
  if (args.version) {
    io.stdout(`${VERSION}\n`);
    return 0;
  }

  const [scopeRead, requestRead] = await Promise.all([
    readInputFile(args.declaration.file, DEFAULT_LIMITS.maxInputBytes),
    readInputFile(args.request, DEFAULT_LIMITS.maxInputBytes),
  ]);

  const ioErrors: string[] = [];
  const issues: InputIssue[] = [];
  const declarationOption = args.declaration.kind === 'scope' ? '--scope' : '--registration-cert';
  for (const [label, source, outcome] of [
    [declarationOption, 'scope', scopeRead],
    ['--request', 'dcqlQuery', requestRead],
  ] as const) {
    if (outcome.kind === 'io-error') {
      ioErrors.push(`${label}: ${outcome.message}`);
    } else if (outcome.kind === 'too-large') {
      issues.push({ code: 'INPUT_TOO_LARGE', source, pointer: '', message: outcome.message });
    } else if (outcome.kind === 'invalid-utf8') {
      issues.push({
        code: source === 'scope' ? 'MALFORMED_SCOPE' : 'MALFORMED_DCQL',
        source,
        pointer: '',
        message:
          label === '--registration-cert'
            ? `${outcome.message}; CWT registration certificates (rc-wrp+cwt) are not supported`
            : outcome.message,
      });
    }
  }
  if (ioErrors.length > 0) {
    io.stderr(`wrpguard: ${ioErrors.join('; ')}\n`);
    return EXIT_CODES.error;
  }
  if (issues.length > 0 || scopeRead.kind !== 'ok' || requestRead.kind !== 'ok') {
    return printInputError(
      { reportVersion: REPORT_VERSION, status: 'invalid_input', issues, issuesTruncated: false, policyVersion: POLICY_VERSION },
      args.json,
      io,
    );
  }

  const context: { serviceId?: string; intendedUseId?: string } = {};
  if (args.service !== undefined) context.serviceId = args.service;
  if (args.intendedUse !== undefined) context.intendedUseId = args.intendedUse;

  const result =
    args.declaration.kind === 'scope'
      ? evaluateDcqlScopeFromJson({ scopeJson: scopeRead.text, dcqlQueryJson: requestRead.text, context: context satisfies EvaluationContext })
      : evaluateDcqlRegistrationCertificate({ registrationCertificate: scopeRead.text, dcqlQueryJson: requestRead.text, context });
  if (!result.ok) return printInputError(result.error, args.json, io);

  io.stdout(args.json ? renderJson(result.report) : renderReport(result.report, args.declaration.kind));
  return EXIT_CODES[result.report.decision];
}

function printInputError(error: InputErrorReport, json: boolean, io: CliIo): number {
  if (json) io.stdout(renderJson(error));
  else io.stderr(renderInputError(error));
  return EXIT_CODES.error;
}

interface CheckArgs {
  readonly help: boolean;
  readonly version: boolean;
  readonly json: boolean;
  readonly declaration: { readonly kind: 'scope' | 'registrationCertificate'; readonly file: string };
  readonly request: string;
  readonly service: string | undefined;
  readonly intendedUse: string | undefined;
}

function parseCommandLine(argv: readonly string[]): CheckArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        scope: { type: 'string', multiple: true },
        'registration-cert': { type: 'string', multiple: true },
        request: { type: 'string', multiple: true },
        service: { type: 'string', multiple: true },
        'intended-use': { type: 'string', multiple: true },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean' },
      },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : 'invalid arguments');
  }
  const { values, positionals } = parsed;
  const base = {
    help: false,
    version: false,
    json: values.json === true,
    declaration: { kind: 'scope' as const, file: '' },
    request: '',
    service: undefined,
    intendedUse: undefined,
  };
  // Exit 0 also means "pass", so --help/--version must not be combinable with a check.
  if (values.help === true || values.version === true) {
    if (argv.length !== 1) throw new UsageError('--help and --version must be the only argument');
    return { ...base, help: values.help === true, version: values.version === true };
  }

  if (positionals.length === 0) throw new UsageError('missing command (expected "check")');
  if (positionals[0] !== 'check') throw new UsageError(`unknown command ${JSON.stringify(positionals[0])}`);
  if (positionals.length > 1) throw new UsageError('unexpected extra arguments');

  const single = (name: string, list: string[] | undefined, required: boolean): string | undefined => {
    if (list === undefined || list.length === 0) {
      if (required) throw new UsageError(`missing required option --${name}`);
      return undefined;
    }
    if (list.length > 1) throw new UsageError(`option --${name} given more than once`);
    return list[0];
  };
  const scope = single('scope', values.scope, false);
  const certificate = single('registration-cert', values['registration-cert'], false);
  if (scope !== undefined && certificate !== undefined) throw new UsageError('use either --scope or --registration-cert, not both');
  if (scope === undefined && certificate === undefined) throw new UsageError('missing required option --scope or --registration-cert');
  const service = single('service', values.service, false);
  if (certificate !== undefined && service !== undefined) {
    throw new UsageError('--service cannot be used with --registration-cert: a registration certificate has no service identifier');
  }
  return {
    ...base,
    declaration: scope !== undefined ? { kind: 'scope', file: scope } : { kind: 'registrationCertificate', file: certificate as string },
    request: single('request', values.request, true) as string,
    service,
    intendedUse: single('intended-use', values['intended-use'], false),
  };
}
