# START HERE — WRPGuard agent handoff (v1.2)

**Prepared:** 2026-10-28. **Project status:** planned, not implemented. **Audience:** CLI coding agents and their human owner.

## Goal in one sentence
Build a **publicly inspectable, useful TypeScript preflight engine** that evaluates whether a proposed OpenID4VP 1.0 DCQL request exceeds a **caller-supplied normalized registered-scope declaration**, then use real developer integrations to validate a commercial OEM opportunity.

## Read in this order
1. `AGENTS.md` — mandatory constraints for every agent.
2. `MASTER_PLAYBOOK.md` — workstream order, interfaces, release gates.
3. `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/STANDARDS_MATRIX.md`, `docs/ACCEPTANCE.md`.
4. `docs/PUBLIC_RELEASE_PLAN.md`, `docs/LICENSING_DECISION.md`, `docs/COMMERCIAL_VALIDATION.md`.
5. `prompts/00-lead.md`, then the relevant `prompts/NN-*.md` and `tasks/NN-*.md`.

## First action for the lead agent
1. Audit existing files and record concerns; do not assume the kit is production-ready.
2. Verify current official standards, map behaviors to normative clauses, and document conservative product policies separately.
3. Create ADR-001 (API/types/exit codes), ADR-002 (requirements-to-tests), ADR-003 (parser and matching security decisions).
4. Propose the folder tree, worktree ownership map, and one-week backlog. **Only begin independent module implementation after ADR-001 is approved.**
5. Prepare a sanitized public repo; do not push/make public, add a license, publish npm, contact external parties, or start an online service without human approval.

## Architecture + business in 30 seconds
- **Public core:** `@wrpguard/core`, `@wrpguard/cli`, synthetic fixtures, CI, documentation, and reproducible demos.
- **Private commercial layer (later):** genuine verified registry/certificate adapters, enterprise audit/monitoring, managed policy operations, OEM integrations. Not part of the first month.
- **Distribution:** GitHub + npm after approval. License (owner decision 2026-10-28): PolyForm Noncommercial 1.0.0, source-available; commercial use needs a license from Vynx Labs LLC (`docs/LICENSING_DECISION.md`).
- **Value proposition:** reduce scope-mismatch integration mistakes, NOT prove legal permission, registration authenticity, signature validity, or EUDI compliance.
- **Commercial proof:** successful external integrations and paid design partnerships matter more than stars/downloads.

## How to launch agents
Paste `prompts/00-lead.md` into your orchestration/lead CLI agent. Lead gives every specialist its dedicated `tasks/` file and its file ownership, recorded in `docs/WORKSTREAM_OWNERSHIP.md`.

## User approval gates
See `docs/OWNER_APPROVAL_GATES.md`; all publication, licensing, production security claims, external outreach, and customer-data operations need explicit approval.
