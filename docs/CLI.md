# `wrpguard` CLI reference (0.1)

```
wrpguard check --scope <file> --request <file> [--service <id>] [--intended-use <id>] [--json]
wrpguard check --registration-cert <file> --request <file> [--intended-use <id>] [--json]
wrpguard --help | --version
```

| Option | Meaning |
|---|---|
| `--scope <file>` | Scope declaration, schema `wrpguard.scope/1` (see below). Caller-supplied and **unverified**. |
| `--registration-cert <file>` | Instead of `--scope`: an ETSI TS 119 475 registration certificate, as the compact JWT (`typ` `rc-wrp+jwt`), the base64url-wrapped JWT from a request's `verifier_info` `registration_cert` element (ETSI TS 119 472-2 RO-16), or the decoded JSON payload. Decoded, **not verified**. See below. |
| `--request <file>` | A bare DCQL query: the value of the Authorization Request's `dcql_query`, not the whole request. |
| `--service <id>` | Service the request will be sent for. Must equal `scope.serviceId`. Not allowed with `--registration-cert`. |
| `--intended-use <id>` | Intended use the request is for. Must equal `scope.intendedUseId`, or the certificate's `intended_use_id`. |
| `--json` | Print exactly one JSON document to stdout: a report (`wrpguard.report/1`) or an `invalid_input` report. |

Each option may appear once, and exactly one of `--scope` and `--registration-cert` is required. With `--scope`, missing `--service` or `--intended-use` gives `indeterminate` (`MISSING_CONTEXT`); this is deliberate (ADR-001). `--help` and `--version` must be the only argument; combined with anything else they are a usage error (exit 1), so exit 0 always means an evaluated `pass`.

## Exit codes
| Exit | Meaning |
|---|---|
| 0 | `pass`: the query matches the supplied declaration under `wrpguard.policy/0.1` |
| 2 | `fail`: a detected mismatch |
| 3 | `indeterminate`: WRPGuard cannot establish a safe match |
| 1 | invalid input (`MALFORMED_*`, `INPUT_TOO_LARGE`), usage error, unreadable file, or internal error |

## Streams
- Human report → stdout. Invalid-input details, usage and I/O errors → stderr.
- With `--json`, reports and invalid-input reports → stdout; usage and I/O errors → stderr only.
- Every string derived from input is escaped for terminals (C0/C1 controls, bidi controls, zero-width characters). JSON output stays valid and equivalent.
- `WRPGUARD_DEBUG=1` prints a stack trace for internal errors.

## Input handling
- Files over 1 MiB are refused before parsing (`INPUT_TOO_LARGE`). Files must be valid UTF-8; one leading BOM is accepted.
- JSON is parsed by WRPGuard's strict parser: duplicate keys, comments, trailing commas, non-finite numbers, and integral numbers written with a fraction or exponent (`1.0`, `1e0`) are rejected.
- Non-regular files (directories, devices, FIFOs) are rejected without blocking.
- No network access, no files written, no telemetry.

## Scope declaration (`wrpguard.scope/1`)
```json
{
  "schemaVersion": "wrpguard.scope/1",
  "relyingPartyId": "rp-demo",
  "serviceId": "onboarding",
  "intendedUseId": "age-check",
  "credentials": [
    { "format": "dc+sd-jwt", "type": "https://example.org/credentials/age-attestation", "claims": [["age_over_18"]] },
    { "format": "mso_mdoc", "type": "org.iso.18013.5.1.mDL", "claims": [["org.iso.18013.5.1", "age_over_18"]] }
  ],
  "snapshot": { "observedAt": "2026-10-28T00:00:00Z", "sourceLabel": "synthetic-test-only" }
}
```
Closed schema (JSON Schema: `@wrpguard/core/schemas/scope-1.schema.json`): unknown properties are rejected. One entry per `format` + `type`; `claims` are exact OpenID4VP claims path pointers (mdoc: exactly `[namespace, element]`). `snapshot` is informational and never evaluated; it is not evidence of provenance or freshness. Mapping from EUDI TS5: ADR-002.

## Registration certificate (`--registration-cert`)
An ETSI TS 119 475 V1.2.1 wallet-relying party registration certificate can replace the scope file: the compact JWT (`typ` `rc-wrp+jwt`), the base64url-wrapped JWT from a request's `verifier_info` `registration_cert` element (ETSI TS 119 472-2 RO-16), or the decoded JSON payload.

- Its `credentials` entries are the declaration: for each `vct_values` entry (or `doctype_value`), the paths in `claim`. Entries for the same format and type are merged.
- An entry without `claim` declares the credential type but **no claims**, so requesting any claim of it fails. (Annex B.2.9 says such a certificate "does not declare any specific attributes"; some wallets read it as allowing any claim.)
- Unknown fields inside a credentials entry, its `meta` or its claims are rejected (exit 1), including `claims` where the specification says `claim`. Payload fields that do not describe requestable data (name, policies, entitlements, ...) are ignored.
- The certificate covers one intended use and is sent with the request, so no context is needed. `--intended-use` is optional and must equal `intended_use_id`; if the certificate has no `intended_use_id`, a given `--intended-use` cannot be confirmed (exit 3). `--service` is a usage error.
- **Not checked:** signature, certificate chain, status list, `iat`/`exp`. A `pass` means only that the query fits the certificate's `credentials` as written. CWT certificates (`rc-wrp+cwt`) are not supported.
- Report `subject`: `relyingPartyId` = `sub`, `intendedUseId` = `intended_use_id` (or `""`), `serviceId` = `""`.

Rules: ADR-002 WRPG-CRT-01 and WRPG-CRT-02.

## Report (`--json`)
```json
{
  "reportVersion": "wrpguard.report/1",
  "decision": "fail",
  "findings": [
    {
      "code": "UNREGISTERED_CLAIM_PATH",
      "effect": "fail",
      "ruleId": "WRPG-CLM-01",
      "source": "dcqlQuery",
      "pointer": "/credentials/0/claims/1/path",
      "message": "Claim path [\"birth_date\"] is not registered for dc+sd-jwt type \"https://example.org/credentials/age-attestation\" (exact path match required).",
      "credentialQueryId": "age",
      "format": "dc+sd-jwt",
      "credentialType": "https://example.org/credentials/age-attestation",
      "claimPath": ["birth_date"]
    }
  ],
  "findingsTruncated": false,
  "totalFindings": 1,
  "subject": { "relyingPartyId": "rp-demo", "serviceId": "onboarding", "intendedUseId": "age-check" },
  "evaluated": { "credentialQueries": 1, "claimQueries": 2 },
  "policyVersion": "wrpguard.policy/0.1",
  "standardsSnapshot": { "dcql": "…", "registrationModel": "…" },
  "scopeTrust": "caller-supplied-unverified",
  "notice": "pass means only that …"
}
```
Reason codes, rule IDs and their basis: [ADR-001](adr/ADR-001-api-contract.md) §5 and [ADR-002](adr/ADR-002-standards-traceability.md). JSON Schemas for the report and the scope declaration: `@wrpguard/core/schemas/report-1.schema.json` and `scope-1.schema.json` (see [API reference](API.md#json-schemas)).
