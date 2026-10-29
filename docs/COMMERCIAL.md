# Commercial / strategic acquisition design

## Asset to protect
Implementation correctness and reproducible versioned test corpus; platform-neutral TypeScript API; minimal dependency load; reproducible results; credible independent source references; real customer integrations and contract renewal potential.

## Licensing decisions (owner required)
- Owner decision (2026-10-28): public core under PolyForm Noncommercial 1.0.0; commercial use requires a paid license from Vynx Labs LLC (`LICENSING_DECISION.md`). Proprietary enterprise connectors, hosted monitoring and OEM distribution rights remain separate offerings. Do not change the license or publish without approval.
- Commission legal review before distributing binaries, source, SDK evaluation keys, indemnities, or offering regulatory warranties.
- For proprietary add-ons, consider evaluation agreements, annual OEM redistribution licenses, deployment licensing, and source-code escrow. Rights the public license already grants (noncommercial use, including by the organizations it names) cannot be sold back as though private.
- Track third-party license obligations in SBOM; clean provenance for agent-generated code; no pasted spec code or incompatible library code.
- Distinguish a technical `pass` from a legal certification in terms and marketing.

## Interview target
Identity providers, verifier SDK vendors, bank EUDI wallet integration teams, and relying-party platform integrators. Ask: How is registered intended use mapped to requests? Who owns mismatches? What's the cost of internal integration? Would they license a standalone preflight library? Which certification constraints block adoption?

## Buyer evidence gates
- 10 interviews; 3 design partners; 1 signed paid pilot or LOI before building production PKI/registry integrations.
- Price based on saved internal engineering/audit cost and production rollout risk, not generic npm downloads.
- Potential acquirers are *hypotheses*, not existing buyers. No guaranteed exit.

## Discoverability and distribution
- Publish clear repo/README, public CI, synthetic quickstart, a reproducible over-request demo, standards-to-test traceability, and honest limits; avoid unsupported conformance claims.
- Participate usefully in the official EUDI GitHub Discussions and reference implementation issue threads, OpenID implementation discussions, and relevant verifier SDK communities; never spam.
- npm downloads, GitHub adoption, integration PRs, and design partners are leading indicators; paid pilots and OEM LOIs are stronger buyer evidence.
- See `docs/ADOPTION_AND_LICENSING.md` for detailed launch gates and OEM strategy.
