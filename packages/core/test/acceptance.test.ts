/**
 * docs/ACCEPTANCE.md T01–T17 (T18 is the CLI integration suite in packages/cli/test).
 * Every case uses synthetic data only.
 */
import { describe, expect, it } from 'vitest';
import { evaluateDcqlScopeFromJson } from '@wrpguard/core';
import {
  AGE_VCT,
  CONTEXT,
  MDL,
  MDL_NS,
  SCOPE,
  codes,
  dcql,
  evaluate,
  fixture,
  fixtureText,
  makeScope,
  mdocQuery,
  rejected,
  sdJwtQuery,
} from './helpers.js';

describe('ACCEPTANCE T01–T17', () => {
  it('T01 valid SD-JWT type and exact registered age_over_18 => pass', () => {
    const report = evaluate(fixture('request-pass.json'));
    expect(report.decision).toBe('pass');
    expect(report.findings).toEqual([]);
    expect(report.evaluated).toEqual({ credentialQueries: 1, claimQueries: 1 });
  });

  it('T02 adds unregistered birth_date path => fail UNREGISTERED_CLAIM_PATH', () => {
    const report = evaluate(fixture('request-overask.json'));
    expect(report.decision).toBe('fail');
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      code: 'UNREGISTERED_CLAIM_PATH',
      effect: 'fail',
      ruleId: 'WRPG-CLM-01',
      source: 'dcqlQuery',
      pointer: '/credentials/0/claims/1/path',
      credentialQueryId: 'age',
      credentialType: AGE_VCT,
      claimPath: ['birth_date'],
    });
  });

  it('T03 unknown vct or doctype => fail UNREGISTERED_CREDENTIAL_TYPE', () => {
    const vct = evaluate(dcql(sdJwtQuery([['age_over_18']], ['https://example.org/credentials/unknown'])));
    expect(vct.decision).toBe('fail');
    expect(vct.findings).toMatchObject([
      { code: 'UNREGISTERED_CREDENTIAL_TYPE', pointer: '/credentials/0/meta/vct_values/0' },
    ]);

    const doctype = evaluate(dcql(mdocQuery([[MDL_NS, 'age_over_18']], 'org.example.unknown.doctype')));
    expect(doctype.decision).toBe('fail');
    expect(doctype.findings).toMatchObject([
      { code: 'UNREGISTERED_CREDENTIAL_TYPE', pointer: '/credentials/0/meta/doctype_value' },
    ]);
  });

  it('T04 incorrect intended-use ID => fail WRONG_INTENDED_USE', () => {
    const report = evaluate(fixture('request-pass.json'), { context: { ...CONTEXT, intendedUseId: 'marketing' } });
    expect(report.decision).toBe('fail');
    expect(report.findings).toMatchObject([{ code: 'WRONG_INTENDED_USE', source: 'context', pointer: '/intendedUseId' }]);
  });

  it('T05 incorrect service ID => fail WRONG_SERVICE', () => {
    const report = evaluate(fixture('request-pass.json'), { context: { ...CONTEXT, serviceId: 'checkout' } });
    expect(report.decision).toBe('fail');
    expect(report.findings).toMatchObject([{ code: 'WRONG_SERVICE', source: 'context', pointer: '/serviceId' }]);
  });

  it('T06 missing claims => indeterminate MISSING_CLAIM_SELECTION (policy, not invalid DCQL)', () => {
    const report = evaluate(fixture('request-indeterminate.json'));
    expect(report.decision).toBe('indeterminate');
    expect(report.findings).toMatchObject([{ code: 'MISSING_CLAIM_SELECTION', effect: 'indeterminate', pointer: '/credentials/0' }]);
    expect(report.findings[0]?.message).toContain('valid under OpenID4VP 1.0');
  });

  it('T07 unsupported format => indeterminate UNSUPPORTED_CREDENTIAL_FORMAT', () => {
    const report = evaluate(fixture('request-unsupported-format.json'));
    expect(report.decision).toBe('indeterminate');
    expect(codes(report)).toEqual(['UNSUPPORTED_CREDENTIAL_FORMAT']);

    // Format identifiers are case-sensitive; a near-miss must not be treated as supported.
    const nearMiss = dcql({ ...sdJwtQuery([['age_over_18']]), format: 'DC+SD-JWT' });
    expect(evaluate(nearMiss).decision).toBe('indeterminate');
  });

  it('T08 parent path requested while only a child path is registered => fail', () => {
    const scope = makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['address', 'street']] }]);
    const report = evaluate(dcql(sdJwtQuery([['address']])), { scope });
    expect(report.decision).toBe('fail');
    expect(report.findings).toMatchObject([{ code: 'UNREGISTERED_CLAIM_PATH', claimPath: ['address'] }]);
    expect(report.findings[0]?.message).toContain('parent of a registered path');

    // Wildcard widening: registered index 0 does not cover null (all elements), and vice versa.
    const indexScope = makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['nationalities', 0]] }]);
    expect(evaluate(dcql(sdJwtQuery([['nationalities', null]])), { scope: indexScope }).decision).toBe('fail');
    const wildcardScope = makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['nationalities', null]] }]);
    expect(evaluate(dcql(sdJwtQuery([['nationalities', 0]])), { scope: wildcardScope }).decision).toBe('fail');
    expect(evaluate(dcql(sdJwtQuery([['nationalities', null]])), { scope: wildcardScope }).decision).toBe('pass');
  });

  it('T09 mdoc namespace/element registered => pass', () => {
    const report = evaluate(fixture('request-mdoc-pass.json'));
    expect(report.decision).toBe('pass');
    expect(report.findings).toEqual([]);
  });

  it('T10 mdoc namespace/element not registered => fail', () => {
    const element = evaluate(dcql(mdocQuery([[MDL_NS, 'portrait']])));
    expect(element.decision).toBe('fail');
    expect(element.findings).toMatchObject([{ code: 'UNREGISTERED_CLAIM_PATH', claimPath: [MDL_NS, 'portrait'] }]);

    const namespace = evaluate(dcql(mdocQuery([['org.example.other.namespace', 'age_over_18']])));
    expect(namespace.decision).toBe('fail');
  });

  it('T11 multi-vct with one registered and one unregistered type => fail', () => {
    const report = evaluate(dcql(sdJwtQuery([['age_over_18']], [AGE_VCT, 'https://example.org/credentials/other'])));
    expect(report.decision).toBe('fail');
    expect(report.findings).toMatchObject([{ code: 'UNREGISTERED_CREDENTIAL_TYPE', pointer: '/credentials/0/meta/vct_values/1' }]);

    // Both types registered, but the claim is registered for only one of them.
    const otherVct = 'https://example.org/credentials/age-attestation-v2';
    const scope = makeScope([
      { format: 'dc+sd-jwt', type: AGE_VCT, claims: [['age_over_18'], ['birth_date']] },
      { format: 'dc+sd-jwt', type: otherVct, claims: [['age_over_18']] },
    ]);
    const partial = evaluate(dcql(sdJwtQuery([['birth_date']], [AGE_VCT, otherVct])), { scope });
    expect(partial.decision).toBe('fail');
    expect(partial.findings).toMatchObject([{ code: 'UNREGISTERED_CLAIM_PATH', credentialType: otherVct }]);
  });

  it('T12 claim_sets with an unregistered possible alternative => never pass', () => {
    const report = evaluate(fixture('request-claim-sets-overask.json'));
    expect(report.decision).toBe('fail');
    expect(report.findings).toMatchObject([{ code: 'UNREGISTERED_CLAIM_PATH', pointer: '/credentials/0/claims/1/path' }]);

    // Least-preferred option still counts.
    const lastOption = {
      ...sdJwtQuery(undefined),
      claims: [
        { id: 'a', path: ['age_over_18'] },
        { id: 'b', path: ['birth_date'] },
      ],
      claim_sets: [['a'], ['a', 'b']],
    };
    expect(evaluate(dcql(lastOption)).decision).toBe('fail');

    // A claims entry no option references is still evaluated (stricter than §6.4.1, WRPG-ALT-01).
    const unreferenced = { ...lastOption, claim_sets: [['a']] };
    expect(evaluate(dcql(unreferenced)).decision).toBe('fail');

    // An empty option selects no claims: policy treats it like absent claims.
    const emptyOption = { ...lastOption, claims: [{ id: 'a', path: ['age_over_18'] }], claim_sets: [['a'], []] };
    const empty = evaluate(dcql(emptyOption));
    expect(empty.decision).toBe('indeterminate');
    expect(empty.findings).toMatchObject([{ code: 'MISSING_CLAIM_SELECTION', pointer: '/credentials/0/claim_sets/1' }]);
  });

  it('T13 credential_sets with an unsupported branch => indeterminate or fail, never pass', () => {
    const report = evaluate(fixture('request-credential-sets-unsupported.json'));
    expect(report.decision).toBe('indeterminate');
    expect(report.findings).toMatchObject([{ code: 'UNSUPPORTED_CREDENTIAL_FORMAT', credentialQueryId: 'w3c_age' }]);

    // An optional (required: false) set is still requestable.
    const optional = {
      credentials: [sdJwtQuery([['age_over_18']]), sdJwtQuery([['age_over_18']], ['https://example.org/credentials/loyalty'], 'loyalty')],
      credential_sets: [{ options: [['age']] }, { options: [['loyalty']], required: false }],
    };
    expect(evaluate(optional).decision).toBe('fail');

    // A credential query referenced by no set is still evaluated.
    const unreferenced = { ...optional, credential_sets: [{ options: [['age']] }] };
    expect(evaluate(unreferenced).decision).toBe('fail');
  });

  it('T14 invalid path elements => malformed input (no decision)', () => {
    const invalidPaths: unknown[] = [[-1], [1.5], [], [{}], ['age_over_18', true], [''], [-0], [Number.MAX_SAFE_INTEGER + 1], 'age_over_18', null];
    for (const path of invalidPaths) {
      const error = rejected(dcql({ ...sdJwtQuery(undefined), claims: [{ path }] }));
      expect(error.status).toBe('invalid_input');
      expect(error.issues.map((issue) => issue.code)).toEqual(['MALFORMED_DCQL']);
      expect(error.issues[0]?.pointer.startsWith('/credentials/0/claims/0/path')).toBe(true);
    }
    // mdoc paths must be exactly two strings (OpenID4VP 1.0 §7.2).
    for (const path of [[MDL_NS], [MDL_NS, 'age_over_18', 'extra'], [MDL_NS, null], [MDL_NS, 0]]) {
      expect(rejected(dcql({ ...mdocQuery([]), claims: [{ path }] })).issues[0]?.code).toBe('MALFORMED_DCQL');
    }
    // Same through the JSON text path, including the literal -0.
    const text = `{"credentials":[{"id":"age","format":"dc+sd-jwt","meta":{"vct_values":["${AGE_VCT}"]},"claims":[{"path":["a",-0]}]}]}`;
    const result = evaluateDcqlScopeFromJson({ scopeJson: fixtureText('scope.json'), dcqlQueryJson: text, context: CONTEXT });
    expect(result.ok).toBe(false);

    // Reviewer finding F1: a literal that rounds to a registered index must not pass.
    const scopeJson = JSON.stringify(makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['nationalities', 1]] }]));
    for (const index of ['0.99999999999999999999', '1.0', '1e0', '10e-1']) {
      const dcqlQueryJson = `{"credentials":[{"id":"a","format":"dc+sd-jwt","meta":{"vct_values":["${AGE_VCT}"]},"claims":[{"path":["nationalities",${index}]}]}]}`;
      const rounded = evaluateDcqlScopeFromJson({ scopeJson, dcqlQueryJson, context: CONTEXT });
      expect(rounded).toMatchObject({ ok: false, error: { issues: [{ code: 'MALFORMED_DCQL' }] } });
    }
  });

  it('T15 malformed JSON and huge nesting => bounded failure, no hang', () => {
    const scopeJson = fixtureText('scope.json');
    const truncated = evaluateDcqlScopeFromJson({ scopeJson, dcqlQueryJson: '{"credentials": [', context: CONTEXT });
    expect(truncated).toMatchObject({ ok: false, error: { issues: [{ code: 'MALFORMED_DCQL' }] } });

    const started = performance.now();
    const deep = evaluateDcqlScopeFromJson({ scopeJson, dcqlQueryJson: '['.repeat(100_000), context: CONTEXT });
    expect(deep).toMatchObject({ ok: false, error: { issues: [{ code: 'INPUT_TOO_LARGE' }] } });

    const huge = `{"credentials":[],"padding":"${'x'.repeat(10 * 1024 * 1024)}"}`;
    const big = evaluateDcqlScopeFromJson({ scopeJson, dcqlQueryJson: huge, context: CONTEXT });
    expect(big).toMatchObject({ ok: false, error: { issues: [{ code: 'INPUT_TOO_LARGE', pointer: '' }] } });
    expect(performance.now() - started).toBeLessThan(2_000);

    // Deeply nested pre-parsed values (including cycles) are bounded too.
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(rejected(cyclic).issues[0]?.code).toBe('INPUT_TOO_LARGE');
  });

  it('T16 equivalent requests with reordered keys => identical reports', () => {
    const request = {
      credentials: [
        { id: 'age', format: 'dc+sd-jwt', meta: { vct_values: [AGE_VCT] }, claims: [{ id: 'a', path: ['age_over_18'] }, { id: 'b', path: ['birth_date'] }], claim_sets: [['a'], ['b']], extension: true },
        { id: 'mdl', format: 'mso_mdoc', meta: { doctype_value: MDL }, claims: [{ path: [MDL_NS, 'portrait'], intent_to_retain: false }] },
      ],
      credential_sets: [{ options: [['age'], ['mdl']], required: true }],
    };
    const reorder = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reorder);
      if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(Object.entries(value).reverse().map(([key, inner]) => [key, reorder(inner)]));
      }
      return value;
    };
    const original = evaluate(request);
    const reordered = evaluate(reorder(request));
    expect(original.decision).toBe('fail');
    expect(JSON.stringify(reordered)).toBe(JSON.stringify(original));

    const scopeReordered = evaluate(request, { scope: reorder(SCOPE) });
    expect(JSON.stringify(scopeReordered)).toBe(JSON.stringify(original));
  });

  it('T17 raw values are never reflected in findings or errors', () => {
    const marker = 'SYNTHETIC-CLAIM-VALUE-7f3a';
    const request = dcql({ ...sdJwtQuery(undefined), claims: [{ path: ['birth_date'], values: [marker, 19700101, true] }] });
    const report = evaluate(request);
    expect(report.decision).toBe('fail');
    expect(JSON.stringify(report)).not.toContain(marker);
    expect(JSON.stringify(report)).not.toContain('19700101');

    // values never narrow evaluation, and a values filter on a registered claim still passes.
    const registered = dcql({ ...sdJwtQuery(undefined), claims: [{ path: ['age_over_18'], values: [true] }] });
    expect(evaluate(registered).decision).toBe('pass');

    // Malformed values: the error describes the problem without echoing the value.
    const malformed = dcql({ ...sdJwtQuery(undefined), claims: [{ path: ['age_over_18'], values: [marker, 1.5] }] });
    const error = rejected(malformed);
    expect(JSON.stringify(error)).not.toContain(marker);
  });
});
