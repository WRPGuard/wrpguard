/**
 * Evaluation and report assembly (ADR-001 §3–§7, ADR-002 rule table).
 *
 * Superset strategy (ADR-002): every listed credential query and every listed claims query is
 * evaluated, regardless of `credential_sets` / `claim_sets`, so no requestable branch is skipped.
 */
import { decodeRegistrationCertificate, parseRegistrationCertificate } from './certificate.js';
import { parseJsonStrict, snapshotValue, type JsonError, type JsonValue } from './json.js';
import { resolveLimits, type Limits } from './limits.js';
import { buildScopeIndex, lookupCredential, matchPath } from './match.js';
import { parseContext, parseDcqlQuery, parseScope, type ContextNode, type DcqlQueryNode, type ScopeNode } from './parse.js';
import { appendPointer, comparePointers, compareStrings, formatPath, quote } from './text.js';
import {
  POLICY_VERSION,
  REPORT_NOTICE,
  REPORT_VERSION,
  STANDARDS_SNAPSHOT,
  type Decision,
  type EvaluateInput,
  type EvaluateJsonInput,
  type EvaluateOptions,
  type EvaluateRegistrationCertificateInput,
  type EvaluationResult,
  type Finding,
  type InputIssue,
  type InputSource,
} from './types.js';

/** Evaluates pre-parsed values. Prefer `evaluateDcqlScopeFromJson` for raw text (duplicate-key safety). */
export function evaluateDcqlScope(input: EvaluateInput, options?: EvaluateOptions): EvaluationResult {
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('evaluateDcqlScope expects an input object');
  }
  const limits = resolveLimits(options?.limits);
  const issues: InputIssue[] = [];
  const scope = fromSnapshot(snapshotValue(input.scope, limits), 'scope', issues);
  const dcqlQuery = fromSnapshot(snapshotValue(input.dcqlQuery, limits), 'dcqlQuery', issues);
  const context = fromSnapshot(snapshotValue(input.context ?? {}, limits), 'context', issues);
  return evaluateValues(scope, dcqlQuery, context, issues, limits);
}

/** Parses both JSON texts with the strict parser, then evaluates. */
export function evaluateDcqlScopeFromJson(input: EvaluateJsonInput, options?: EvaluateOptions): EvaluationResult {
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('evaluateDcqlScopeFromJson expects an input object');
  }
  if (typeof input.scopeJson !== 'string' || typeof input.dcqlQueryJson !== 'string') {
    throw new TypeError('scopeJson and dcqlQueryJson must be strings');
  }
  const limits = resolveLimits(options?.limits);
  const issues: InputIssue[] = [];
  const scope = fromParse(parseJsonStrict(input.scopeJson, limits), 'scope', issues);
  const dcqlQuery = fromParse(parseJsonStrict(input.dcqlQueryJson, limits), 'dcqlQuery', issues);
  const context = fromSnapshot(snapshotValue(input.context ?? {}, limits), 'context', issues);
  return evaluateValues(scope, dcqlQuery, context, issues, limits);
}

/**
 * Evaluates a DCQL query against an ETSI TS 119 475 registration certificate (compact JWT or its
 * JSON payload) instead of a wrpguard.scope/1 file. The certificate is NOT verified (ADR-002
 * WRPG-CRT-01). It covers one intended use, so the context is optional (WRPG-CRT-02).
 */
export function evaluateDcqlRegistrationCertificate(
  input: EvaluateRegistrationCertificateInput,
  options?: EvaluateOptions,
): EvaluationResult {
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('evaluateDcqlRegistrationCertificate expects an input object');
  }
  if (typeof input.registrationCertificate !== 'string' || typeof input.dcqlQueryJson !== 'string') {
    throw new TypeError('registrationCertificate and dcqlQueryJson must be strings');
  }
  const limits = resolveLimits(options?.limits);
  const issues: InputIssue[] = [];
  const certificate = decodeRegistrationCertificate(input.registrationCertificate, limits);
  issues.push(...certificate.issues);
  const dcqlQuery = fromParse(parseJsonStrict(input.dcqlQueryJson, limits), 'dcqlQuery', issues);
  const context = fromSnapshot(snapshotValue(input.context ?? {}, limits), 'context', issues);
  return evaluateValues(certificate.payload, dcqlQuery, context, issues, limits, 'registrationCertificate');
}

