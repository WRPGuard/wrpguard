# ADR-001 — Public API, report contract, reason codes, CLI exit codes

- **Status:** Accepted by lead, **frozen for v0.1**. Owner review requested. Any change to a frozen item requires a revision of this ADR.
- **Date:** 2026-10-28
- **Related:** ADR-002 (standards traceability), ADR-003 (input security), `docs/KIT_AUDIT.md`

## Context
WRPGuard evaluates a proposed OpenID4VP 1.0 DCQL query against a **caller-supplied, unverified** normalized scope declaration. The kit proposed `evaluateDcqlScope({ scope, dcqlQuery, context })` and asked the lead to freeze it before implementation.

## Decision

### 1. Packages
| Package | Contents | Runtime deps | I/O |
|---|---|---|---|
| `@wrpguard/core` | types, strict JSON parser, DCQL/scope/context validation, matcher, report | **none** | **none** (no `node:` imports, no network, filesystem, time, randomness) |
| `@wrpguard/cli` | `wrpguard` binary: reads local files, prints report | `@wrpguard/core` only | local file read, stdout/stderr |

ESM only, Node.js `>=22`, TypeScript `strict`. Packages are published only by the manual `release` workflow with npm provenance (`docs/RELEASING.md`); `publishConfig.provenance` makes a local `npm publish` fail. Publishing remains an owner decision (OWNER_APPROVAL_GATES). License: `PolyForm-Noncommercial-1.0.0` (owner decision 2026-10-28, `docs/LICENSING_DECISION.md`); each package ships `LICENSE.md`.

### 2. Functions (frozen)
```ts
evaluateDcqlScope(input: EvaluateInput, options?: EvaluateOptions): EvaluationResult
evaluateDcqlScopeFromJson(input: EvaluateJsonInput, options?: EvaluateOptions): EvaluationResult
parseJsonStrict(text: string, limits?: Partial<Limits>): JsonParseResult
```
```ts
interface EvaluateInput     { scope: unknown; dcqlQuery: unknown; context: EvaluationContext }
interface EvaluateJsonInput { scopeJson: string; dcqlQueryJson: string; context: EvaluationContext }
interface EvaluationContext { serviceId?: string; intendedUseId?: string }
interface EvaluateOptions   { limits?: Partial<Limits> }

type EvaluationResult =
  | { ok: true;  report: EvaluationReport }
  | { ok: false; error: InputErrorReport };
```
- Inputs are `unknown` and **always validated**; TypeScript types are not trusted at runtime.
- `evaluateDcqlScopeFromJson` is the recommended entry point for raw text: only the strict parser can detect duplicate object keys (ADR-003).
- The core never throws for bad *data*. It throws `TypeError` only for caller programming errors (e.g. invalid `options.limits`). An unexpected exception is never converted into `pass`.

### 3. Report (`reportVersion: "wrpguard.report/1"`)
```ts
interface EvaluationReport {
  reportVersion: 'wrpguard.report/1';
  decision: 'pass' | 'fail' | 'indeterminate';
  findings: Finding[];            // sorted, deterministic, possibly truncated
  findingsTruncated: boolean;
  totalFindings: number;
  subject: { relyingPartyId: string; serviceId: string; intendedUseId: string };   // from the supplied scope
  evaluated: { credentialQueries: number; claimQueries: number };
  policyVersion: 'wrpguard.policy/0.1';
  standardsSnapshot: { dcql: string; registrationModel: string };
  scopeTrust: 'caller-supplied-unverified';
  notice: string;                 // fixed disclaimer: what pass does and does not mean
}
interface Finding {
  code: ReasonCode;
  effect: 'fail' | 'indeterminate';
  ruleId: string;                 // ADR-002 rule ID, e.g. "WRPG-CLM-01"
  source: 'dcqlQuery' | 'scope' | 'context';
  pointer: string;                // RFC 6901 JSON Pointer into `source`
  message: string;                // control/bidi characters escaped
  credentialQueryId?: string;
  format?: string;
  credentialType?: string;        // vct or doctype identifier, never a claim value
  claimPath?: (string | number | null)[];
}
```
The kit's `severity` field is named `effect` because it states which decision the finding forces. `scopeTrust` and `notice` are emitted in every report so that machine consumers cannot lose the trust boundary.

