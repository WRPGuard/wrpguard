# Changelog

## 0.1.0-rc.0 (unreleased, internal release candidate)
First release candidate. Licensed under PolyForm Noncommercial 1.0.0 (source-available); commercial use requires a license from Vynx Labs LLC.

- `@wrpguard/core`: `evaluateDcqlScope`, `evaluateDcqlScopeFromJson`, `parseJsonStrict`. Report `wrpguard.report/1`, policy `wrpguard.policy/0.1`, scope schema `wrpguard.scope/1`.
- `@wrpguard/cli`: `wrpguard check` with exit codes 0/2/3/1 and `--json`.
- Supported formats: `dc+sd-jwt`, `mso_mdoc`. Superset evaluation of `claim_sets` and `credential_sets`.
- Strict bounded JSON parser (duplicate keys rejected), terminal-safe output, no runtime dependencies.
- ADR-001 (API), ADR-002 (standards traceability), ADR-003 (input security).
- Release tooling: manual `release` workflow (dry run by default, npm provenance), `scripts/pack-release.mjs` (tarball install check, CycloneDX SBOM, SHA256SUMS), Dependabot, issue forms, code of conduct.

Known limitations: `docs/RELEASE_NOTES_v0.1.0-rc.0.md`.
