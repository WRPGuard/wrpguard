# Commercial validation and strategic acquisition path

## Who might pay (hypotheses, not customers)
- EUDI verifier SDK vendors with many relying-party customers.
- Banks, insurers and regulated SaaS implementers with wallet integrations.
- Identity solution integrators and compliance/audit platform vendors.

## What they might pay for
Verified registry/certificate ingestion adapters, policy update monitoring, multi-tenant audit workflow, enterprise SDK SLAs/maintenance, custom integration/testing, OEM redistribution of separately proprietary modules. **Do not charge for rights the public license already grants (noncommercial use, including by the organizations PolyForm Noncommercial names).**

## Evidence hierarchy
1. Paid pilot / signed commercial agreement (strong).
2. Vendor deploying a production-like integration under its own evaluation and giving technical feedback.
3. Design-partner letter with specific problem, owner and timeline.
4. Positive interview or demo request.
5. GitHub stars / downloads (weak alone).

## Discovery program — owner-directed
- Make a target list of 15–25 vendors/integrators and their engineering/identity product owners. No scraping or sending outreach by agents without approval.
- Conduct 10 structured conversations. Ask: Do you already compare scope to requests? How? What failed? How costly is maintenance? Do you need traceable audit findings? Would you license it, and which constraints matter?
- Aim for two genuine design partners and at least one paid pilot/LOI before building live certificate/trust adapters.
- Record competitive alternatives and reason for non-purchase as carefully as positive feedback.

## Sample technical demonstration
- Request A asks for registered `age_over_18` -> `pass` (declared-scope match).
- Request B additionally asks for unregistered `birth_date` -> `fail` (over-request).
- Request C omits claim selection -> `indeterminate` per conservative WRPGuard policy, *not* necessarily invalid under OpenID4VP.

## Acquisition realism
The public npm package alone is rarely defensible. Durable strategic value comes from integrations, adoption, support contracts, trusted adapters, standards expertise, customer relationships, predictable renewal revenue, and a demonstrably lower cost of acquisition than a buyer's internal rebuild. Do not claim any potential acquirer has expressed interest until that happens.

## 30/60/90-day go/no-go
- Day 30: owner-approved public-ready release candidate plus developer demo and outreach materials.
- Day 60: at least five qualified technical conversations attempted/completed as tracked; a real integration proof of concept.
- Day 90: if no design partners, paid pilot, or meaningful procurement signals, reevaluate market before spending on production-grade trust infrastructure.
