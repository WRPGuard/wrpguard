# Task 04 — Build test matrix and attack inputs

**Owner:** QA/security agent
**Dependency:** parser and engine interfaces stable

**Own:** `packages/core/test/security*`, `packages/core/test/fixtures*`, QA scripts; must not modify engine except proposed patch PR. Generate adversarial inputs: unknown format, missing claims, wildcard path, object-key attacks, 10MB JSON, depth 1000, multi-vct, branch combinations. Assert no raw credential values or network requests. **Deliver:** T01–T18 verification matrix, false-pass risk report. **Never use real identity documents.**

## Handoff checklist
- State changed paths and unresolved ambiguities.
- Cite applicable primary specification sections in comments/ADR, not in guesswork.
- Run available tests and paste exact commands/output in PR description.
- Document any deferred cases as indeterminate; never broaden `pass` silently.
