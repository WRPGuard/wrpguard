# Testable acceptance gates

## Functional cases (synthetic fixtures only)
| ID | Condition | Required result |
|---|---|---|
| T01 | Valid SD-JWT type & exact registered `age_over_18` | pass |
| T02 | Adds an unregistered `birth_date` path | fail: UNREGISTERED_CLAIM_PATH |
| T03 | Unknown vct/doctype | fail: UNREGISTERED_CREDENTIAL_TYPE |
| T04 | Incorrect intended-use ID | fail: WRONG_INTENDED_USE |
| T05 | Incorrect service ID | fail: WRONG_SERVICE |
| T06 | Missing `claims` | indeterminate: MISSING_CLAIM_SELECTION |
| T07 | Unsupported format | indeterminate: UNSUPPORTED_CREDENTIAL_FORMAT |
| T08 | Request parent `['address']`, allow only `['address','street']` | fail |
| T09 | mdoc `['namespace','element']` registered | pass |
| T10 | mdoc namespace/element unexpected | fail |
| T11 | Multi-vct: one registered, one unregistered | fail |
| T12 | claim_sets: unregistered possible alternate | fail or indeterminate, never pass |
| T13 | credential_sets: unsupported branch | indeterminate or fail, never pass |
| T14 | Invalid `path`: negative int, float, empty, object | malformed input, CLI exit 1 |
| T15 | Malformed JSON / unexpected huge nesting | bounded failure, no hang |
| T16 | Two equivalent requests with reordered keys | identical deterministic reports |
| T17 | No raw `values` data reflected in findings | pass privacy assertion |
| T18 | CLI exits 0/2/3/1 per documented result | pass integration assertion |

## QA exit gates
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass.
- All 18 cases automated in Vitest/CLI integration.
- CI runs with supported Node versions; lockfile committed.
- Dependency audit review, no high-severity unresolved issues, bounded parse stress test.
- 2 reviewers sign off on mapping of each reason code to doc/standard section.
- README disclaims absence of cert validation and legal advice.
