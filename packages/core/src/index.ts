/**
 * @wrpguard/core — experimental offline preflight.
 *
 * Checks whether a proposed OpenID4VP 1.0 DCQL query fits a caller-supplied, UNVERIFIED scope
 * declaration. `pass` is not proof of authorization, registration authenticity, certificate
 * validity, consent, or conformance. See ADR-001 for the frozen contract.
 */
export { evaluateDcqlRegistrationCertificate, evaluateDcqlScope, evaluateDcqlScopeFromJson } from './evaluate.js';
export { parseJsonStrict } from './json.js';
export type { JsonArray, JsonError, JsonErrorCode, JsonObject, JsonParseResult, JsonValue } from './json.js';
export { DEFAULT_LIMITS } from './limits.js';
export type { Limits } from './limits.js';
export { escapeControlCharacters, escapeJsonForDisplay } from './text.js';
export {
  INPUT_ERROR_CODES,
  POLICY_VERSION,
  REASON_CODES,
  REPORT_NOTICE,
  REPORT_VERSION,
  SCOPE_SCHEMA_VERSION,
  STANDARDS_SNAPSHOT,
  SUPPORTED_FORMATS,
} from './types.js';
export type {
  ClaimPath,
  ClaimPathElement,
  Decision,
  EvaluateInput,
  EvaluateJsonInput,
  EvaluateOptions,
  EvaluateRegistrationCertificateInput,
  EvaluationContext,
  EvaluationReport,
  EvaluationResult,
  Finding,
  InputErrorCode,
  InputErrorReport,
  InputIssue,
  InputSource,
  ReasonCode,
  SupportedFormat,
} from './types.js';