### 4. Input error report
```ts
interface InputErrorReport {
  reportVersion: 'wrpguard.report/1';
  status: 'invalid_input';
  issues: InputIssue[];           // aggregated across scope, dcqlQuery and context; capped
  issuesTruncated: boolean;
  policyVersion: 'wrpguard.policy/0.1';
}
interface InputIssue { code: InputErrorCode; source: 'dcqlQuery' | 'scope' | 'context'; pointer: string; message: string }
```

### 5. Reason codes (frozen)
Decision findings:

| Code | Effect | Rule |
|---|---|---|
| `WRONG_SERVICE` | fail | WRPG-CTX-01 |
| `WRONG_INTENDED_USE` | fail | WRPG-CTX-02 |
| `MISSING_CONTEXT` | indeterminate | WRPG-CTX-03 *(added by this ADR)* |
| `UNSUPPORTED_CREDENTIAL_FORMAT` | indeterminate | WRPG-FMT-01 |
| `UNREGISTERED_CREDENTIAL_TYPE` | fail | WRPG-TYP-01 |
| `UNREGISTERED_CLAIM_PATH` | fail | WRPG-CLM-01 |
| `MISSING_CLAIM_SELECTION` | indeterminate | WRPG-CLM-02 |
| `UNSUPPORTED_DCQL_PROPERTY` | indeterminate | WRPG-EXT-01 *(added by this ADR)* |
| `UNRESOLVED_ALTERNATIVES` | indeterminate | **reserved**, not emitted by policy 0.1 (superset strategy resolves all alternatives, ADR-002) |

Input error codes: `MALFORMED_DCQL`, `MALFORMED_SCOPE`, `MALFORMED_CONTEXT`, `INPUT_TOO_LARGE`.

### 6. Decision precedence
`fail` > `indeterminate` > `pass`. A proven mismatch is `fail` even if other parts are unknown. `pass` requires zero findings. Invalid input yields no decision at all (`ok: false`).

### 7. Determinism
- Findings are derived by walking known properties, never by object key order.
- Sort order: `source` (`context`, `scope`, `dcqlQuery`), then pointer segment-wise (array indices numerically), then `code`, then `credentialType`.
- Reports with more than `maxReportedFindings` findings keep the first N after sorting; `totalFindings` and `findingsTruncated` are always exact.
- No timestamps, random IDs, or environment data in reports.

### 8. CLI (frozen)
```
wrpguard check --scope <file> --request <file> [--service <id>] [--intended-use <id>] [--json]
wrpguard --help | --version
```
| Exit | Meaning |
|---|---|
| 0 | `pass` — matches the supplied declaration under policy 0.1 |
| 2 | `fail` — detected mismatch |
| 3 | `indeterminate` — insufficient or unsupported evidence |
| 1 | invalid input, usage error, I/O error, internal error |

`--json` prints exactly one JSON document to stdout (a report, or an `invalid_input` error report); usage/I/O errors go to stderr only. Human output goes to stdout, diagnostics to stderr. The CLI makes no network calls and writes no files.

### 9. Versioning
`wrpguard.scope/1` (input schema), `wrpguard.report/1` (output shape), `wrpguard.policy/0.1` (evaluation semantics) are versioned independently. Any change that can turn a previous `fail`/`indeterminate` into `pass` requires a new **policy** version and an ADR-002 entry.

## Consequences
- The 60-second demo needs `--service onboarding --intended-use age-check` (kit audit A1).
- SDK users passing pre-parsed objects lose duplicate-key protection; documented.
- Two new reason codes beyond the kit list; one reserved code.
