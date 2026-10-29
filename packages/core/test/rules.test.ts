/** Rule-level tests beyond the acceptance matrix (ADR-002 rule table). */
import { describe, expect, it } from 'vitest';
import { evaluateDcqlScopeFromJson } from '@wrpguard/core';
import {
  AGE_VCT,
  CONTEXT,
  MDL,
  MDL_NS,
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

describe('WRPG-CTX: context binding', () => {
  it('missing context IDs => indeterminate MISSING_CONTEXT for each missing field', () => {
    const report = evaluate(fixture('request-pass.json'), { context: {} });
    expect(report.decision).toBe('indeterminate');
    expect(report.findings.map((f) => [f.code, f.pointer])).toEqual([
      ['MISSING_CONTEXT', '/intendedUseId'],
      ['MISSING_CONTEXT', '/serviceId'],
    ]);
    const partial = evaluate(fixture('request-pass.json'), { context: { serviceId: 'onboarding' } });
    expect(codes(partial)).toEqual(['MISSING_CONTEXT']);
  });

  it('IDs are compared exactly (case, whitespace)', () => {
    expect(evaluate(fixture('request-pass.json'), { context: { ...CONTEXT, serviceId: 'Onboarding' } }).decision).toBe('fail');
    expect(evaluate(fixture('request-pass.json'), { context: { ...CONTEXT, intendedUseId: 'age-check ' } }).decision).toBe('fail');
  });
});

describe('decision precedence', () => {
  it('fail beats indeterminate', () => {
    const request = dcql(
      sdJwtQuery([['birth_date']]),
      { id: 'w3c', format: 'jwt_vc_json', meta: {}, claims: [{ path: ['x'] }] },
    );
    const report = evaluate(request, { context: {} });
    expect(report.decision).toBe('fail');
    expect(new Set(codes(report))).toEqual(new Set(['MISSING_CONTEXT', 'UNSUPPORTED_CREDENTIAL_FORMAT', 'UNREGISTERED_CLAIM_PATH']));
  });

  it('an unregistered type does not stop evaluation of other queries', () => {
    const request = dcql(
      sdJwtQuery([['age_over_18']], ['https://example.org/credentials/unknown'], 'unknown'),
      mdocQuery([[MDL_NS, 'portrait']]),
    );
    expect(codes(evaluate(request))).toEqual(['UNREGISTERED_CREDENTIAL_TYPE', 'UNREGISTERED_CLAIM_PATH']);
  });
});

describe('WRPG-TYP-01 / WRPG-CLM-01: exact matching', () => {
  it('format/type confusion: a doctype string requested as an SD-JWT vct does not match', () => {
    expect(codes(evaluate(dcql(sdJwtQuery([['age_over_18']], [MDL]))))).toEqual(['UNREGISTERED_CREDENTIAL_TYPE']);
  });

  it('string "0" and integer 0 are different path elements', () => {
    const scope = makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['degrees', 0]] }]);
    expect(evaluate(dcql(sdJwtQuery([['degrees', '0']])), { scope }).decision).toBe('fail');
    expect(evaluate(dcql(sdJwtQuery([['degrees', 0]])), { scope }).decision).toBe('pass');
  });

  it('a narrower child path under a registered parent is not covered (exact policy, documented limitation)', () => {
    const scope = makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['address']] }]);
    expect(evaluate(dcql(sdJwtQuery([['address', 'street']])), { scope }).decision).toBe('fail');
  });

  it('no Unicode normalization: NFC vs NFD identifiers do not match (fails closed)', () => {
    const nfc = `caf${String.fromCharCode(0xe9)}`; // precomposed e-acute
    const nfd = `cafe${String.fromCharCode(0x301)}`; // e + combining acute accent
    const scope = makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [[nfc]] }]);
    expect(evaluate(dcql(sdJwtQuery([[nfd]])), { scope }).decision).toBe('fail');
  });

  it('several queries for the same registered credential pass when each is in scope', () => {
    const request = dcql(sdJwtQuery([['age_over_18']], [AGE_VCT], 'first'), sdJwtQuery([['age_over_18']], [AGE_VCT], 'second'));
    expect(evaluate(request).decision).toBe('pass');
  });

  it('one finding per unregistered claim per registered type', () => {
    const v2 = 'https://example.org/credentials/age-attestation-v2';
    const scope = makeScope([
      { format: 'dc+sd-jwt', type: AGE_VCT, claims: [['age_over_18']] },
      { format: 'dc+sd-jwt', type: v2, claims: [['age_over_18']] },
    ]);
    const report = evaluate(dcql(sdJwtQuery([['a'], ['b']], [AGE_VCT, v2])), { scope });
    expect(report.totalFindings).toBe(4);
  });
});

