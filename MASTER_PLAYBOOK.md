# WRPGuard — master execution playbook v1.2

**Date:** 2026-10-28  
**Status:** implementation requested, not yet implemented.  
**Operating model:** public-core product development with independent licensing/commercial validation.  
**Owner approval** is required for public pushes, licenses, npm releases, external contact, services, and any production-data use.

## Mission and MVP completion definition
Deliver an offline TypeScript library and CLI that parse a supported OpenID4VP 1.0 DCQL query, compare potential requestable claim paths/types to one *caller-supplied, normalized intended-use scope*, and deterministically report `pass`, `fail`, or `indeterminate` plus rule IDs and findings. Demonstrate a matching request and an over-request with synthetic data. Public-ready docs, automated negative tests, and published APIs are essential. No network or certificate validation is present in v0.1.

## Strict semantics
- `pass`: supported query is within **supplied declared scope** only.
- `fail`: a supported, proven mismatch. If unknown semantics also exist, `fail` may take precedence.
- `indeterminate`: cannot establish a safe match (unknown format, missing claim visibility under WRPGuard conservative policy, unresolved alternatives, unsupported semantics).
- Invalid syntax, resource limits, CLI usage errors and internal errors have exit code `1`.
- CLI `0=pass`, `2=fail`, `3=indeterminate`, `1=invalid/error`. The core API returns structured typed errors rather than process exit codes.

## Planned package boundaries
```
packages/core/     # TypeScript API, parsing, policy engine, reports; pure/no I/O
packages/cli/      # local filesystem inputs and human/JSON output
examples/          # synthetic local demo only
fixtures/          # no customer/real personal data
.github/           # later: CI, issue templates, release process, public docs
enterprise/        # NOT INCLUDED; must live in a separate private repo later
```

Proposed API: `evaluateDcqlScope({ scope, dcqlQuery, context }) -> { decision, findings, policyVersion, standardsSnapshot }`. Lead must freeze in ADR-001, not silently assume this contract.

## Phase 0 — owner/architecture gate (Days 1–3)
Lead: verify official OpenID4VP final text and current tagged EUDI ARF/technical specs. Log actual URLs, clauses, version and capture date. Ensure docs don't confuse strict product policy with normative validity. Finalize inputs/outputs, rule taxonomy, integer/path semantics, versioned scope schema, resource budgets and error aggregation in ADR-001/002/003. Review public-repo and licensing checklist with owner. No parallel implementation before approved ADR-001.

## Phase 1 — workspace and parsers (Days 4–7)
Foundation agent: initialize pnpm, Node >=22, TS strict, Vitest, CI and package exports; parser agent builds bounded validation. Ownership is documented in `docs/WORKSTREAM_OWNERSHIP.md`. Unknown JSON must never create a `pass` simply due to silent coercion.

## Phase 2 — matching engine and fixtures (Days 8–14)
Engine agent: exact types/paths, registered-scope identity, single service/intended-use scope, multi-type alternatives, stable report ordering. QA agent independently writes negative tests and fuzz/DoS cases. The engine must not fetch trust information or infer GDPR eligibility.

## Phase 3 — hardening and supported alternatives (Days 15–20)
Implement or conservatively reject via `indeterminate` `claim_sets` and `credential_sets`; distinguish DCQL semantics from internal policy, always cover requestable branches. Add property-based/regression tests. Security review should try to produce *false pass* outcomes. Stop release if any known false pass in covered functionality.

## Phase 4 — CLI/public launch assets (Days 21–25)
CLI agent: provide `wrpguard check --scope ./fixtures/scope.json --request ./fixtures/request-pass.json --json`. Write reproducible 60-second tutorial, limitations, public security policy, contributing guide, issue templates, release notes and minimal GitHub Actions workflow. Maintain no surprise telemetry or network calls.

## Phase 5 — owner-reviewed public release candidate (Days 26–30)
Lead: merge only after green lint/types/tests/build, all T01–T18 cases, threat review and supply-chain review. Prepare `v0.1.0-rc.0` private/test build; evaluate `npm pack --dry-run` and test clean install. Owner signs off separately on brand/name, OSS license, repo-public visibility and `npm publish`. **Agents may create drafts but must not perform those actions unapproved.**

## Commercial workstream (parallel, human-led)
- Prepare a public explanation showing a realistic over-request caught preflight.
- Build a one-page comparison with existing verifier SDKs and request linting; do not claim "no competitors" without evidence.
- Draft outreach to 15–25 verifier/integration vendors. Owner approves all sending.
- Do 10 discovery interviews, seek 2 design partners and a potential paid pilot before building verified certificate/trust adapters. Track real quotes, user pain, and procurement blockers.
- Evaluate enterprise add-ons separately: verifiable source adapters, audit monitoring, integration support, OEM contracts. Keep a clear boundary from Apache-licensed code if owner elects Apache.

## Agent roles + dependency order
1. Lead standards/API `prompts/00-lead.md` + `01-standards-and-contract.md`.
2. Foundation/parser `prompts/02-workspace-and-parser.md` after contract freeze.
3. Engine `prompts/03-matching-engine.md` after parser types.
4. QA `prompts/04-adversarial-tests.md` in parallel with engine once types frozen.
5. CLI/docs `prompts/05-cli-and-examples.md` after report contract freeze.
6. Release reviewer `prompts/06-release-review.md` at integration gate.

## Required output from each agent
- Summary of implemented behavior, changed files, commands run and raw pass/fail results.
- Traceability to normative clause OR clearly labeled WRPGuard policy decision.
- Security considerations and potential false-pass cases.
- Known limitations, TODOs, reviewer questions and owner approvals required.
- No fabricated test results, audits, external users, releases or certification claims.

## Done means
Useful public-core code (after approval), deterministic and documented library/CLI, transparent supported scope and test suite, reproducible demo, permissioned release plan, and genuine buyer discovery plan. It does NOT mean EUDI compliance, certification, validation of real registration certificates, signed commercial licenses, or an acquisition offer.
