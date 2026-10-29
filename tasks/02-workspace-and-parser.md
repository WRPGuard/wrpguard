# Task 02 — Scaffold workspace and validate untrusted inputs

**Owner:** Foundation agent
**Dependency:** ADR-001, ADR-002 frozen

**Own:** workspace config, `packages/core/src/parse.ts`, `packages/core/src/types.ts`, parser tests. Node >=22, TS strict, pnpm/Vitest. Parse unknown into typed AST; reject malformed paths, empty names, invalid numbers, unbounded nesting; cap bytes/depth/credential counts. Never treat data as verified. **Deliver:** parser tests T14–T15 plus typecheck. **Do not edit matcher.**

## Handoff checklist
- State changed paths and unresolved ambiguities.
- Cite applicable primary specification sections in comments/ADR, not in guesswork.
- Run available tests and paste exact commands/output in PR description.
- Document any deferred cases as indeterminate; never broaden `pass` silently.
