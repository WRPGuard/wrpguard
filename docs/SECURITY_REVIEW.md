# Security review — v0.1.0-rc.0

## Independent adversarial review (2026-10-28)
A separate agent got the code and the specification but not the lead's conclusions. It was asked to produce wrong `pass` results, crashes, parser differentials, leaks and terminal injection, writing its probes outside the repository. **This was an AI review. It does not replace the two human reviewers required by `docs/ACCEPTANCE.md`; see `docs/REVIEW_GUIDE.md`.**

Every finding was reproduced independently before it was fixed.

| ID | Severity | Finding | Fix | Regression tests |
|---|---|---|---|---|
| F1 | **false pass** (depends on the wallet's parser) | `0.99999999999999999999`, `1.0`, `1e0` were accepted as path indices; as doubles they round to a registered index | Integral numbers must be written as integers (WRPG-SYN-02, ADR-003 rev. 1) | `json.test.ts` (10 lexemes), T14 end-to-end |
| F2 | **false pass** (SDK value API only) | `toJSON` on an array, a non-enumerable `toJSON`, or prototype pollution changed what `JSON.stringify` sends | Reject any reachable `toJSON` | `json.test.ts` (3 cases) |
| F3 | resource / amplification | 290 KB input → 503 808 findings, 457 MB RSS; 787 KB → 109 MB of JSON output | Tighter default caps; findings cap 200; messages truncated | Worst-case bound test; reviewer inputs now rejected in about 0.2 s |
| F4 | cosmetic display spoofing | Tag characters, variation selectors, Hangul fillers and others were not escaped | Escape set widened; astral characters escaped as surrogate pairs | `report.test.ts` |
| F5 | low | `check … --help` exited 0, the same code as `pass` | `--help`/`--version` must be the sole argument | `cli.test.ts` (3 cases) |
| — | unconfirmed (POSIX) | `open()` on a FIFO with no writer could block | `O_NONBLOCK` + regular-file check | `cli.test.ts` (POSIX only; passing on Linux, Node 22 and 24) |

Reported as holding up: parser vs `JSON.parse` (~35 grammar cases), escaped duplicate keys, `__proto__` keys, `-0`/huge numbers/lone surrogates, path-key collisions, multi-vct and type confusion, mdoc path rules, every alternative branch, unknown properties, context handling, every limit at +1 (no silent truncation), SDK snapshot rejections, CLI argument tricks, UTF-16/overlong/CESU files, output escaping, no `values` leakage.

Known false passes in covered functionality after the fixes: **none known**. This is not a guarantee. Report suspected false passes privately (`SECURITY.md`).

## Mutation check
Whether the tests can see a false pass: see `docs/TEST_MATRIX.md` ("Mutation check").
