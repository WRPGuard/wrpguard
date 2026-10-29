# Release readiness report — v0.1.0-rc.0

**Date:** 2026-10-28 · **Prepared by:** lead agent · **Recommendation:** **NO-GO for public release today**. GO for the first local commit and a **private** push to `github.com/wrpguard/wrpguard`. Human-only gates remain open (below).

## Gate status
| Gate (RELEASE_CHECKLIST / ACCEPTANCE) | Status | Evidence |
|---|---|---|
| ADR-001/002/003 written and frozen | Done (lead) — **owner review pending** | `docs/adr/` |
| lint, typecheck, test, build green | Done | `docs/TEST_MATRIX.md` |
| T01–T18 automated | Done | `docs/TEST_MATRIX.md` |
| Negative security tests reviewed for false-pass cases | Done: mutation check + independent agent review; 2 false passes found and fixed | below |
| No real PII/keys/tokens | Done: synthetic fixtures only; regex secret scan clean | `pnpm secret-scan` |
| Lockfile committed | Done: part of the first commit on `main` | `git log` |
| Dependency and license review | Done: 0 third-party runtime deps; dev deps permissive except MPL-2.0 `lightningcss` (dev-only, via vitest, not distributed); `pnpm audit` clean | `pnpm licenses list --dev` |
| Project license | Done (owner decision 2026-10-28): PolyForm Noncommercial 1.0.0, licensor Vynx Labs LLC; `LICENSE.md` in the root and both packages. **Legal review pending** | `docs/LICENSING_DECISION.md`, `pnpm license-check` |
| `npm pack` inspected; clean install from tarballs | Done on Node 24.21 / Windows; both tarballs contain `LICENSE.md` | TEST_MATRIX |
| Clean install on Node 22 and Linux | Done locally: WSL2 Debian, Node 22.23.4 and 24.22.2, frozen-lockfile install + `pnpm check` exit 0, FIFO test executed. **GitHub CI not yet run** (first push) | TEST_MATRIX |
| CI pinned / minimal permissions | Done: SHA-pinned actions, `contents: read`, `persist-credentials: false` | ci.yml |
| npm provenance | **Open**: needs a publishing workflow after the owner approves npm | — |
| SBOM | Prepared, not generated: core has no runtime deps; cli depends only on core. Generate CycloneDX at release time | — |
| README states experimental + declaration-only trust boundary | Done | README |
| API/CLI docs match implementation | Done | `docs/CLI.md`, package READMEs |
| SECURITY.md contact approved | Done (owner decision): GitHub private vulnerability reporting. **Owner must enable it** in the repository settings when the repository is made public | `SECURITY.md` |
| CONTRIBUTING / code of conduct | CONTRIBUTING updated: outside PRs are not merged until a contributor agreement exists. **Open (owner)**: no code of conduct (needs a conduct contact) | `CONTRIBUTING.md` |
| 2 independent human reviewers of security cases and standards mapping | **Open (owner)** | ACCEPTANCE.md |

## Independent adversarial review
A separate agent got the code and spec but not the lead's conclusions. It was asked to produce wrong `pass` results, crashes, parser differentials, leaks and terminal injection, and to write probes outside the repository. Its probe files are in the session scratchpad and are not part of the repo. The first attempt failed to start because of an environment model-routing error; the retry completed. **This was an AI review. It does not replace the two human reviewers required by ACCEPTANCE.md.**

The lead reproduced every finding independently before fixing it.
| ID | Severity | Finding | Fix | Regression tests |
|---|---|---|---|---|
| F1 | **false pass** (depends on the wallet's parser) | `0.99999999999999999999`, `1.0`, `1e0` are accepted as path indices; as doubles they round to a registered index | Integral numbers must be written as integers (WRPG-SYN-02, ADR-003 rev. 1) | `json.test.ts` (10 lexemes), T14 end-to-end |
| F2 | **false pass** (SDK value API only) | `toJSON` on an array, a non-enumerable `toJSON`, or prototype pollution changes what `JSON.stringify` sends | Reject any reachable `toJSON` | `json.test.ts` (3 cases) |
| F3 | resource / amplification | 290 KB input → 503 808 findings, 457 MB RSS; 787 KB → 109 MB of JSON output | Tighter default caps; findings cap 200; messages truncated | Worst-case bound test; reviewer inputs now rejected in about 0.2 s |
| F4 | cosmetic display spoofing | Tag characters, variation selectors, Hangul fillers and others were not escaped | Escape set widened; astral characters escaped as surrogate pairs | `report.test.ts` |
| F5 | low | `check … --help` exits 0, the same code as `pass` | `--help`/`--version` must be the sole argument | `cli.test.ts` (3 cases) |
| — | unconfirmed (POSIX) | `open()` on a FIFO with no writer could block | `O_NONBLOCK` + regular-file check | `cli.test.ts` (POSIX only; executed and passing on Linux, Node 22 and 24) |

Reported as holding up: parser vs `JSON.parse` (~35 grammar cases), escaped duplicate keys, `__proto__` keys, `-0`/huge numbers/lone surrogates, path-key collisions, multi-vct and type confusion, mdoc path rules, every alternative branch, unknown properties, context handling, every limit at +1 (no silent truncation), SDK snapshot rejections, CLI argument tricks, UTF-16/overlong/CESU files, output escaping, no `values` leakage.

After the fixes, all gates are green again (`pnpm check` exit 0; 225 passed, 1 skipped). Known false passes in covered functionality: **none known**. This is not a guarantee.

## Owner decisions (2026-10-28)
- License: PolyForm Noncommercial 1.0.0; licensor Vynx Labs LLC; commercial licensing via licensing@vynx-labs.dev (`docs/LICENSING_DECISION.md`).
- Repository: `github.com/wrpguard/wrpguard` in a new `wrpguard` organization, **private first**, public after owner review.
- Security reports: GitHub private vulnerability reporting.
- npm: reserve the `@wrpguard` scope by creating the npm organization `wrpguard`. Publishing remains a separate decision.
- First local commit approved; no push by the agent.

On 2026-10-28 the npm registry returned 404 for the `wrpguard` org scope, `@wrpguard/core`, `@wrpguard/cli` and unscoped `wrpguard`, and the GitHub API returned 404 for `wrpguard` as a user and as an organization. Availability can change until the owner creates them. No trademark search was done.

## READY FOR OWNER DECISION
1. **Create the npm organization `wrpguard`** (npmjs.com, free plan for public packages). This reserves `@wrpguard`; no placeholder package is needed.
2. **Create the GitHub organization `wrpguard`**, a private repository `wrpguard/wrpguard`, and push `main`. Confirm CI is green on Node 22 and 24.
3. **Approve or amend ADR-001/002/003**: especially missing context ⇒ indeterminate; unknown properties ⇒ indeterminate; exact paths only; superset alternatives.
4. **Legal**: review of the license choice; a commercial license agreement before any sale; a contributor agreement before merging outside code.
5. **Make the repository public** (separate decision), then enable private vulnerability reporting.
6. **Code of conduct** and its contact.
7. **npm publication**: separate decision. Requires removing `"private": true` and a provenance-enabled publish workflow (trusted publishing preferred over long-lived tokens).
8. **Human reviewers**: two people to sign off on ADR-002 mapping and the security tests.

The license was added on the owner's instruction. No outreach, publication, hosting or spending was performed.
