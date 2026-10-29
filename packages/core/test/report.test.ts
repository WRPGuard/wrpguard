/** ADR-001 §3, §7: report contract, ordering, truncation, output safety. */
import { describe, expect, it } from 'vitest';
import { POLICY_VERSION, REASON_CODES, REPORT_NOTICE, REPORT_VERSION, STANDARDS_SNAPSHOT } from '@wrpguard/core';
import { AGE_VCT, dcql, evaluate, fixture, makeScope, rejected, sdJwtQuery } from './helpers.js';

describe('report contract', () => {
  it('carries versions, trust boundary and disclaimer on every report', () => {
    const report = evaluate(fixture('request-pass.json'));
    expect(Object.keys(report)).toEqual([
      'reportVersion',
      'decision',
      'findings',
      'findingsTruncated',
      'totalFindings',
      'subject',
      'evaluated',
      'policyVersion',
      'standardsSnapshot',
      'scopeTrust',
      'notice',
    ]);
    expect(report).toMatchObject({
      reportVersion: REPORT_VERSION,
      policyVersion: POLICY_VERSION,
      standardsSnapshot: STANDARDS_SNAPSHOT,
      scopeTrust: 'caller-supplied-unverified',
      notice: REPORT_NOTICE,
      subject: { relyingPartyId: 'rp-demo', serviceId: 'onboarding', intendedUseId: 'age-check' },
    });
    expect(REPORT_NOTICE).toContain('not proof of registration authenticity');
  });

  it('never emits the reserved UNRESOLVED_ALTERNATIVES code under policy 0.1', () => {
    expect(REASON_CODES).toContain('UNRESOLVED_ALTERNATIVES');
    const report = evaluate(fixture('request-claim-sets-overask.json'));
    expect(report.findings.some((finding) => finding.code === 'UNRESOLVED_ALTERNATIVES')).toBe(false);
  });

  it('is identical across repeated evaluations', () => {
    const request = fixture('request-overask.json');
    expect(JSON.stringify(evaluate(request))).toBe(JSON.stringify(evaluate(request)));
  });
});

describe('ordering and truncation', () => {
  const twelve = {
    credentials: Array.from({ length: 12 }, (_, index) => sdJwtQuery([['age_over_18'], ['birth_date']], [AGE_VCT], `q${String(index)}`)),
  };

  it('orders pointers numerically (credentials/2 before credentials/10)', () => {
    const pointers = evaluate(twelve).findings.map((finding) => finding.pointer);
    expect(pointers).toEqual(Array.from({ length: 12 }, (_, index) => `/credentials/${String(index)}/claims/1/path`));
  });

  it('truncates findings deterministically but keeps the exact total and the decision', () => {
    const report = evaluate(twelve, { options: { limits: { maxReportedFindings: 3 } } });
    expect(report.decision).toBe('fail');
    expect(report.findings).toHaveLength(3);
    expect(report.findingsTruncated).toBe(true);
    expect(report.totalFindings).toBe(12);
    expect(report.findings[2]?.pointer).toBe('/credentials/2/claims/1/path');
  });

  it('truncates input issues with a flag', () => {
    const request = { credentials: Array.from({ length: 5 }, () => ({ id: 'bad id' })) };
    const error = rejected(request, { options: { limits: { maxReportedIssues: 2 } } });
    expect(error.issues).toHaveLength(2);
    expect(error.issuesTruncated).toBe(true);
  });
});

describe('output safety', () => {
  it('escapes bidi and control characters from untrusted identifiers in messages', () => {
    const rlo = String.fromCharCode(0x202e);
    const bell = String.fromCharCode(0x07);
    const csi = String.fromCharCode(0x9b);
    const hostileVct = `https://example.org/${rlo}gpj.exe${bell}${csi}31m`;
    const report = evaluate(dcql(sdJwtQuery([['age_over_18']], [hostileVct])));
    const message = report.findings[0]?.message ?? '';
    expect(message).not.toContain(rlo);
    expect(message).not.toContain(bell);
    expect(message).not.toContain(csi);
    expect(message).toContain('\\u202e');
    // Structured fields keep the exact value for machines; the CLI escapes them on output.
    expect(report.findings[0]?.credentialType).toBe(hostileVct);
  });

  // Reviewer finding F4: invisible characters outside the original escape set.
  it('escapes tag characters, variation selectors and Hangul fillers (astral as surrogate pairs)', () => {
    const tagB = String.fromCodePoint(0xe0062);
    const vs16 = String.fromCodePoint(0xfe0f);
    const filler = String.fromCodePoint(0x3164);
    const report = evaluate(dcql(sdJwtQuery([[`age_over_18${tagB}${vs16}${filler}`]])));
    const message = report.findings[0]?.message ?? '';
    for (const hidden of [tagB, vs16, filler]) expect(message).not.toContain(hidden);
    expect(message).toContain('\\udb40\\udc62');
    expect(message).toContain('\\ufe0f');
  });

  // Reviewer finding F3: output amplification.
  it('shortens long untrusted strings inside messages', () => {
    const long = 'x'.repeat(1000);
    const report = evaluate(dcql(sdJwtQuery([[long]], [`https://example.org/${long}`])));
    expect(report.findings[0]?.message.length).toBeLessThan(400);
    expect(report.findings[0]?.credentialType).toBe(`https://example.org/${long}`);
  });

  it('worst case under default limits stays bounded in time and report size', () => {
    const types = Array.from({ length: 8 }, (_, index) => `https://example.org/credentials/t${String(index)}`);
    const scope = makeScope(types.map((type) => ({ format: 'dc+sd-jwt', type, claims: [['registered']] })));
    const credentials = Array.from({ length: 32 }, (_, query) => ({
      id: `q${String(query)}`,
      format: 'dc+sd-jwt',
      meta: { vct_values: types },
      claims: Array.from({ length: 128 }, (_, claim) => ({ path: [`claim_${String(claim)}`] })),
    }));
    const started = performance.now();
    const report = evaluate({ credentials }, { scope });
    const elapsed = performance.now() - started;
    expect(report.totalFindings).toBe(32 * 8 * 128);
    expect(report.findings).toHaveLength(200);
    expect(JSON.stringify(report).length).toBeLessThan(250_000);
    expect(elapsed).toBeLessThan(3_000);
  });

  it('reports only paths and identifiers, never other parts of the input', () => {
    const scope = makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['age_over_18']] }]);
    const request = dcql({
      ...sdJwtQuery([['birth_date']]),
      trusted_authorities: [{ type: 'aki', values: ['SYNTHETIC-AKI-DO-NOT-ECHO'] }],
    });
    expect(JSON.stringify(evaluate(request, { scope }))).not.toContain('SYNTHETIC-AKI-DO-NOT-ECHO');
  });
});
