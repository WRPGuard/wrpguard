/**
 * Public contract of @wrpguard/core, frozen by ADR-001.
 * Changing anything here requires an ADR-001 revision.
 */
import type { Limits } from './limits.js';

export type Decision = 'pass' | 'fail' | 'indeterminate';

/** Which input a finding or issue points into. */
export type InputSource = 'dcqlQuery' | 'scope' | 'context';

/** One element of an OpenID4VP claims path pointer (§7). */
export type ClaimPathElement = string | number | null;
export type ClaimPath = readonly ClaimPathElement[];

export const SUPPORTED_FORMATS = ['dc+sd-jwt', 'mso_mdoc'] as const;
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

export const REASON_CODES = [
  'WRONG_SERVICE',
  'WRONG_INTENDED_USE',
  'MISSING_CONTEXT',
  'UNSUPPORTED_CREDENTIAL_FORMAT',
  'UNREGISTERED_CREDENTIAL_TYPE',
  'UNREGISTERED_CLAIM_PATH',
  'MISSING_CLAIM_SELECTION',
  'UNSUPPORTED_DCQL_PROPERTY',
  /** Reserved; not emitted by policy 0.1 (ADR-001 §5). */
  'UNRESOLVED_ALTERNATIVES',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const INPUT_ERROR_CODES = [
  'MALFORMED_DCQL',
  'MALFORMED_SCOPE',
  'MALFORMED_CONTEXT',
  'INPUT_TOO_LARGE',
] as const;
export type InputErrorCode = (typeof INPUT_ERROR_CODES)[number];

export const REPORT_VERSION = 'wrpguard.report/1';
export const POLICY_VERSION = 'wrpguard.policy/0.1';
export const SCOPE_SCHEMA_VERSION = 'wrpguard.scope/1';

export const STANDARDS_SNAPSHOT = Object.freeze({
  dcql: 'OpenID4VP 1.0 Final (2025-07-09): Sections 6, 7; Appendix B.2, B.3',
  registrationModel:
    'Informed by EUDI TS5 v1.6 (2026-09-30); registration certificates per ETSI TS 119 475 V1.2.1 (2026-03), decoded without signature verification',
});

export const REPORT_NOTICE =
  'pass means only that the DCQL query matched the caller-supplied scope declaration under ' +
  `${POLICY_VERSION}. It is not proof of registration authenticity, certificate validity, ` +
  'legal authorization, user consent, or EUDI/OpenID4VP conformance.';

export interface Finding {
  readonly code: ReasonCode;
  readonly effect: 'fail' | 'indeterminate';
  /** ADR-002 rule ID. */
  readonly ruleId: string;
  readonly source: InputSource;
  /** RFC 6901 JSON Pointer into `source`. */
  readonly pointer: string;
  readonly message: string;
  readonly credentialQueryId?: string;
  readonly format?: string;
  /** `vct` or `doctype` identifier; never a claim value. */
  readonly credentialType?: string;
  readonly claimPath?: ClaimPath;
}

export interface EvaluationReport {
  readonly reportVersion: typeof REPORT_VERSION;
  readonly decision: Decision;
  readonly findings: readonly Finding[];
  readonly findingsTruncated: boolean;
  readonly totalFindings: number;
  readonly subject: {
    readonly relyingPartyId: string;
    readonly serviceId: string;
    readonly intendedUseId: string;
  };
  readonly evaluated: {
    readonly credentialQueries: number;
    readonly claimQueries: number;
  };
  readonly policyVersion: typeof POLICY_VERSION;
  readonly standardsSnapshot: typeof STANDARDS_SNAPSHOT;
  readonly scopeTrust: 'caller-supplied-unverified';
  readonly notice: string;
}

export interface InputIssue {
  readonly code: InputErrorCode;
  readonly source: InputSource;
  readonly pointer: string;
  readonly message: string;
}

export interface InputErrorReport {
  readonly reportVersion: typeof REPORT_VERSION;
  readonly status: 'invalid_input';
  readonly issues: readonly InputIssue[];
  readonly issuesTruncated: boolean;
  readonly policyVersion: typeof POLICY_VERSION;
}

export type EvaluationResult =
  | { readonly ok: true; readonly report: EvaluationReport }
  | { readonly ok: false; readonly error: InputErrorReport };

/** Selected service and intended use the caller asserts the request is for. */
export interface EvaluationContext {
  readonly serviceId?: string;
  readonly intendedUseId?: string;
}

export interface EvaluateInput {
  readonly scope: unknown;
  readonly dcqlQuery: unknown;
  readonly context: EvaluationContext;
}

export interface EvaluateJsonInput {
  readonly scopeJson: string;
  readonly dcqlQueryJson: string;
  readonly context: EvaluationContext;
}

/** A registration certificate instead of a scope file (ADR-002 WRPG-CRT-01, WRPG-CRT-02). */
export interface EvaluateRegistrationCertificateInput {
  /** ETSI TS 119 475 WRPRC: the compact JWT (`typ: rc-wrp+jwt`) or its decoded JSON payload. Not verified. */
  readonly registrationCertificate: string;
  readonly dcqlQueryJson: string;
  /** Optional: `intendedUseId` is checked against the certificate's `intended_use_id`; `serviceId` is rejected. */
  readonly context?: EvaluationContext;
}

export interface EvaluateOptions {
  readonly limits?: Partial<Limits>;
}
