# Kit audit — concerns and conflicts found before implementation

**Date:** 2026-10-28 · **Author:** lead agent · **Kit:** v1.2 (all 43 files matched `MANIFEST.json` SHA-256 at audit time)

`MANIFEST.json` describes the planning kit as received. Files edited after this audit (README, STANDARDS_MATRIX, examples, fixtures README) no longer match their manifest hashes; that is expected and the manifest is kept unchanged as a record of the original kit.

| # | Finding | Resolution |
|---|---|---|
| A1 | `README.md` / `examples/README.md` show `wrpguard check --scope … --request …` expecting exit `0`, but `ARCHITECTURE.md` step 2 says missing service/intended-use context ⇒ `indeterminate`. Both cannot hold. | ADR-001 follows the architecture (safety rule). CLI gains `--service` and `--intended-use`; demo commands updated. Without them the result is `indeterminate` / `MISSING_CONTEXT` (exit 3). |
| A2 | ADR location conflict: `tasks/01` says `docs/ADR-001.md`, `WORKSTREAM_OWNERSHIP.md` says `docs/adr/*`. | `docs/adr/` chosen. |
| A3 | Source layout conflict: tasks say `src/parse.ts`, `src/match.ts`; ownership map says `src/parse/*`, `src/evaluate/*`, `src/report/*`. | Flat files (`json.ts`, `parse.ts`, `match.ts`, `evaluate.ts`, `types.ts`, `limits.ts`, `index.ts`) — small module, one owner per file. |
| A4 | `STANDARDS_MATRIX.md` pins EUDI TS5 at v1.5 (2026-08-20). The upstream `main` branch version table lists **v1.6 (2026-09-30)**. | Matrix updated. Whether v1.6 is a tagged release was **not verified**. |
| A5 | OpenID4VP link differs between docs (`…-1_0.html` = latest incl. errata vs `…-1_0-final.html` = approved final text). | Pinned to the final text; SHA-256 of the fetched HTML recorded in ADR-002. |
| A6 | Reason-code list has no code for missing context or for unknown DCQL properties. | ADR-001 adds `MISSING_CONTEXT` and `UNSUPPORTED_DCQL_PROPERTY`. |
| A7 | `UNRESOLVED_ALTERNATIVES` has no trigger under a superset evaluation strategy (every listed credential and claim is evaluated). | Code kept **reserved** in ADR-001 for a future branch-precise policy; not emitted by policy 0.1. |
| A8 | Threat model misses JSON duplicate object keys: `JSON.parse` is last-wins, other parsers can be first-wins ⇒ a parser differential could produce a **false pass**. | ADR-003: own strict JSON parser that rejects duplicate keys. |
| A9 | SD-JWT non-selectively-disclosable claims are always disclosed (OpenID4VP §6.4), and are invisible to a query-only preflight. | Documented limitation; not claimable as covered. |
| A10 | The playbook assumes several agents in separate git worktrees. The directory is not a git repository and no remote exists. | Work executed sequentially by the lead (no overlapping edits possible). An independent agent performed the false-pass review. `git init` / lockfile commit left to the owner. |
| A11 | "2 independent reviewers sign off" (PRD, ACCEPTANCE) cannot be satisfied by agents. | Listed as an owner/human gate in the release readiness report. |
| A12 | ARF 3.0.0, TS6, EU 2025/848, EU 2026/1730, EU 2024/2982, ETSI TS 119 475 were **not re-fetched** in this session. | Matrix marks them "not re-verified 2026-10-28". They are background only; no rule depends on them. |
| A13 | TS5 `serviceIdentifier` is optional `[0..1]` (§2.4.1), but WRPGuard's scope requires `serviceId`. | WRPGuard policy: scope always carries a local `serviceId` label; mapping note in ADR-002. |
| A14 | Kit asks for CI pinned/secured, but action SHAs must not be invented. | CI pins action commit SHAs resolved from GitHub at authoring time (see `.github/workflows/ci.yml` comments). |