/** Which kind of declaration the scope input is; it selects the parser and the context rules. */
type DeclarationKind = 'scope' | 'registrationCertificate';

const MALFORMED_CODE = {
  scope: 'MALFORMED_SCOPE',
  dcqlQuery: 'MALFORMED_DCQL',
  context: 'MALFORMED_CONTEXT',
} as const;

function toIssue(error: JsonError, source: InputSource, prefix: string): InputIssue {
  return {
    code: error.code === 'INPUT_TOO_LARGE' ? 'INPUT_TOO_LARGE' : MALFORMED_CODE[source],
    source,
    pointer: error.pointer,
    message: `${prefix}: ${error.message}`,
  };
}

function fromParse(result: ReturnType<typeof parseJsonStrict>, source: InputSource, issues: InputIssue[]): JsonValue | undefined {
  if (result.ok) return result.value;
  issues.push(toIssue(result.error, source, 'invalid JSON'));
  return undefined;
}

function fromSnapshot(result: ReturnType<typeof snapshotValue>, source: InputSource, issues: InputIssue[]): JsonValue | undefined {
  if (result.ok) return result.value;
  issues.push(toIssue(result.error, source, 'not plain JSON data'));
  return undefined;
}

function evaluateValues(
  scopeValue: JsonValue | undefined,
  dcqlValue: JsonValue | undefined,
  contextValue: JsonValue | undefined,
  issues: InputIssue[],
  limits: Limits,
  kind: DeclarationKind = 'scope',
): EvaluationResult {
  const parseDeclaration = kind === 'scope' ? parseScope : parseRegistrationCertificate;
  const scope = scopeValue === undefined ? undefined : collect(parseDeclaration(scopeValue, limits), issues);
  const dcql = dcqlValue === undefined ? undefined : collect(parseDcqlQuery(dcqlValue, limits), issues);
  const context = contextValue === undefined ? undefined : collect(parseContext(contextValue), issues);
  if (kind === 'registrationCertificate' && context?.serviceId !== undefined) {
    issues.push({
      code: 'MALFORMED_CONTEXT',
      source: 'context',
      pointer: '/serviceId',
      message: 'A registration certificate has no service identifier (ETSI TS 119 475), so serviceId cannot be checked; omit it (WRPG-CRT-02).',
    });
  }

  if (issues.length > 0 || scope === undefined || dcql === undefined || context === undefined) {
    const sorted = [...issues].sort(compareIssues);
    return {
      ok: false,
      error: {
        reportVersion: REPORT_VERSION,
        status: 'invalid_input',
        issues: sorted.slice(0, limits.maxReportedIssues),
        issuesTruncated: sorted.length > limits.maxReportedIssues,
        policyVersion: POLICY_VERSION,
      },
    };
  }

  const bindingFindings = kind === 'scope' ? contextFindings(scope, context) : certificateContextFindings(scope, context);
  const findings = [...bindingFindings, ...queryFindings(scope, dcql)].sort(compareFindings);
  return {
    ok: true,
    report: {
      reportVersion: REPORT_VERSION,
      decision: decide(findings),
      findings: findings.slice(0, limits.maxReportedFindings),
      findingsTruncated: findings.length > limits.maxReportedFindings,
      totalFindings: findings.length,
      subject: {
        relyingPartyId: scope.relyingPartyId,
        serviceId: scope.serviceId,
        intendedUseId: scope.intendedUseId,
      },
      evaluated: {
        credentialQueries: dcql.credentials.length,
        claimQueries: dcql.credentials.reduce((sum, query) => sum + (query.claims?.length ?? 0), 0),
      },
      policyVersion: POLICY_VERSION,
      standardsSnapshot: STANDARDS_SNAPSHOT,
      scopeTrust: 'caller-supplied-unverified',
      notice: REPORT_NOTICE,
    },
  };
}

