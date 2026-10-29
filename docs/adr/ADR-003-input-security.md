# ADR-003 — Parser and matching security decisions

- **Status:** Accepted by lead, frozen for v0.1.
- **Date:** 2026-10-28
- **Revision 1 (2026-10-28):** changes after the independent adversarial review (`docs/SECURITY_REVIEW.md`): integral-number lexeme rule (F1), `toJSON` detection (F2), tighter default limits and message truncation (F3), wider display-escape set (F4), non-blocking file open (FIFO), `--help`/`--version` as sole argument (F5). Marked *(rev. 1)* below.

- **Revision 2 (2026-10-29):** registration certificate decoding (§1a).

## Decisions

### 1. Own strict JSON parser; never `JSON.parse` on untrusted documents
`parseJsonStrict` implements RFC 8259 grammar iteratively (no recursion) and:
- rejects **duplicate object keys** (compared after unescaping). `JSON.parse` is last-wins; other parsers may be first-wins, so accepting duplicates allows a parser-differential false `pass`;
- enforces byte, depth, node, string-length, array-length and object-property caps **during** parsing, so oversized input stops early;
- builds objects with a `null` prototype; `__proto__`, `constructor` and `prototype` are ordinary data keys;
- rejects non-finite numbers (e.g. `1e400`), lone surrogates are accepted as `JSON.parse` does;
- rejects integral numbers written with a fraction or exponent (`1.0`, `1e0`, `0.99999999999999999999`, `1e-400`): as doubles they become integers, but exact-decimal or float-rejecting parsers read them differently *(rev. 1)*;
- accepts one leading UTF-8 BOM (common on Windows editors); any other leading/trailing non-whitespace is an error.

Single string tokens are decoded with `JSON.parse` on the already-validated token only; numbers with `Number()` on a grammar-validated lexeme. This reuses the engine's well-tested escape/number semantics without trusting it for structure.

### 1a. Registration certificate decoding *(rev. 2)*
- The whole certificate text is bounded by `maxInputBytes` before decoding.
- Compact JWT: exactly three non-empty segments; strict unpadded base64url (RFC 7515 §2) with canonical trailing bits; UTF-8 validated (`decodeURIComponent` rejects invalid sequences); header and payload each parsed by the strict parser (§1) with the same limits, so duplicate keys and number spellings are rejected inside the JWT too. `typ` must be `rc-wrp+jwt` (case-insensitive).
- A single base64url value is unwrapped once (the `verifier_info` form, TS 119 472-2 RO-16) and must then be a compact JWT.
- No signature verification and no cryptography in the core (§6). Decoding is not verification; reports keep `scopeTrust: caller-supplied-unverified`.

### 2. Snapshot of pre-parsed SDK values
`evaluateDcqlScope` accepts `unknown`. Before validation, values are copied (iteratively, with the same caps) into fresh null-prototype data:
- only plain objects (prototype `Object.prototype` or `null`), arrays, strings, finite numbers, booleans and `null` are accepted;
- accessor properties (getters) are rejected without being invoked; symbol keys are ignored; sparse arrays are rejected;
- any reachable `toJSON` (own, non-enumerable, or inherited via a polluted `Array.prototype`/`Object.prototype`) is rejected, because `JSON.stringify` would send its result instead of the evaluated data *(rev. 1)*;
- cycles are caught by the depth cap.
Limitation: a `Proxy` can still run code during inspection; callers handling raw text should use `evaluateDcqlScopeFromJson`.

### 3. Limits (defaults; trusted callers may override via `options.limits`)
| Limit | Default | Applies to |
|---|---|---|
| `maxInputBytes` | 1 048 576 (UTF-8 bytes) | each JSON text |
| `maxDepth` | 32 | nesting of arrays/objects |
| `maxNodes` | 50 000 | JSON values per document |
| `maxStringLength` | 1 024 UTF-16 code units *(rev. 1, was 4 096)* | every string and key |
| `maxArrayLength` | 1 024 | every array |
| `maxObjectProperties` | 256 | every object |
| `maxCredentialQueries` | 32 *(rev. 1, was 64)* | `credentials` |
| `maxVctValues` | 8 *(rev. 1, was 32)* | `meta.vct_values` |
| `maxClaimsPerCredentialQuery` | 128 *(rev. 1, was 256)* | `claims` |
| `maxPathLength` | 16 *(rev. 1, was 32)* | claims path pointers (DCQL and scope) |
| `maxCredentialSets` / `maxClaimSets` | 64 / 64 | alternatives |
| `maxScopeCredentials` | 256 | scope `credentials` |
| `maxClaimsPerScopeCredential` | 1 024 | scope `claims` |
| `maxReportedIssues` | 100 | input error report |
| `maxReportedFindings` | 200 *(rev. 1, was 1 000)* | report findings (exact total always reported) |

Exceeding a cap yields `INPUT_TOO_LARGE`. Matching uses a hash set of canonical path keys per `(format, type)`; worst-case work is `credentials × vct_values × claims` lookups: ≤ 32 768 with defaults (was 524 288). Measured worst case inside the limits: a 906 KB request yields a 1.39 MB `--json` report in under 0.3 s *(rev. 1)*.

### 4. Property access
Only own properties are read (`Object.hasOwn`); lookups use `Map`/`Set`, never object-as-dictionary assignment of untrusted keys.

### 5. Output safety
- Findings contain IDs, formats, types and **paths only** — never `values`, never other parts of the input.
- Messages escape C0/C1 control characters, DEL, U+2028/2029, bidi controls, zero-width and other invisible characters (tag characters, variation selectors, Hangul fillers, …) as `\uXXXX`; astral characters become surrogate-pair escapes *(rev. 1: set widened)*.
- Untrusted strings inside messages are shortened (200 characters; 64 per path element). Structured fields keep exact values *(rev. 1)*.
- CLI `--json` output applies the same escaping inside JSON strings (still valid JSON).
- Strings in messages are already bounded by `maxStringLength`.

### 5a. CLI file input and arguments *(rev. 1)*
Files are opened with `O_NONBLOCK` where the platform defines it, because a FIFO without a writer would otherwise block `open()` forever. They are rejected unless they are regular files, and at most `maxInputBytes + 1` bytes are read. `--help`/`--version` must be the sole argument, because exit 0 also means `pass`.

### 6. Purity
`@wrpguard/core` imports nothing outside its own `src/`. Enforced by an ESLint `no-restricted-imports`/`no-restricted-globals` rule and a test that scans core sources for `node:` imports, `fetch`, `XMLHttpRequest`, `WebSocket`, `process`, `Date`, `Math.random`, and runs an evaluation with networking globals replaced by throwing stubs.

### 7. Failure handling
Input problems are aggregated across all three inputs (sorted, capped) into one `invalid_input` result. Internal exceptions propagate; the CLI maps them to exit 1 with a generic message (no stack trace unless `WRPGUARD_DEBUG=1`). No code path converts an exception into `pass`.

## Rejected alternatives
- `JSON.parse` + post-parse walk: cannot detect duplicate keys.
- Third-party schema validator (Ajv, zod): adds runtime dependencies and does not solve duplicates; explicit hand-written validators keep error pointers and policy codes precise.
- Branch enumeration of `claim_sets × credential_sets`: exponential; the superset strategy (ADR-002) is sound and linear.