describe('WRPG-EXT-01: properties not modeled by policy 0.1', () => {
  const cases: [string, unknown, string][] = [
    ['top level', { ...dcql(sdJwtQuery([['age_over_18']])), future_extension: {} }, '/future_extension'],
    ['credential query', dcql({ ...sdJwtQuery([['age_over_18']]), purpose: 'x' }), '/credentials/0/purpose'],
    ['meta', dcql({ ...sdJwtQuery([['age_over_18']]), meta: { vct_values: [AGE_VCT], doctype_value: MDL } }), '/credentials/0/meta/doctype_value'],
    ['claims query', dcql({ ...sdJwtQuery(undefined), claims: [{ path: ['age_over_18'], namespace: 'x' }] }), '/credentials/0/claims/0/namespace'],
    ['intent_to_retain outside mdoc', dcql({ ...sdJwtQuery(undefined), claims: [{ path: ['age_over_18'], intent_to_retain: true }] }), '/credentials/0/claims/0/intent_to_retain'],
    ['credential set', { credentials: [sdJwtQuery([['age_over_18']])], credential_sets: [{ options: [['age']], purpose: 'x' }] }, '/credential_sets/0/purpose'],
    ['trusted authority', dcql({ ...sdJwtQuery([['age_over_18']]), trusted_authorities: [{ type: 'aki', values: ['abc'], extra: 1 }] }), '/credentials/0/trusted_authorities/0/extra'],
  ];
  for (const [label, request, pointer] of cases) {
    it(`unknown property in ${label} => indeterminate, not malformed`, () => {
      const report = evaluate(request);
      expect(report.decision).toBe('indeterminate');
      expect(report.findings).toMatchObject([{ code: 'UNSUPPORTED_DCQL_PROPERTY', pointer }]);
    });
  }

  it('known optional properties do not change a pass', () => {
    const request = dcql({
      ...sdJwtQuery([['age_over_18']]),
      multiple: true,
      require_cryptographic_holder_binding: false,
      trusted_authorities: [{ type: 'etsi_tl', values: ['https://example.org/tl'] }],
    });
    expect(evaluate(request).decision).toBe('pass');
    expect(evaluate(dcql({ ...mdocQuery([]), claims: [{ path: [MDL_NS, 'age_over_18'], intent_to_retain: true }] })).decision).toBe('pass');
  });

  it('"__proto__" in JSON text is an ordinary unknown key and pollutes nothing', () => {
    const text = `{"credentials":[{"id":"age","format":"dc+sd-jwt","meta":{"vct_values":["${AGE_VCT}"]},"claims":[{"path":["age_over_18"]}]}],"__proto__":{"polluted":true}}`;
    const result = evaluateDcqlScopeFromJson({ scopeJson: fixtureText('scope.json'), dcqlQueryJson: text, context: CONTEXT });
    expect(result).toMatchObject({ ok: true, report: { decision: 'indeterminate', findings: [{ pointer: '/__proto__' }] } });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('WRPG-SYN-01: malformed DCQL (OpenID4VP structural rules)', () => {
  const base = sdJwtQuery([['age_over_18']]);
  const cases: [string, unknown][] = [
    ['not an object', [base]],
    ['missing credentials', {}],
    ['empty credentials', { credentials: [] }],
    ['credential not an object', { credentials: ['age'] }],
    ['duplicate credential id', dcql(base, base)],
    ['id with illegal characters', dcql({ ...base, id: 'age query' })],
    ['empty id', dcql({ ...base, id: '' })],
    ['missing format', dcql({ id: 'age', meta: { vct_values: [AGE_VCT] }, claims: [{ path: ['a'] }] })],
    ['missing meta', dcql({ id: 'age', format: 'dc+sd-jwt', claims: [{ path: ['a'] }] })],
    ['missing meta for unsupported format', dcql({ id: 'w3c', format: 'ldp_vc', claims: [{ path: ['a'] }] })],
    ['missing vct_values', dcql({ ...base, meta: {} })],
    ['empty vct_values', dcql({ ...base, meta: { vct_values: [] } })],
    ['non-string vct', dcql({ ...base, meta: { vct_values: [42] } })],
    ['empty vct', dcql({ ...base, meta: { vct_values: [''] } })],
    ['missing doctype_value', dcql({ ...mdocQuery([[MDL_NS, 'age_over_18']]), meta: {} })],
    ['empty claims', dcql({ ...base, claims: [] })],
    ['claims not an array', dcql({ ...base, claims: { path: ['a'] } })],
    ['claim without path', dcql({ ...base, claims: [{ id: 'a' }] })],
    ['duplicate claim path', dcql({ ...base, claims: [{ path: ['a'] }, { path: ['a'] }] })],
    ['duplicate claim id', dcql({ ...base, claims: [{ id: 'x', path: ['a'] }, { id: 'x', path: ['b'] }] })],
    ['claim_sets without claims', dcql({ ...sdJwtQuery(undefined), claim_sets: [['a']] })],
    ['claim_sets with claim lacking id', dcql({ ...base, claims: [{ path: ['age_over_18'] }], claim_sets: [['a']] })],
    ['claim_sets dangling reference', dcql({ ...base, claims: [{ id: 'a', path: ['age_over_18'] }], claim_sets: [['b']] })],
    ['claim_sets empty', dcql({ ...base, claims: [{ id: 'a', path: ['age_over_18'] }], claim_sets: [] })],
    ['credential_sets dangling reference', { credentials: [base], credential_sets: [{ options: [['nope']] }] }],
    ['credential_sets empty option', { credentials: [base], credential_sets: [{ options: [[]] }] }],
    ['credential_sets missing options', { credentials: [base], credential_sets: [{ required: true }] }],
    ['credential_sets non-boolean required', { credentials: [base], credential_sets: [{ options: [['age']], required: 'yes' }] }],
    ['values float', dcql({ ...base, claims: [{ path: ['a'], values: [1.5] }] })],
    ['values empty', dcql({ ...base, claims: [{ path: ['a'], values: [] }] })],
    ['values object', dcql({ ...base, claims: [{ path: ['a'], values: [{}] }] })],
    ['multiple not boolean', dcql({ ...base, multiple: 'true' })],
    ['trusted_authorities empty', dcql({ ...base, trusted_authorities: [] })],
    ['trusted_authorities without values', dcql({ ...base, trusted_authorities: [{ type: 'aki' }] })],
    ['intent_to_retain not boolean (mdoc)', dcql({ ...mdocQuery([]), claims: [{ path: [MDL_NS, 'a'], intent_to_retain: 'no' }] })],
  ];
  for (const [label, request] of cases) {
    it(label, () => {
      const error = rejected(request);
      expect(error.issues.length).toBeGreaterThan(0);
      expect(error.issues.every((issue) => issue.source === 'dcqlQuery' && issue.code === 'MALFORMED_DCQL')).toBe(true);
    });
  }

  it('hints when an Authorization Request is passed instead of its dcql_query', () => {
    const error = rejected({ dcql_query: dcql(sdJwtQuery([['age_over_18']])) });
    expect(error.issues[0]?.message).toContain('dcql_query');
  });
});

describe('WRPG-SCP-01: malformed scope (closed wrpguard.scope/1 schema)', () => {
  const good = makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['age_over_18']] }]);
  const cases: [string, unknown][] = [
    ['not an object', 'scope'],
    ['wrong schemaVersion', { ...good, schemaVersion: 'wrpguard.scope/2' }],
    ['unknown property', { ...good, claims: [] }],
    ['missing serviceId', { ...good, serviceId: undefined }],
    ['empty intendedUseId', { ...good, intendedUseId: '' }],
    ['empty credentials', { ...good, credentials: [] }],
    ['unsupported format', makeScope([{ format: 'jwt_vc_json' as 'mso_mdoc', type: 'x', claims: [['a']] }])],
    ['empty claims', makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [] }])],
    ['duplicate type', makeScope([
      { format: 'dc+sd-jwt', type: AGE_VCT, claims: [['a']] },
      { format: 'dc+sd-jwt', type: AGE_VCT, claims: [['b']] },
    ])],
    ['duplicate path', makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['a'], ['a']] }])],
    ['mdoc path with three elements', makeScope([{ format: 'mso_mdoc', type: MDL, claims: [[MDL_NS, 'a', 'b']] }])],
    ['negative index', makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['a', -1]] }])],
    ['unknown credential property', { ...good, credentials: [{ format: 'dc+sd-jwt', type: AGE_VCT, claims: [['a']], meta: {} }] }],
    ['snapshot with unknown key', { ...good, snapshot: { observedAt: '2026-10-28', signature: 'x' } }],
    ['snapshot non-string', { ...good, snapshot: { observedAt: 20261028 } }],
  ];
  for (const [label, scope] of cases) {
    it(label, () => {
      const error = rejected(fixture('request-pass.json'), { scope });
      expect(error.issues.length).toBeGreaterThan(0);
      expect(error.issues.every((issue) => issue.source === 'scope' && issue.code === 'MALFORMED_SCOPE')).toBe(true);
    });
  }

  it('the same pass request against a valid custom scope passes', () => {
    expect(evaluate(fixture('request-pass.json'), { scope: good }).decision).toBe('pass');
  });
});

describe('context validation and input aggregation', () => {
  it('rejects malformed context', () => {
    for (const context of [{ serviceId: '' }, { serviceId: 7 }, { tenant: 'x' }, 'onboarding']) {
      const error = rejected(fixture('request-pass.json'), { context: context as never });
      expect(error.issues.map((issue) => issue.code)).toEqual(['MALFORMED_CONTEXT']);
    }
  });

  it('aggregates issues from all inputs in a stable order', () => {
    const error = rejected({ credentials: [] }, { scope: { schemaVersion: 'x' }, context: { extra: 1 } as never });
    const sources = error.issues.map((issue) => issue.source);
    expect(sources[0]).toBe('context');
    expect(sources.at(-1)).toBe('dcqlQuery');
    expect(sources.indexOf('scope')).toBeGreaterThan(0);
  });
});
