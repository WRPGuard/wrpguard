# Agent worktrees and file ownership map

The lead edits ADRs, project rules and integration-level docs. Agents must not edit overlapping files simultaneously. Use separate worktrees/branches and clear handoffs.

| Workstream | Suggested branch | Owned paths | Dependencies |
|---|---|---|---|
| Lead architecture/standards | `agent/lead-standards` | `docs/adr/*`, `docs/STANDARDS_MATRIX.md`, root decisions | none |
| Foundation/parser | `agent/parser` | `packages/core/src/parse/*`, `packages/core/src/types/*`, workspace config with lead coordination | ADR-001 freeze |
| Matching/report | `agent/engine` | `packages/core/src/evaluate/*`, `packages/core/src/report/*` | parser contracts |
| QA/security | `agent/qa-security` | `packages/core/test/*`, `fixtures/*`, security test report | ADR-001 freeze |
| CLI/examples | `agent/cli-docs` | `packages/cli/*`, `examples/*`, public developer guide | report contract |
| Lead integration/release | `agent/release` | repo root release/docs/templates, merge-only integration | all ready |

If current files or test locations differ, lead must make explicit map before parallel coding. Foundation owns shared workspace files until handed off. QA reports flaws but does not silently alter engine files. Agents create PRs against the lead integration branch and provide tests. No direct push to protected main.
