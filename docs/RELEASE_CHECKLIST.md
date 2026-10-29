# Public experimental release checklist (owner gates)

## Code and security
- [ ] ADR-001/002/003 reviewed; supported scope matrix published.
- [ ] Build, lint, typecheck and test green; T01–T18 automated.
- [ ] Negative security tests reviewed for false-pass cases.
- [ ] No real PII, customer data, private keys, tokens, credentials in examples/tests/logs.
- [ ] Lockfile committed; dependency and license review; `npm pack --dry-run` inspected.
- [ ] Clean install from packed tarballs tested on supported Node version(s).
- [ ] CI pinned/secured; GitHub Actions minimal permissions; npm provenance considered.

## Public documents
- [ ] README states experimental and declaration-only trust boundary.
- [ ] API and CLI docs match actual implementation.
- [ ] SECURITY.md + coordinated reporting address/contact approved.
- [ ] CONTRIBUTING.md and code of conduct reviewed.
- [ ] Correct SPDX/license selection explicitly approved by owner/counsel.
- [ ] Demo artifacts fully synthetic; no copy-pasted third-party copyrighted docs/source.

## Human-only decisions
- [ ] Owner approves product name and brand use.
- [ ] Owner approves making remote repo public.
- [ ] Owner approves OSS license and contributor IP policy.
- [ ] Owner separately approves npm beta publication and credentials.
- [ ] Owner approves any outreach/public claim beyond factual implementation.

## Exit report
Write version number, commit SHA, exact tests & outputs, known unsupported semantics, dependencies, SPDX license, owner approvals and undo/rollback plan. No "released" statement before publishing actually succeeds.
