# WRPGuard — project rules for EVERY CLI agent (v1.2)

The entire product is an **experimental, offline request-scope preflight**, not an official EUDI verifier or certificate validator.

## Mandatory reading
Read `README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/STANDARDS_MATRIX.md`, `docs/ACCEPTANCE.md`, the ADRs in `docs/adr/` and `docs/RELEASING.md` before editing files. Maintainers: planning, owner-gate and commercial documents are in the private repository `WRPGuard/wrpguard-internal`.

## Technical truthfulness and trust boundary
- Evaluate a proposed OpenID4VP 1.0 **DCQL query** against a **caller-supplied normalized declaration**, never assert its source is genuine or current.
- `pass` means only **matches the supplied declaration under supported policy**. It is not proof of legal authorization, consent, cryptographic trust, certificate validity, or EUDI conformance.
- Results: `pass`, `fail`, `indeterminate`; never return `pass` when semantics needed for safe evaluation are unsupported or ambiguous.
- Core must be pure/deterministic, offline, side-effect-free and testable; no network, filesystem, crypto, telemetry, databases, or time-dependent decisions in core.
- Validate untrusted JSON with explicit size/depth/count limits. Don't interpret untrusted objects as executable configuration.
- Claim paths are typed arrays of `string | nonnegative integer | null` per supported DCQL requirements. A request for a parent path is NOT covered by a registered descendant path.
- Exhaustively evaluate potentially requestable alternatives for `claim_sets`, `credential_sets`, multiple `vct_values`; if full semantics cannot be modeled, return `indeterminate` or `fail`, never skip alternatives and pass.
- Separate **normative specification requirements** from **stricter conservative WRPGuard policy decisions**. Track both in `docs/STANDARDS_MATRIX.md` and ADR-002. For example, missing `claims` has defined OpenID4VP behavior; WRPGuard may choose `indeterminate` as a safety policy, but must not call it an invalid standard request.
- Do not store or print credentials, names, addresses, raw claim values, access tokens, production signing keys, customer registration records or other real private information. Synthetic fixtures only.
- Never claim "certified", "GDPR compliant", "EU approved", "cryptographically verified", or "safe to deploy to production" without independent evidence and owner approval.

## Code and collaboration
- Node.js >=22, TypeScript `strict`, pnpm workspace, Vitest. Verify installed versions; lockfile committed. Choose dependencies sparingly.
- Lead freezes API in ADR-001 before agents implement independently. Every agent owns separate files/worktrees; cross-boundary changes require lead coordination.
- Public developer SDK must be genuinely usable; do not artificially cripple its basic capabilities to force purchase of add-ons.
- Maintain stable reason codes, deterministic JSON output, CI, contributor docs, tests, provenance/SBOM preparedness and a readable architecture.
- Every PR must include scope, tests executed/results, security considerations, standard clause or documented policy, files changed, and unresolved questions.

## Publication / business boundaries
- Strategy: **public-first core with optional private enterprise add-ons**. Do NOT keep the entire project private as its long-term distribution plan.
- Do NOT independently change remote repo visibility, push public, create or change a LICENSE file, publish npm, establish a company account, start hosting, send outreach, accept legal agreements, or disclose vulnerabilities. These require explicit **human owner approval** (owner gates: `docs/OWNER_APPROVAL_GATES.md` in `WRPGuard/wrpguard-internal`).
- License (owner decision 2026-10-28; `LICENSE.md`, README "License"): PolyForm Noncommercial 1.0.0, licensor Vynx Labs LLC; commercial use requires a paid license. Describe the code as source-available, never as open source. Do not change `LICENSE.md`, the package copies or `license` fields without owner approval.
- Private commercial modules must live in distinct repositories/packages with clean IP and dependency boundaries.

## Completion gates
Run and report: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, synthetic fixture CLI exit codes, secret scan, dependency/license/SBOM review. Test and document both successful *and negative* scenarios T01–T18. Include known limitations in release notes; owner decides go/no-go.
