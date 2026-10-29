# Public positioning and outreach assets — drafts only

## One-sentence message
"WRPGuard is an experimental TypeScript preflight library that checks OpenID4VP presentation requests against a relying party's **supplied declared scope**, flagging apparent over-requests before they are sent to a wallet."

## README hero (draft)
**Catch unintended wallet-data over-requests before users see them.**

When a relying party builds an OpenID4VP DCQL request, WRPGuard compares the possible requested credential types and claim paths against a locally supplied intended-use declaration and returns deterministic findings for CI or application-level checks.

It does not authenticate the declaration, fetch or validate certificates, determine legal authorization, assess GDPR compliance, or substitute for official wallet/verifier conformance testing.

## Demo script (synthetic)
1. Show `age_over_18` in a declared intended-use scope and a matching request (`pass`).
2. Add `birth_date` to the request and show `UNREGISTERED_CLAIM_PATH` (`fail`).
3. Remove claim selection and show `indeterminate` under WRPGuard's conservative policy.
4. Publish the test mapping and explain precisely what is not checked.

## Outreach draft to a verifier SDK maintainer — do not send autonomously
Subject: Feedback on a DCQL scope-preflight SDK for EUDI integrations?

Hi — we're building an experimental offline TypeScript preflight that checks proposed OpenID4VP DCQL requests against a caller-supplied relying-party scope declaration. Our narrow goal is to catch accidentally overbroad credential/claim requests before integration testing. We're not doing certificate validation or claiming EUDI certification.

Could you share whether your team already solves this, what the hardest edge cases are, and whether an independently tested component would be useful? A short technical review of the synthetic demo would be especially helpful.

Thanks.

## Do not use in public copy
"The first and only", "no competitors", "fully compliant", "approved by the EU", "mandatory to buy", "acquisition target", "production-ready", "zero risk".
