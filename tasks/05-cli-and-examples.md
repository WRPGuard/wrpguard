# Task 05 — Build CLI, sample workflow, and docs

**Owner:** CLI agent
**Dependency:** parser and engine interfaces stable

**Own:** `packages/cli/**`, `examples/**`, `docs/CLI.md`, README user guide. Build `wrpguard check` reading local JSON files, `--json` output, exits 0/2/3/1; stable stdout, errors to stderr; no network access. Create sample success and fail commands from `/fixtures`. **Deliver:** CLI integration tests T18 and clean-checkout quickstart.

## Handoff checklist
- State changed paths and unresolved ambiguities.
- Cite applicable primary specification sections in comments/ADR, not in guesswork.
- Run available tests and paste exact commands/output in PR description.
- Document any deferred cases as indeterminate; never broaden `pass` silently.
