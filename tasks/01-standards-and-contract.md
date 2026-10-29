# Task 01 — Freeze traceability and ADR contracts

**Owner:** Standards agent
**Dependency:** none; unblock all other tasks

**Own:** `docs/ADR-001.md`, `docs/ADR-002.md`, `docs/STANDARDS_MATRIX.md` (update only). Verify baseline sources and freeze TypeScript shapes, reason codes and limits. Explicitly decide conservatism for claim/credential alternatives and missing claims. **Deliver:** one mapping table rule->clause->test; sign-off by lead. **No engine source edits.**

## Handoff checklist
- State changed paths and unresolved ambiguities.
- Cite applicable primary specification sections in comments/ADR, not in guesswork.
- Run available tests and paste exact commands/output in PR description.
- Document any deferred cases as indeterminate; never broaden `pass` silently.
