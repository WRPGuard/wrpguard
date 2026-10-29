# Task 06 — Merge, audit, prepare public-beta release candidate

**Owner:** Lead reviewer
**Dependency:** parser and engine interfaces stable

**Own:** merge, release, `docs/SECURITY.md`, `docs/COMMERCIAL.md`, CI reviewing. Confirm source references, dependency notices, secret scan, test gate, visibility/license approval, public API documentation, safe synthetic demo, and scope disclaimer. Tag v0.1.0-rc.0 only if all tests pass; public npm publication requires a separate owner decision; otherwise issue blocker report. **Deliver:** release notes, known limitations, licensing decision checklist.

## Handoff checklist
- State changed paths and unresolved ambiguities.
- Cite applicable primary specification sections in comments/ADR, not in guesswork.
- Run available tests and paste exact commands/output in PR description.
- Document any deferred cases as indeterminate; never broaden `pass` silently.
