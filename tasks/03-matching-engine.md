# Task 03 — Write deterministic scope matching engine

**Owner:** Engine agent
**Dependency:** ADR-001, ADR-002 frozen

**Own:** `packages/core/src/match.ts`, `packages/core/src/evaluate.ts`, `packages/core/src/index.ts`, engine tests. Implement exact matching of requested type + claim path against selected `serviceId` and `intendedUseId`; avoid false passes; handle alternatives conservatively. Return deterministic code/pointer findings and status precedence. **Deliver:** T01–T13 + T16–T17 tests. **Do not change frozen public types without ADR.**

## Handoff checklist
- State changed paths and unresolved ambiguities.
- Cite applicable primary specification sections in comments/ADR, not in guesswork.
- Run available tests and paste exact commands/output in PR description.
- Document any deferred cases as indeterminate; never broaden `pass` silently.
