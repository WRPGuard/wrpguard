# T01–T18 verification matrix and false-pass risk report

**Build under test:** v0.1.0-rc.0, the tree of the first commit on `main` (2026-10-28). pnpm 9.15.9, Vitest 5.0.5.
- Windows 10, Node.js 24.21.0.
- Linux (WSL2 Debian, kernel 6.6), official Node.js 22.23.4 and 24.22.2 builds (SHA-256 verified), each from a clean `pnpm install --frozen-lockfile` of the staged tree.
- GitHub Actions (`ubuntu-latest`): CI run 40799492668 green on Node 22.23.4 and 24.22.1 (226 passed each); release dry run 40803386961 green (npm 11.19.1). macOS is untested.

## Acceptance cases (docs/ACCEPTANCE.md)
| ID | Required result | Observed | Test |
|---|---|---|---|
| T01 | pass | pass, no findings | `core/test/acceptance.test.ts` T01 |
| T02 | fail `UNREGISTERED_CLAIM_PATH` | fail, `/credentials/0/claims/1/path` | T02 |
| T03 | fail `UNREGISTERED_CREDENTIAL_TYPE` | fail (vct and doctype) | T03 |
| T04 | fail `WRONG_INTENDED_USE` | fail | T04 |
| T05 | fail `WRONG_SERVICE` | fail | T05 |
| T06 | indeterminate `MISSING_CLAIM_SELECTION` | indeterminate; message says the query is valid OpenID4VP | T06 |
| T07 | indeterminate `UNSUPPORTED_CREDENTIAL_FORMAT` | indeterminate (`jwt_vc_json`, `DC+SD-JWT`) | T07 |
| T08 | fail (parent requested, child registered) | fail; wildcard/index widening also fails | T08 |
| T09 | pass (mdoc) | pass | T09 |
| T10 | fail (mdoc unexpected) | fail (element and namespace) | T10 |
| T11 | fail (multi-vct) | fail (unregistered vct; claim registered for one vct only) | T11 |
| T12 | fail or indeterminate, never pass | fail (any option, incl. least preferred and unreferenced); empty option → indeterminate | T12 |
| T13 | indeterminate or fail, never pass | indeterminate (unsupported branch); fail (optional/unreferenced unregistered set) | T13 |
| T14 | malformed, CLI exit 1 | `MALFORMED_DCQL` for `-1`, `1.5`, `[]`, `{}`, `true`, `""`, `-0`, unsafe int, non-array; mdoc non-2-string paths; CLI exit 1 | T14, T18 |
| T15 | bounded failure, no hang | 100k-deep `[`, 10 MiB string, cycles → `INPUT_TOO_LARGE`; all within the 2 s assertion | T15 |
| T16 | identical reports for reordered keys | byte-identical JSON (DCQL and scope) + property test over random key rotations | T16, `properties.test.ts` |
| T17 | no raw `values` in output | value markers absent from reports and error reports | T17 |
| T18 | CLI exits 0/2/3/1 | 10 cases × human/`--json` in-process; 19 spawned checks of the **compiled** binary via `pnpm smoke` | `cli/test/cli.test.ts`, `scripts/smoke-cli.mjs` |

## Commands and results (2026-10-28)
| Command | Result |
|---|---|
| `pnpm lint` | exit 0, no problems (probe confirmed the core purity rules fire) |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | Windows: 7 files, **225 passed, 1 skipped** (the FIFO test is POSIX-only). Linux, Node 22 and 24: **226 passed**, FIFO test included |
| `pnpm build` | exit 0 (core, cli) |
| `pnpm smoke` | 19/19 exit codes as documented |
| `pnpm secret-scan` | no matches (regex scan of the working tree only) |
| `pnpm license-check` | `PolyForm-Noncommercial-1.0.0` in the root and both packages; a modified package `LICENSE.md` makes it exit 1 |
| Clean Linux run of the staged tree (`pnpm install --frozen-lockfile` + `pnpm check`) | exit 0 on Node 22.23.4 and 24.22.2 |
| `node scripts/pack-release.mjs` (Windows and in the release workflow) | both tarballs install cleanly with npm; no `private`, no `workspace:` ranges, `LICENSE.md` present; installed CLI prints the version and exits 0/2/3 on the fixtures; CycloneDX 1.5 SBOM and SHA256SUMS written |
| `release` workflow, dry run | `npm publish --dry-run --provenance --tag next --access public` succeeds for both packages |
| `pnpm audit` | No known vulnerabilities found |
| `pnpm pack` + `npm install --offline` of both tarballs in an empty project | installs; installed `wrpguard` exits 0/2/3/1 on the fixtures; API import works (Node 24.21.0). Both tarballs contain `LICENSE.md` and the `license` field |

## Mutation check (are the tests able to see a false pass?)
Each mutation was applied alone to the core source, the suite was run, and the source was restored.
| Mutation | Tests failing |
|---|---|
| every path treated as registered | 18 |
| fail precedence removed | 20 |
| only the first `vct_values` entry checked | 3 |
| duplicate JSON keys accepted | 4 |
| missing `claims` ignored | 1 |
| empty `claim_sets` option ignored | 1 |
| unknown properties ignored | 13 |
| parent-path explanation removed | 1 |
| *after review:* integral-number lexeme rule removed | 11 |
| *after review:* `toJSON` detection removed | 3 |
| *after review:* `--help` combinable with `check` | 3 |
| *after review:* tag characters not escaped | 1 |

## False-pass risk register
| Risk | Status |
|---|---|
| Skipped alternative branch (`claim_sets`, `credential_sets`, optional sets, extra `vct_values`) | Mitigated: superset evaluation (WRPG-ALT-01/02); oracle property test |
| Parent path covering children | Mitigated: exact match; T08 |
| Wildcard `null` vs index | Mitigated: exact, type-sensitive keys |
| Duplicate-key parser differential | Mitigated: strict parser; smuggling test |
| Unknown extension properties | Mitigated: indeterminate |
| Values used to disguise an over-request | Mitigated: values ignored for decisions |
| Non-selectively-disclosable SD-JWT claims | **Not mitigable** from the query; documented limitation |
| Forged or stale scope declaration | **Out of scope**; `scopeTrust: caller-supplied-unverified` on every report |
| SDK caller passes a `Proxy` | Documented; use the `FromJson` API for untrusted text |
| Number literal rounding to a registered index (`0.99999999999999999999` → 1) | **Found by review (F1), fixed**: WRPG-SYN-02 |
| `toJSON` on SDK input changes the serialized request | **Found by review (F2), fixed**: ADR-003 §2 |

Independent adversarial review: see `docs/SECURITY_REVIEW.md`.
