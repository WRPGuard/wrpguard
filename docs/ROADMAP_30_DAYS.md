# 30-day part-time schedule (target gates, not guarantee)

## Days 1–3: Standards and interface freeze
Owner: Lead + Standards agent. Read live primary standards. Record verified versions and traceability. Determine canonical scopes and exact conservative semantics. Draft ADR-001 and ADR-002. After sanitizing materials, submit public-repo visibility and license choices for explicit owner approval; publish a developer-facing problem statement and roadmap once approved. **Gate:** no implementation on unfrozen types.

## Days 4–7: Workspace and parsing
Owner: Foundation + Parser agents, isolated ownership. TypeScript strict monorepo, Vitest, CI, runtime JSON shape validation, limits. **Gate:** malformed inputs are bounded and tested.

## Days 8–14: Matching engine
Owner: Engine agent. Exact type and path matching; fail / indeterminate precedence; deterministic report. **Gate:** T01–T11 pass; no external I/O.

## Days 15–20: Alternatives + threat testing
Owner: Engine + QA. Conservatively process `claim_sets` and `credential_sets`. Fuzz malformed inputs. **Gate:** T12–T17 pass; no false-pass in negative suite.

## Days 21–25: CLI and examples
Owner: CLI/Docs agent. Streamlined CLI and JSON output, exit codes, reproducible examples. **Gate:** T18 passes; runbook works from clean checkout.

## Days 26–30: Public-beta readiness and commercial discovery
Owner: Lead + QA. Independent review, v0.1.0-rc.0 tag, approved public-core license and security disclaimer, 3–5 customer interviews; optional test integration with a real demo RP using SYNTHETIC inputs only. Make npm publication a separate owner-approved action **after** quality gates. **Gate:** decide public release/no-go with evidence.

## Agent dependency order
Lead contract + standards first -> Parser and Foundation parallel -> Engine -> QA stress + CLI integration in parallel -> release review. Do not run agents editing the same files simultaneously.

## Go/no-go
Advance to OEM adapter if (a) v0.1 has no known false-pass for covered cases, (b) integrations confirm they need independent policy preflight, and (c) at least two serious commercial interviews indicate a procurement path.


**Public-first update (v1.2):** Read `PUBLIC_RELEASE_PLAN.md`, `LICENSING_DECISION.md`, `RELEASE_CHECKLIST.md`, and `OWNER_APPROVAL_GATES.md`. Public developer core is the chosen discovery direction, pending owner approval; no autonomous publishing.
