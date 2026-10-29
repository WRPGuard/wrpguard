# Public-first adoption and OEM licensing plan

## Decision summary

The prior all-private strategy is **superseded**. We need public discovery, technical trust, and a commercial reason to license the product. A reviewed, public repository and useful SDK improve developer uptake; private enterprise extensions, hosted operations, and OEM obligations can create monetizable value. **Neither public visibility nor any software license may be changed by an agent without explicit project-owner approval.**

## Recommended separation

- **Public:** `@wrpguard/core` and `@wrpguard/cli` (proposed), standards mapping (without copying proprietary third-party texts), synthetic fixtures, reproducible demo, documented supported/unsupported cases, CI, security policy, advisory channel, roadmap. License: PolyForm Noncommercial 1.0.0, source-available (owner decision 2026-10-28, `LICENSING_DECISION.md`).
- **Proprietary (separate package/repository):** verified certificate/registry integration adapters, deployment monitoring, audit-management platform, operational dashboards, premium support and contractually licensed OEM modules. These features must offer genuinely distinct value beyond the public SDK.
- **Not safe for public repo:** real credential data, private keys, customer registration artifacts, partner secrets, non-public agreements, unreleased exploit details that create undue risk.
- **License note (owner decision 2026-10-28):** the core is under PolyForm Noncommercial 1.0.0, so commercial use requires a license from Vynx Labs LLC, while the noncommercial organizations the license names (including government institutions) may use it without one. Dual licensing depends on Vynx Labs LLC holding the rights to all code: set a contributor agreement and obtain professional counsel before accepting outside contributions or selling licenses.

## Discovery before demand

1. Create a **public-ready** README with: one-sentence problem, 60-second synthetic demo, accurate non-certification limitation, support matrix, release roadmap, and contact for pilot integrations.
2. Publish sanitized architecture/design docs and versioned standards-to-rule matrix after approval; maintain a minimal demonstration before claiming feature-completeness.
3. Publish public CI with malicious/negative fixtures (no real user data). Users must be able to reproduce both allowed and rejected requests.
4. Publish alpha npm release only after deterministic tests, dependency/secret audit, independent security review, exact scope limitations, proper licensing and explicit owner approval. Mark `0.x` as experimental with no EUDI conformance claims.
5. Share tangible findings / patches with official EUDI wallet GitHub/reference implementation discussions and relevant OpenID implementer channels; engage with real technical issues rather than advertising.
6. Approach 15–25 verifier vendors and relying-party integrators, aiming for 5 meaningful technical conversations and 2 design partners in the first 60 days. Track discovery and pilots in a simple CRM. Do not assume these are guaranteed.

## Acquisition-oriented metrics

- **Credibility:** reproducible supported cases and security test report, tagged releases, issues resolved with transparency, known limitations tracked.
- **Adoption:** external SDK integrations (more meaningful than stars), third-party contributors, production pilot usage with permission.
- **Commercial:** paid integration pilots, OEM redistribution contracts, recurring support/adapter licenses, renewal rates, integration switching costs.
- **Defensibility:** validated correctness, deep standards traceability, vendor integrations, maintenance record, and customer relationships.

## 30 / 60 / 90-day gates

**Day 30:** public-ready core and docs after review; proof-of-concept validated; 5+ technical outreach conversations attempted; release only if secure.

**Day 60:** pilot integration with synthetic or approved non-sensitive data, independent technical feedback, initial externally reproducible showcase.

**Day 90:** proceed with proprietary adapters only if at least 2 credible design partners and 1 serious paid pilot/LOI or another equivalent market signal; otherwise re-evaluate the niche.

## Contact targets and channels

- Official EUDI Wallet GitHub organization: https://github.com/eu-digital-identity-wallet
- EUDI Reference Implementation contributions/Discussions: https://docs.eudi.dev/
- OpenID Foundation conformance resources: https://openid.net/certification/
- Potential identity verifiers/integrators: outreach by technical role, demo in context, ask for existing scope mismatch workflows, never claim strategic buyer interest without evidence.

## Public claims checklist

Describe the tool as an **offline preflight of caller-supplied declarations**. `pass` is not legal permission, certificate validation, actual registry verification, OpenID certification, or an endorsement by the European Commission. Never state that the product is compliant or production-safe without appropriate independent verification.


**Detailed v1.2 companion docs:** `PUBLIC_RELEASE_PLAN.md`, `LICENSING_DECISION.md`, `COMMERCIAL_VALIDATION.md`, `OWNER_APPROVAL_GATES.md`, `RELEASE_CHECKLIST.md` and `EXTERNAL_POSITIONING.md` supersede less-specific checklists where conflicting.