function collect<T>(outcome: { readonly node: T | undefined; readonly issues: readonly InputIssue[] }, issues: InputIssue[]): T | undefined {
  issues.push(...outcome.issues);
  return outcome.node;
}

/** fail > indeterminate > pass (ADR-001 §6). `pass` requires zero findings. */
function decide(findings: readonly Finding[]): Decision {
  if (findings.some((finding) => finding.effect === 'fail')) return 'fail';
  return findings.length > 0 ? 'indeterminate' : 'pass';
}

function contextFindings(scope: ScopeNode, context: ContextNode): Finding[] {
  const findings: Finding[] = [];
  if (context.serviceId === undefined) {
    findings.push({
      code: 'MISSING_CONTEXT',
      effect: 'indeterminate',
      ruleId: 'WRPG-CTX-03',
      source: 'context',
      pointer: '/serviceId',
      message: 'No selected serviceId was supplied, so the request cannot be bound to the declared service.',
    });
  } else if (context.serviceId !== scope.serviceId) {
    findings.push({
      code: 'WRONG_SERVICE',
      effect: 'fail',
      ruleId: 'WRPG-CTX-01',
      source: 'context',
      pointer: '/serviceId',
      message: `Selected serviceId ${quote(context.serviceId)} does not match the supplied scope serviceId ${quote(scope.serviceId)}.`,
    });
  }
  if (context.intendedUseId === undefined) {
    findings.push({
      code: 'MISSING_CONTEXT',
      effect: 'indeterminate',
      ruleId: 'WRPG-CTX-03',
      source: 'context',
      pointer: '/intendedUseId',
      message: 'No selected intendedUseId was supplied, so the request cannot be bound to the declared intended use.',
    });
  } else if (context.intendedUseId !== scope.intendedUseId) {
    findings.push({
      code: 'WRONG_INTENDED_USE',
      effect: 'fail',
      ruleId: 'WRPG-CTX-02',
      source: 'context',
      pointer: '/intendedUseId',
      message: `Selected intendedUseId ${quote(context.intendedUseId)} does not match the supplied scope intendedUseId ${quote(scope.intendedUseId)}.`,
    });
  }
  return findings;
}

/**
 * WRPG-CRT-02: the certificate travels with the request and covers one intended use, so it binds
 * the request by itself. A supplied intendedUseId is checked against `intended_use_id`.
 */
function certificateContextFindings(scope: ScopeNode, context: ContextNode): Finding[] {
  const selected = context.intendedUseId;
  if (selected === undefined || selected === scope.intendedUseId) return [];
  const base = { ruleId: 'WRPG-CRT-02', source: 'context' as const, pointer: '/intendedUseId' };
  if (scope.intendedUseId === '') {
    return [
      {
        ...base,
        code: 'MISSING_CONTEXT',
        effect: 'indeterminate',
        message: `The registration certificate has no intended_use_id, so the selected intended use ${quote(selected)} cannot be confirmed.`,
      },
    ];
  }
  return [
    {
      ...base,
      code: 'WRONG_INTENDED_USE',
      effect: 'fail',
      message: `Selected intendedUseId ${quote(selected)} does not match the registration certificate's intended_use_id ${quote(scope.intendedUseId)}.`,
    },
  ];
}

