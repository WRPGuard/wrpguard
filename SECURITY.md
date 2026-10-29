# Security policy

WRPGuard is **experimental**. It checks only whether a proposed OpenID4VP 1.0 DCQL query matches a caller-supplied scope declaration. It does not validate registration certificates, signatures, revocation or legal permission, and it must not replace conformant identity security controls.

## What counts as a vulnerability
- A **false `pass`**: an input where WRPGuard reports `pass` (exit 0) although the query could request a credential type or claim path outside the supplied declaration, within the supported scope described in `docs/adr/ADR-002-standards-traceability.md`.
- Parser differentials, crashes, hangs or unbounded resource use on untrusted input.
- Leakage of requested `values` or other input content into reports.
- Terminal or log injection through CLI output.

Documented limitations (see README "Known limitations") are not vulnerabilities, but reports that show their practical impact are welcome.

## Reporting
Report privately through GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability** (<https://github.com/WRPGuard/wrpguard/security/advisories/new>).

- Do not open a public issue, discussion or pull request for a suspected vulnerability, and do not publish exploit details before coordinated review.
- Use synthetic inputs only. Never include real credentials, keys, tokens, registration certificates or personal data in a report.

## Supported versions
While WRPGuard is 0.x, only the latest published version receives security fixes.

## After you report
We aim to acknowledge a report within 5 business days, agree a fix and disclosure date with you, and publish a GitHub security advisory when the fix is released. Please allow up to 90 days before public disclosure. Reporters are credited in the advisory unless they prefer otherwise.
