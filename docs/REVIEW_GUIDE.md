# Independent review guide

WRPGuard's acceptance criteria (`docs/ACCEPTANCE.md`) require **two independent human reviewers** before a stable release: one to check that each rule is mapped correctly to OpenID4VP or labeled as WRPGuard policy, and one to try to break the security properties. An AI adversarial review has been done (`docs/SECURITY_REVIEW.md`), but it does not count as one of the two.

Reviewers should not have written the code. Plan on roughly half a day each. Use synthetic data only.

## Setup
```sh
git clone https://github.com/WRPGuard/wrpguard && cd wrpguard
git checkout <commit to review>
pnpm install && pnpm check     # Node.js >= 22.12, pnpm 9
```
Record the commit SHA you reviewed. Read the README "Trust boundary", then the ADRs in `docs/adr/`.

## Review A: standards mapping
Sources: [OpenID4VP 1.0 Final](https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html), [ADR-002](adr/ADR-002-standards-traceability.md), [`docs/STANDARDS_MATRIX.md`](STANDARDS_MATRIX.md).

For each rule, check:
1. The cited clause says what ADR-002 claims, in OpenID4VP 1.0 **Final**.
2. The label is right: `N` (normative) only where the specification requires it; `P` (WRPGuard policy) wherever WRPGuard is stricter than the specification. A policy rule must never be described as making a valid query invalid.
3. The listed test exists and would fail if the rule were removed.

| Rule | Code / effect | Verdict (agree / disagree / unclear) | Notes |
|---|---|---|---|
| WRPG-CTX-01 | `WRONG_SERVICE` / fail | | |
| WRPG-CTX-02 | `WRONG_INTENDED_USE` / fail | | |
| WRPG-CTX-03 | `MISSING_CONTEXT` / indeterminate | | |
| WRPG-FMT-01 | `UNSUPPORTED_CREDENTIAL_FORMAT` / indeterminate | | |
| WRPG-TYP-01 | `UNREGISTERED_CREDENTIAL_TYPE` / fail | | |
| WRPG-CLM-01 | `UNREGISTERED_CLAIM_PATH` / fail | | |
| WRPG-CLM-02 | `MISSING_CLAIM_SELECTION` / indeterminate | | |
| WRPG-ALT-01 | `claim_sets` superset evaluation | | |
| WRPG-ALT-02 | `credential_sets` superset evaluation | | |
| WRPG-EXT-01 | `UNSUPPORTED_DCQL_PROPERTY` / indeterminate | | |
| WRPG-VAL-01 | `values` never narrows evaluation | | |
| WRPG-SYN-01 | `MALFORMED_DCQL` (specification violations) | | |
| WRPG-SYN-02 | `MALFORMED_*` (policy rejections) | | |
| WRPG-SCP-01 | `MALFORMED_SCOPE` (closed scope schema) | | |
| WRPG-LIM-01 | `INPUT_TOO_LARGE` | | |

Also answer: is anything in OpenID4VP §6–§7 or Appendix B.2/B.3 that can widen what a wallet discloses **not** covered by a rule, by `indeterminate`, or by a documented limitation (README "Known limitations")?

## Review B: false passes and input security
The central property: **WRPGuard must never return `pass` for a query that could make a wallet disclose a credential type or claim path outside the supplied declaration**, within the supported formats. Try to break it.

Starting points:
- Alternatives: `claim_sets`, `credential_sets`, optional sets, several `vct_values`.
- Paths: parent vs child paths, `null` wildcards vs indices, type confusion (`"0"` vs `0`), Unicode look-alikes.
- Parser differentials: duplicate keys, number spellings (`1.0`, `1e0`, very long numbers), escapes, BOMs, deep nesting. Compare with how real wallets parse.
- Unknown properties at any level, including inside `meta`.
- The SDK value API (`evaluateDcqlScope`): getters, `toJSON`, prototypes, `Proxy`.
- CLI: arguments, special files, huge or malformed files, terminal escape sequences in identifiers.
- Resource use: inputs that are small but expensive.

Then check the existing defenses: the findings in [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) and their regression tests, the property tests in `packages/core/test/properties.test.ts`, and the mutation check in [`TEST_MATRIX.md`](TEST_MATRIX.md). Would the tests notice if a fix were reverted?

Report anything that yields a wrong `pass` privately, as described in [`SECURITY.md`](../SECURITY.md), not in a public issue.

## Sign-off
Each reviewer sends the maintainers: the commit SHA reviewed, the completed table or findings, open questions, and an overall verdict (approve / approve with conditions / do not approve). Maintainers record sign-offs privately and list the reviewed commit and verdicts (with reviewer names only if the reviewers agree) in the release notes of the first stable release.