function queryFindings(scope: ScopeNode, dcql: DcqlQueryNode): Finding[] {
  const findings: Finding[] = [];
  const index = buildScopeIndex(scope);

  for (const pointer of dcql.unsupportedProperties) {
    findings.push({
      code: 'UNSUPPORTED_DCQL_PROPERTY',
      effect: 'indeterminate',
      ruleId: 'WRPG-EXT-01',
      source: 'dcqlQuery',
      pointer,
      message:
        'This property is not modeled by WRPGuard policy 0.1 and could change what is requested. ' +
        'OpenID4VP 1.0 §6 tells implementations to ignore unknown properties; WRPGuard conservatively does not pass.',
    });
  }

  for (const query of dcql.credentials) {
    const base = { source: 'dcqlQuery' as const, credentialQueryId: query.id, format: query.format };
    const format = query.supportedFormat;
    if (format === undefined) {
      findings.push({
        ...base,
        code: 'UNSUPPORTED_CREDENTIAL_FORMAT',
        effect: 'indeterminate',
        ruleId: 'WRPG-FMT-01',
        pointer: appendPointer(query.pointer, 'format'),
        message: `Credential format ${quote(query.format)} is not supported by WRPGuard policy 0.1 (supported: "dc+sd-jwt", "mso_mdoc"); its requested claims were not evaluated.`,
      });
      continue;
    }

    const registeredTypes = [];
    for (const type of query.types) {
      const registered = lookupCredential(index, format, type.value);
      if (registered === undefined) {
        findings.push({
          ...base,
          code: 'UNREGISTERED_CREDENTIAL_TYPE',
          effect: 'fail',
          ruleId: 'WRPG-TYP-01',
          pointer: type.pointer,
          credentialType: type.value,
          message: `Credential type ${quote(type.value)} (${format}) is not registered in the supplied scope. Every requested type must be registered.`,
        });
      } else {
        registeredTypes.push({ type: type.value, registered });
      }
    }

    if (query.claims === undefined) {
      findings.push({
        ...base,
        code: 'MISSING_CLAIM_SELECTION',
        effect: 'indeterminate',
        ruleId: 'WRPG-CLM-02',
        pointer: query.pointer,
        message:
          'claims is absent. This is valid under OpenID4VP 1.0 §6.4.1 (mandatory claims only), but WRPGuard policy ' +
          'cannot determine the disclosed claims from paths alone and does not pass.',
      });
    } else {
      for (const claim of query.claims) {
        for (const { type, registered } of registeredTypes) {
          const match = matchPath(registered, claim.path);
          if (match === 'registered') continue;
          const reason =
            match === 'parent-of-registered'
              ? ' The requested path is a parent of a registered path; requesting a parent discloses all of its descendants.'
              : registered.paths.size === 0
                ? ' No claim paths are declared for this type.'
                : '';
          findings.push({
            ...base,
            code: 'UNREGISTERED_CLAIM_PATH',
            effect: 'fail',
            ruleId: 'WRPG-CLM-01',
            pointer: appendPointer(claim.pointer, 'path'),
            credentialType: type,
            claimPath: claim.path,
            message: `Claim path ${formatPath(claim.path)} is not registered for ${format} type ${quote(type)} (exact path match required).${reason}`,
          });
        }
      }
    }

    for (const pointer of query.emptyClaimSetOptions) {
      findings.push({
        ...base,
        code: 'MISSING_CLAIM_SELECTION',
        effect: 'indeterminate',
        ruleId: 'WRPG-CLM-02',
        pointer,
        message: 'An empty claim_sets option selects no claims, which WRPGuard policy treats like an absent claims list.',
      });
    }
  }
  return findings;
}

const SOURCE_ORDER: Readonly<Record<InputSource, number>> = { context: 0, scope: 1, dcqlQuery: 2 };

function compareFindings(a: Finding, b: Finding): number {
  return (
    SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
    comparePointers(a.pointer, b.pointer) ||
    compareStrings(a.code, b.code) ||
    compareStrings(a.credentialType ?? '', b.credentialType ?? '')
  );
}

function compareIssues(a: InputIssue, b: InputIssue): number {
  return (
    SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
    comparePointers(a.pointer, b.pointer) ||
    compareStrings(a.code, b.code) ||
    compareStrings(a.message, b.message)
  );
}
