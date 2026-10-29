# `@wrpguard/core` API reference (0.1.x)

```sh
npm install @wrpguard/core
```
ESM only, Node.js >= 22, zero runtime dependencies. The core does no I/O: no network, filesystem, clock or randomness. The frozen contract and its rationale are in [ADR-001](adr/ADR-001-api-contract.md); input limits and parser design in [ADR-003](adr/ADR-003-input-security.md).

`pass` means only that the DCQL query matched the scope declaration **you supplied**, under policy `wrpguard.policy/0.1`. WRPGuard does not authenticate the declaration, validate certificates or signatures, or assess legal basis or conformance.

## Quick start
```ts
import { evaluateDcqlScopeFromJson } from '@wrpguard/core';

const result = evaluateDcqlScopeFromJson({
  scopeJson,      // string: your wrpguard.scope/1 declaration
  dcqlQueryJson,  // string: the value of the Authorization Request's dcql_query
  context: { serviceId: 'onboarding', intendedUseId: 'age-check' },
});
if (!result.ok) {
  // invalid input: result.error.issues
} else if (result.report.decision !== 'pass') {
  // do not send: result.report.findings
}
```
A complete runnable integration is in [`examples/basic`](../examples/basic/).

## Functions

### `evaluateDcqlScopeFromJson(input, options?)`
`(input: EvaluateJsonInput, options?: EvaluateOptions) => EvaluationResult`

Parses `scopeJson` and `dcqlQueryJson` with the strict parser, validates them and the context, and evaluates. **Use this for any text you did not construct yourself**: only the strict parser can reject duplicate JSON keys and integral numbers written as `1.0` or `1e0`, which other parsers may read differently (parser differentials, ADR-003).

### `evaluateDcqlScope(input, options?)`
`(input: EvaluateInput, options?: EvaluateOptions) => EvaluationResult`

Same evaluation for values you already have in memory (`scope` and `dcqlQuery` are `unknown` and always validated). The values are copied without invoking getters; getters, `toJSON`, non-plain objects and cycles are rejected as invalid input. Duplicate keys cannot be detected after `JSON.parse`, and a `Proxy` can run code during inspection, so prefer `evaluateDcqlScopeFromJson` for untrusted text.

Both functions return a result and never throw for bad data. They throw `TypeError` only for caller programming errors, such as an invalid `options.limits` value.

### `evaluateDcqlRegistrationCertificate(input, options?)`
`(input: EvaluateRegistrationCertificateInput, options?: EvaluateOptions) => EvaluationResult`

Evaluates the query against an ETSI TS 119 475 registration certificate instead of a scope file. `registrationCertificate` is the compact JWT (`typ` `rc-wrp+jwt`), the base64url-wrapped JWT from a request's `verifier_info` `registration_cert` element (ETSI TS 119 472-2 RO-16), or the decoded JSON payload. The certificate is **decoded, not verified**: no signature, chain, status or expiry check. Rules, including how an entry without `claim` is read: [CLI reference](CLI.md#registration-certificate---registration-cert) and ADR-002 WRPG-CRT-01/02.

```ts
const result = evaluateDcqlRegistrationCertificate({
  registrationCertificate, // string
  dcqlQueryJson,           // string
  context: { intendedUseId: 'age-check' }, // optional; serviceId is rejected
});
```
The report has the same shape; its `subject` is `{ relyingPartyId: sub, serviceId: '', intendedUseId: intended_use_id ?? '' }`.

### `parseJsonStrict(text, limits?)`
`(text: string, limits?: Partial<Limits>) => JsonParseResult`

The strict, bounded, iterative JSON parser on its own. Rejects duplicate keys, comments, trailing commas, non-finite numbers, integral numbers with a fraction or exponent, and anything over the limits. Returns `{ ok: true, value: JsonValue }` or `{ ok: false, error: JsonError }`, where `JsonError` is `{ code: JsonErrorCode, pointer, message }` and `JsonErrorCode` is `'INVALID_JSON' | 'INPUT_TOO_LARGE'`. Parsed objects have a null prototype. Related types: `JsonValue`, `JsonArray`, `JsonObject`, `JsonParseResult`.

