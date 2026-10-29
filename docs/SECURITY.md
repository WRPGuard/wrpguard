# Security / trust boundary (required review)

## Trust assumptions
The supplied normalized scope is NOT independently verified. The library cannot assert that a relying party is officially registered, has a current certificate, or is entitled to request data. The app integrating the library owns authenticating its scope source and enforcing any policy outcome.

## Risks / mitigations
| Threat | MVP mitigation |
|---|---|
| Supplied scope forged | `pass` wording never implies verified; document untrusted input |
| Unexpected request format bypass | `indeterminate` not `pass`; explicit supported-format allowlist |
| Nested path over-disclosure | exact full-path comparisons; reject parent path from narrow child grant |
| Alternative branch accidentally ignored | cover all requestable branches or `indeterminate` |
| Parser DoS, deep arrays | cap JSON bytes, depth, credentials, claims, path length |
| Prototype pollution | parse as data, never object-merge untrusted `__proto__` keys |
| Leaking personal information | no real credentials; reports include paths/types only, no values |
| Nondeterministic audit | stable sorted reason codes and spec versions in report |
| Stale registration | mark freshness unverified; do not silently claim trust |
| Unsupported member-state profile | clear `indeterminate` until profiled/tested |
| Duplicate JSON keys (parser differential: `JSON.parse` is last-wins, other parsers first-wins) | own strict parser rejects duplicates (ADR-003 §1); test smuggles `birth_date` via a duplicate `claims` key |
| Unknown/extension DCQL properties widening disclosure | `indeterminate` (WRPG-EXT-01) |
| Terminal/log injection via hostile identifiers or keys (ANSI, C1 CSI, bidi overrides) | messages and CLI output escape C0/C1/bidi/zero-width characters; `--json` stays valid JSON |
| Getter/`toJSON` side effects in SDK-supplied objects (incl. non-enumerable or prototype-inherited `toJSON`) | values are snapshotted without invoking accessors; any reachable `toJSON` and non-plain data rejected (ADR-003 §2) |
| Number-literal parser differential (`0.99999999999999999999` rounds to index 1 as a double) | integral numbers must be written as integers (WRPG-SYN-02) |
| Report/output amplification | tightened per-field caps, findings cap, message truncation (ADR-003 §3, §5) |
| Forged, expired or revoked registration certificate | decoded only, never verified; documented in CLI output ("signature NOT verified"), docs and `scopeTrust` (WRPG-CRT-01) |
| Certificate field WRPGuard does not know that might narrow the declaration | rejected, not ignored (WRPG-CRT-01) |
| Parser differential inside a JWT (duplicate keys, number spellings, non-canonical base64url) | strict base64url and UTF-8, strict JSON parser on header and payload (ADR-003 §1a) |
| Oversized file read into memory before checks | CLI stats and reads at most `maxInputBytes + 1` bytes |

Implementation status (v0.1.0-rc.0): every row above has an automated test; see `docs/TEST_MATRIX.md`.

## Test plan
- Fuzz malformed shapes: arrays/objects/null/very deep structures.
- Probe `__proto__`, `constructor`, overlong strings, path null/number edge cases.
- Assert outputs never include raw `values` or user credential content.
- Assert no outbound I/O in `@wrpguard/core`.
- Negative tests are first-class: every mistake must be observable.

## Later certification-grade work (NOT part of v0.1)
Trusted source adapters, signature verification, certificate chaining and revocation, status/freshness, rollover, intermediary relationships, security review, external interoperability trials, applicable privacy/legal assessment.

## Claims to avoid
Never claim "EUDI certified", "cryptographically verified", "legally authorized", "GDPR compliant", "prevents wallet-side overasking", or "complete OpenID4VP validation" based on this MVP.
