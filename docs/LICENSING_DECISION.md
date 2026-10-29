# Public-core license decision — requires human approval

## Owner decision (2026-10-28)
- **License:** PolyForm Noncommercial License 1.0.0 (SPDX `PolyForm-Noncommercial-1.0.0`) for all code in this repository. The owner's requirement: nobody may use WRPGuard commercially without paying a license fee. Text: `LICENSE.md`, copied byte for byte from PolyForm's `1.0.0` tag (word-identical to the SPDX copy), plus one `Required Notice:` line. `pnpm license-check` keeps the package copies and `license` fields in sync.
- **Licensor:** Vynx Labs LLC. Commercial licensing inquiries: licensing@vynx-labs.dev.
- **Supersedes** the Apache-2.0 candidate below and in `AGENTS.md`, `START_HERE.md`, `PUBLIC_RELEASE_PLAN.md`, `ADOPTION_AND_LICENSING.md` and `COMMERCIAL.md`.

Consequences agents and maintainers must respect:
- WRPGuard is **source-available, not open source** (the license is not OSI-approved). Never call it "open source" or "OSS".
- Under the license's "Noncommercial Organizations" clause, charitable organizations, educational institutions, public research, public safety or health and environmental protection organizations, and **government institutions** may use it without a commercial license. Public-sector relying parties are therefore not commercial customers by default.
- Commercial users (companies, including wallet providers and private relying parties) need a commercial license. **No commercial license agreement exists yet**; it needs professional counsel before any sale (`OWNER_APPROVAL_GATES.md`, commercial agreements).
- Dual licensing requires Vynx Labs LLC to hold the rights to all code. Outside contributions need a contributor agreement (CLA or assignment) first; until then none are merged (`CONTRIBUTING.md`).
- npm does not enforce licenses: published packages can be downloaded by anyone, and the license terms govern use.
- No legal review of this choice has been performed yet.

## What the lead agent must deliver BEFORE owner chooses
- IP provenance report: who wrote code, contributor terms, existing third-party libraries and their licenses.
- Written comparison of Apache-2.0 vs MPL-2.0 vs commercial source-available/evaluation licensing, for product/adoption/business strategy.
- Proposed public/private module boundary diagram and package dependency licenses.
- Legal review questions for counsel; do not assert that this document is legal advice.

## Choices and trade-offs
**Apache-2.0 (candidate):** low adoption friction, commercial reuse and redistribution permitted, explicit patent license terms; public-core exclusivity is not an asset. Proprietary enterprise modules need **independent value**.

**MPL-2.0 (alternative):** file-level copyleft may help share improvements to covered files when distributed; increases license-compliance complexity in some enterprise procurement. Legal review required.

**Source-available/commercial evaluation (alternative):** stronger control over redistribution but not necessarily recognized as open source, and can reduce ecosystem trust and adoption. Clearly describe as source-available, not open source.

## Never imply
- Customers need an OEM license merely to exercise rights already granted by an OSS license.
- Future licensing can revoke rights to already-released Apache-2.0 copies.
- Patents, certifications, registration data or trademarks are automatically granted by publishing code.

## Decisions reserved to owner
[~] Brand name: npm scope `@wrpguard` and GitHub org `wrpguard` were unclaimed on 2026-10-28 (registry and API returned 404); the owner creates both. No trademark search done.
[~] Public core license selected by owner (2026-10-28); legal review pending
[ ] Private enterprise code ownership and repository boundaries approved
[ ] Contribution policy: a CLA or assignment is required by the dual-licensing model; text to be drafted by counsel
[ ] Release sign-off authority identified
[ ] OEM contract terms and warranties reviewed by professional counsel before sales