### `escapeControlCharacters(text)` and `escapeJsonForDisplay(jsonText)`
`(text: string) => string`

Make untrusted strings safe to print to a terminal or log. `escapeControlCharacters` replaces C0/C1 controls, bidi controls, zero-width, tag and other invisible characters with `\uXXXX` escapes. `escapeJsonForDisplay` escapes the same non-C0 characters inside already-serialized JSON, so the result is still valid JSON with the same meaning. Report messages are already escaped; use these for anything else you print, such as `credentialType`.

## Inputs
| Type | Shape |
|---|---|
| `EvaluateJsonInput` | `{ scopeJson: string; dcqlQueryJson: string; context: EvaluationContext }` |
| `EvaluateInput` | `{ scope: unknown; dcqlQuery: unknown; context: EvaluationContext }` |
| `EvaluationContext` | `{ serviceId?: string; intendedUseId?: string }`: the service and intended use you are about to send the request for. Missing either gives `indeterminate` (`MISSING_CONTEXT`). |
| `EvaluateRegistrationCertificateInput` | `{ registrationCertificate: string; dcqlQueryJson: string; context?: EvaluationContext }` |
| `EvaluateOptions` | `{ limits?: Partial<Limits> }` |

- **`dcqlQuery`**: the bare DCQL object (the `dcql_query` value), not the whole Authorization Request. Supported formats (`SUPPORTED_FORMATS`, type `SupportedFormat`): `dc+sd-jwt` with `meta.vct_values`, and `mso_mdoc` with `meta.doctype_value`.
- **`scope`**: a `wrpguard.scope/1` declaration (`SCOPE_SCHEMA_VERSION`). Format: [CLI reference](CLI.md#scope-declaration-wrpguardscope1) and the JSON Schema below.

## Results
```ts
type EvaluationResult =
  | { ok: true; report: EvaluationReport }
  | { ok: false; error: InputErrorReport };
```

`EvaluationReport` (`reportVersion: REPORT_VERSION`):

| Field | Meaning |
|---|---|
| `decision` | `Decision`: `'pass' \| 'fail' \| 'indeterminate'`. Precedence `fail` > `indeterminate` > `pass`; `pass` requires zero findings. |
| `findings` | `Finding[]`, sorted deterministically, at most `maxReportedFindings` |
| `findingsTruncated`, `totalFindings` | Always exact, even when the list is cut |
| `subject` | `relyingPartyId`, `serviceId`, `intendedUseId` from the supplied scope |
| `evaluated` | Counts of credential queries and claims queries evaluated |
| `policyVersion` | `POLICY_VERSION` (`wrpguard.policy/0.1`) |
| `standardsSnapshot` | `STANDARDS_SNAPSHOT`: the specification versions the rules were mapped to |
| `scopeTrust` | Always `'caller-supplied-unverified'` |
| `notice` | `REPORT_NOTICE`: the fixed statement of what `pass` does and does not mean |

`Finding`: `code` (`ReasonCode`), `effect` (`'fail' | 'indeterminate'`), `ruleId` (ADR-002 rule), `source` (`InputSource`: `'dcqlQuery' | 'scope' | 'context'`), `pointer` (RFC 6901 JSON Pointer into `source`), `message` (escaped), and when relevant `credentialQueryId`, `format`, `credentialType` (vct or doctype, never a claim value) and `claimPath` (`ClaimPath`, an array of `ClaimPathElement`: `string | number | null`). Requested `values` are never copied into reports.

`InputErrorReport`: `{ reportVersion, status: 'invalid_input', issues: InputIssue[], issuesTruncated, policyVersion }`, where `InputIssue` is `{ code: InputErrorCode, source, pointer, message }`. Issues are aggregated across scope, query and context.

## Reason codes (`REASON_CODES`)
| Code | Effect | Rule | When |
|---|---|---|---|
| `WRONG_SERVICE` | fail | WRPG-CTX-01 | `context.serviceId` differs from the scope |
| `WRONG_INTENDED_USE` | fail | WRPG-CTX-02 | `context.intendedUseId` differs from the scope |
| `MISSING_CONTEXT` | indeterminate | WRPG-CTX-03 | `serviceId` or `intendedUseId` not given |
| `UNSUPPORTED_CREDENTIAL_FORMAT` | indeterminate | WRPG-FMT-01 | A format other than `dc+sd-jwt` / `mso_mdoc` |
| `UNREGISTERED_CREDENTIAL_TYPE` | fail | WRPG-TYP-01 | A requested vct or doctype is not declared for that format |
| `UNREGISTERED_CLAIM_PATH` | fail | WRPG-CLM-01 | A requested claim path is not declared exactly for that type |
| `MISSING_CLAIM_SELECTION` | indeterminate | WRPG-CLM-02 | A credential query has no `claims` (valid OpenID4VP; WRPGuard policy) |
| `UNSUPPORTED_DCQL_PROPERTY` | indeterminate | WRPG-EXT-01 | A property WRPGuard does not model |
| `UNRESOLVED_ALTERNATIVES` | indeterminate | reserved | Not emitted by policy 0.1 |

Input error codes (`INPUT_ERROR_CODES`, type `InputErrorCode`): `MALFORMED_DCQL`, `MALFORMED_SCOPE`, `MALFORMED_CONTEXT`, `INPUT_TOO_LARGE`. Every rule's basis (OpenID4VP clause or WRPGuard policy) is in [ADR-002](adr/ADR-002-standards-traceability.md).

## Limits (`DEFAULT_LIMITS`, type `Limits`)
Override any of them with `options.limits`; each value must be a positive safe integer, otherwise a `TypeError` is thrown. Exceeding a limit gives `INPUT_TOO_LARGE`, never a silently truncated evaluation.

| Limit | Default | Limit | Default |
|---|---|---|---|
| `maxInputBytes` | 1 048 576 | `maxVctValues` | 8 |
| `maxDepth` | 32 | `maxClaimsPerCredentialQuery` | 128 |
| `maxNodes` | 50 000 | `maxPathLength` | 16 |
| `maxStringLength` | 1 024 | `maxCredentialSets` | 64 |
| `maxArrayLength` | 1 024 | `maxClaimSets` | 64 |
| `maxObjectProperties` | 256 | `maxScopeCredentials` | 256 |
| `maxCredentialQueries` | 32 | `maxClaimsPerScopeCredential` | 1 024 |
| `maxReportedIssues` | 100 | `maxReportedFindings` | 200 |

## JSON Schemas
Draft 2020-12 schemas ship with the package:
```ts
import scopeSchema from '@wrpguard/core/schemas/scope-1.schema.json' with { type: 'json' };
import reportSchema from '@wrpguard/core/schemas/report-1.schema.json' with { type: 'json' };
```
- `scope-1.schema.json` describes `wrpguard.scope/1`. The parser additionally enforces one entry per format + type, integral numbers written as integers, no duplicate keys, and the limits above. A test checks that the schema accepts everything the parser accepts and that the two reject the same malformed scopes.
- `report-1.schema.json` describes both result shapes, as printed by `wrpguard check --json`. A test validates every report the library produces against it.

## Versioning
`wrpguard.scope/1`, `wrpguard.report/1` and `wrpguard.policy/0.1` are versioned independently. A change that could turn a previous `fail` or `indeterminate` into `pass` requires a new policy version. Package versions are 0.x: the API may still change between minor versions, and every change is recorded in the [changelog](../CHANGELOG.md).
