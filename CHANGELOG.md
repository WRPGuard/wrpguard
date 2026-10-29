# Changelog

## 0.1.0-rc.2 (unreleased)
- **Registration certificates.** `evaluateDcqlRegistrationCertificate` and `wrpguard check --registration-cert` accept an ETSI TS 119 475 V1.2.1 wallet-relying party registration certificate as the declaration: the compact JWT (`rc-wrp+jwt`), the base64url form carried in a request's `verifier_info` (ETSI TS 119 472-2 RO-16), or the decoded payload. The certificate is decoded, **not verified** (signature, chain, status and expiry are not checked); CWT certificates are not supported. Rules WRPG-CRT-01/02 (ADR-002 revision 2); an entry without `claim` declares no claims, and unknown fields in credentials entries are rejected.
- An unregistered claim of a credential type with no declared claim paths now says so in the finding message.
- `STANDARDS_SNAPSHOT.registrationModel` names ETSI TS 119 475 V1.2.1.
- No change for `wrpguard.scope/1` inputs: same policy (`wrpguard.policy/0.1`), report format and exit codes.

## 0.1.0-rc.1 (2026-10-29)
No change to evaluation semantics (`wrpguard.policy/0.1`), the report format (`wrpguard.report/1`) or the CLI.

- `@wrpguard/core` ships JSON Schemas (draft 2020-12) for the scope declaration and the report: `@wrpguard/core/schemas/scope-1.schema.json` and `@wrpguard/core/schemas/report-1.schema.json`. Tests check that the scope schema accepts everything the parser accepts and rejects the same malformed scopes, and validate every report the library produces against the report schema.
- API reference: `docs/API.md`, with a test that every export is documented.
- Runnable relying-party integration: `examples/basic`, checked by `pnpm smoke`.
- README: install and usage from npm.
- Release workflow: publishes automatically on push when the CHANGELOG heading for the version is dated; trusted publishing (OIDC), optional staged publishing, automatic dist-tag choice, and a GitHub release with the tarballs, SBOM and checksums.

## 0.1.0-rc.0 (2026-10-28)
First release candidate. Licensed under PolyForm Noncommercial 1.0.0 (source-available); commercial use requires a license from Vynx Labs LLC.

- `@wrpguard/core`: `evaluateDcqlScope`, `evaluateDcqlScopeFromJson`, `parseJsonStrict`. Report `wrpguard.report/1`, policy `wrpguard.policy/0.1`, scope schema `wrpguard.scope/1`.
- `@wrpguard/cli`: `wrpguard check` with exit codes 0/2/3/1 and `--json`.
- Supported formats: `dc+sd-jwt`, `mso_mdoc`. Superset evaluation of `claim_sets` and `credential_sets`.
- Strict bounded JSON parser (duplicate keys rejected), terminal-safe output, no runtime dependencies.
- ADR-001 (API), ADR-002 (standards traceability), ADR-003 (input security).
- Release tooling: manual `release` workflow (dry run by default, npm provenance), `scripts/pack-release.mjs` (tarball install check, CycloneDX SBOM, SHA256SUMS), Dependabot, issue forms, code of conduct.

Known limitations: `docs/RELEASE_NOTES_v0.1.0-rc.0.md`.
