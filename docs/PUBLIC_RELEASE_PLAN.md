# Public-core release and developer-discovery plan

## Operating principle
**Public work is a distribution strategy, not proof of safety or demand.** Make the core library genuinely useful, inspectable and clearly limited. Keep enterprise features distinct and legitimately valuable. Avoid announcing an unreviewed security implementation as "production ready".

## Public repo blueprint
- `/packages/core` offline TypeScript policy engine and exported type contracts.
- `/packages/cli` deterministic local preflight runner.
- `/docs` architecture, standards mapping, support matrix, threat model, policy limits, basic release notes.
- `/fixtures` synthetic positive, negative and indeterminate cases.
- `/examples` reproducible minimal relying-party demo with no actual wallet or personal data.
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` (draft; owner approves), CHANGELOG, issue forms, PR checklist, .github CI.

## Public launch sequence
1. **Prepare**: name/trademark check, owner-reviewed docs, secrets audit, IP ownership and dependency-license inventory.
2. **Owner approves visibility + license**: decided 2026-10-28. License PolyForm Noncommercial 1.0.0 (`LICENSING_DECISION.md`); repository `github.com/wrpguard/wrpguard`, private first, public after owner review.
3. **Publish repository** (human approved) containing truthful experimental status and milestones. A runnable package isn't required for opening the repo, but don't present unfinished APIs as ready.
4. **Demonstrate core**: synthetic pass/overrequest/indeterminate cases, visible CI and a minimal API tutorial.
5. **Release experimental npm tag** only after tests, dependency checks, security review, install smoke test, supply-chain provenance and *separate* owner approval.
6. **Participate in standards communities**: contribute reproducible issue findings, avoid self-promotion spam or implied official endorsements.

## Product claims / wording
Allowed: "Offline preflight checks proposed DCQL claim requests against a supplied scope declaration; flags potential over-requests."  
Avoid: "certified", "guarantees legal authorization", "official EU validator", "verifies wallet relying-party certificates", "fully prevents data leakage", "secure by default in production".

## Developer KPIs
Track: independent users successfully running demo, verified third-party integrations, reproducible external issue reports, contributors, requests for APIs/adapters, technical design partners. Stars and npm downloads alone are weak signals.

## Emergency handling
If false-pass security issue discovered: prepare fix and security advisory with owner. Do not disclose exploit details publicly before coordinated review. Do not claim mitigations are effective without tests.
