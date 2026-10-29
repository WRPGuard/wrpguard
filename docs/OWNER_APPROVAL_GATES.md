# Human owner approval gates (no autonomous action)

| Decision | Agent may prepare | Agent must NOT do before explicit owner approval |
|---|---|---|
| Repo branding | research naming/namespace, draft README | claim trademarks, register legal entities, publish public branding |
| GitHub visibility | sanitize code, scan secrets, prepare release checklist | push to public remote or change repo private/public setting |
| Code license | compare licenses and draft files | select/add/change license text as binding project decision |
| npm publishing | `npm pack --dry-run`, prepare changelog/CI | publish any npm tag, generate/release credentials |
| Commercial agreements | draft pricing/OEM terms/questions | sign contracts, imply a contract or customer exists |
| External outreach | prepare list and personalized drafts | email, DM, post to communities or contact prospects |
| Infrastructure | design deployment proposal | deploy external service or incur paid charges |
| Sensitive data | produce synthetic tests | upload real credentials/registration certificates/tokens/keys |
| Security disclosure | draft assessment/advisory | disclose vulnerabilities or claim certification |

**Release blockers:** false `pass` in supported negative cases; missing standards-policy traceability; unknown OSS obligations; leaking secrets; inaccurate compliance claims; untested distribution path.

**Lead agent status format:** `READY FOR OWNER DECISION: [action] — evidence / risks / exact proposed changes`. Wait for approval for that action while continuing permissible local work.
