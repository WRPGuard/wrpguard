/**
 * ETSI TS 119 475 registration certificates as the declaration (ADR-002 WRPG-CRT-01, WRPG-CRT-02).
 * Synthetic certificates only; signatures are placeholders and are never verified.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  evaluateDcqlRegistrationCertificate,
  type EvaluateOptions,
  type EvaluationContext,
  type EvaluationReport,
  type EvaluationResult,
  type InputErrorReport,
} from '@wrpguard/core';
import { AGE_VCT, MDL, MDL_NS, dcql, fixture, fixtureText, mdocQuery, sdJwtQuery, type Path } from './helpers.js';

type Json = Record<string, unknown>;

const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64url');
const jwt = (payload: unknown, header: unknown = { typ: 'rc-wrp+jwt', alg: 'ES256', x5c: [] }, signature = 'c2ln'): string =>
  `${b64(JSON.stringify(header))}.${b64(JSON.stringify(payload))}.${signature}`;

const certificate = (credentials: unknown[], extra: Json = {}): Json => ({
  sub: 'synthetic-rp-0001',
  intended_use_id: 'age-check',
  credentials,
  ...extra,
});
const sdJwt = (vct: string[], claim?: Path[]): Json => ({
  format: 'dc+sd-jwt',
  meta: { vct_values: vct },
  ...(claim === undefined ? {} : { claim: claim.map((path) => ({ path })) }),
});
const mdoc = (claim: Path[], doctype = MDL): Json => ({ format: 'mso_mdoc', meta: { doctype_value: doctype }, claim: claim.map((path) => ({ path })) });
const AGE_CERT = certificate([sdJwt([AGE_VCT], [['age_over_18']]), mdoc([[MDL_NS, 'age_over_18']])]);
const withoutId: Json = Object.fromEntries(Object.entries(AGE_CERT).filter(([key]) => key !== 'intended_use_id'));

function check(cert: unknown, query: unknown, context?: EvaluationContext, options?: EvaluateOptions): EvaluationResult {
  const registrationCertificate = typeof cert === 'string' ? cert : JSON.stringify(cert);
  return evaluateDcqlRegistrationCertificate(
    { registrationCertificate, dcqlQueryJson: JSON.stringify(query), ...(context === undefined ? {} : { context }) },
    options,
  );
}
function report(cert: unknown, query: unknown, context?: EvaluationContext): EvaluationReport {
  const result = check(cert, query, context);
  if (!result.ok) throw new Error(`expected a report, got ${JSON.stringify(result.error.issues)}`);
  return result.report;
}
function invalid(cert: unknown, query: unknown = dcql(sdJwtQuery([['age_over_18']])), context?: EvaluationContext): InputErrorReport {
  const result = check(cert, query, context);
  if (result.ok) throw new Error(`expected invalid input, got ${result.report.decision}`);
  return result.error;
}
const codes = (r: EvaluationReport): string[] => r.findings.map((finding) => finding.code);
const AGE_QUERY = dcql(sdJwtQuery([['age_over_18']]));

describe('certificate forms', () => {
  it('the fixture JSON payload and compact JWT give identical reports', () => {
    const fromJson = check(fixtureText('registration-cert.json'), fixture('request-pass.json'));
    const fromJwt = check(fixtureText('registration-cert.jwt'), fixture('request-pass.json'));
    expect(fromJson).toEqual(fromJwt);
    expect(fromJson.ok && fromJson.report.decision).toBe('pass');
  });

  it('report subject: sub, intended_use_id, and no service identifier', () => {
    expect(report(AGE_CERT, AGE_QUERY).subject).toEqual({ relyingPartyId: 'synthetic-rp-0001', serviceId: '', intendedUseId: 'age-check' });
    expect(report(withoutId, AGE_QUERY).subject.intendedUseId).toBe('');
  });

  it('accepts surrounding whitespace, a BOM and a case-insensitive typ', () => {
    const bom = String.fromCharCode(0xfeff);
    expect(report(`${bom}\n ${jwt(AGE_CERT)} \n`, AGE_QUERY).decision).toBe('pass');
    expect(report(jwt(AGE_CERT, { typ: 'RC-WRP+JWT', alg: 'ES256' }), AGE_QUERY).decision).toBe('pass');
  });

  it('accepts the base64url-wrapped JWT from a verifier_info "registration_cert" element (TS 119 472-2 RO-16)', () => {
    const wrapped = b64(jwt(AGE_CERT));
    expect(check(wrapped, AGE_QUERY)).toEqual(check(jwt(AGE_CERT), AGE_QUERY));
    expect(invalid(b64(JSON.stringify(AGE_CERT))).issues[0]?.message).toContain('RO-16');
  });

  it('does not verify the signature: the trust boundary is documented, not enforced', () => {
    expect(report(jwt(AGE_CERT, undefined, 'bm90LWEtc2ln'), AGE_QUERY).decision).toBe('pass');
  });

  it.each([
    ['two segments', `${b64('{"typ":"rc-wrp+jwt"}')}.${b64('{}')}`],
    ['empty signature', `${b64('{"typ":"rc-wrp+jwt"}')}.${b64(JSON.stringify(AGE_CERT))}.`],
    ['padding', `${b64('{"typ":"rc-wrp+jwt"}')}=.${b64(JSON.stringify(AGE_CERT))}.c2ln`],
    ['not base64url', 'a+b.c.d'],
    ['binary-looking text (CWT)', 'xyz'],
    ['wrong typ', jwt(AGE_CERT, { typ: 'JWT', alg: 'ES256' })],
    ['missing typ', jwt(AGE_CERT, { alg: 'ES256' })],
    ['typ for CWT', jwt(AGE_CERT, { typ: 'rc-wrp+cwt' })],
    ['header not JSON', `${b64('not json')}.${b64(JSON.stringify(AGE_CERT))}.c2ln`],
    ['payload not JSON', `${b64('{"typ":"rc-wrp+jwt"}')}.${b64('not json')}.c2ln`],
    ['payload invalid UTF-8', `${b64('{"typ":"rc-wrp+jwt"}')}.${Buffer.from([0x7b, 0xff, 0x7d]).toString('base64url')}.c2ln`],
    ['non-canonical base64url bits', `${b64('{"typ":"rc-wrp+jwt"}')}.e31.c2ln`],
    ['length mod 4 = 1', `${b64('{"typ":"rc-wrp+jwt"}')}.e30AA.c2ln`],
  ])('rejects %s as MALFORMED_SCOPE', (_name, text) => {
    const error = invalid(text);
    expect(error.issues.map((issue) => [issue.code, issue.source])).toContainEqual(['MALFORMED_SCOPE', 'scope']);
  });

  it('rejects non-canonical base64url (trailing bits set) even when the payload is otherwise valid', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const payload = [0, 1, 2].map((n) => b64(JSON.stringify({ ...AGE_CERT, pad: 'x'.repeat(n) }))).find((s) => s.length % 4 !== 0) ?? '';
    const last = alphabet.indexOf(payload.at(-1) ?? 'A');
    const tampered = `${payload.slice(0, -1)}${alphabet[last | 1] ?? ''}`;
    const header = b64('{"typ":"rc-wrp+jwt"}');
    expect(report(`${header}.${payload}.c2ln`, AGE_QUERY).decision).toBe('pass');
    expect(invalid(`${header}.${tampered}.c2ln`).issues[0]?.message).toContain('not valid base64url');
  });

  it('mentions that CWT certificates are not supported', () => {
    expect(invalid('xyz').issues[0]?.message).toContain('rc-wrp+cwt');
  });

  it('rejects duplicate keys in the JWT payload (parser differential)', () => {
    const smuggled = `{"sub":"x","credentials":[],"credentials":${JSON.stringify(AGE_CERT['credentials'])}}`;
    const error = invalid(`${b64('{"typ":"rc-wrp+jwt"}')}.${b64(smuggled)}.c2ln`);
    expect(error.issues[0]?.message).toContain('duplicate');
  });

  it('bounds input size', () => {
    const big = jwt(certificate([sdJwt([AGE_VCT], [['a'.repeat(900)]])]));
    const result = check(big, AGE_QUERY, undefined, { limits: { maxInputBytes: 512 } });
    expect(!result.ok && result.error.issues[0]?.code).toBe('INPUT_TOO_LARGE');
    const many = certificate(Array.from({ length: 5 }, () => sdJwt([AGE_VCT], [['age_over_18']])));
    const tooMany = check(many, AGE_QUERY, undefined, { limits: { maxScopeCredentials: 4 } });
    expect(!tooMany.ok && tooMany.error.issues[0]?.code).toBe('INPUT_TOO_LARGE');
  });

  it('throws TypeError for non-string inputs', () => {
    expect(() => evaluateDcqlRegistrationCertificate({ registrationCertificate: AGE_CERT as never, dcqlQueryJson: '{}' })).toThrow(TypeError);
  });
});

describe('WRPG-CRT-01: the certificate credentials are the declaration', () => {
  it('pass, unregistered claim, unregistered type, and a multi-vct query with one unregistered type', () => {
    expect(report(AGE_CERT, AGE_QUERY).decision).toBe('pass');
    expect(report(AGE_CERT, dcql(mdocQuery([[MDL_NS, 'age_over_18']]))).decision).toBe('pass');
    expect(codes(report(AGE_CERT, dcql(sdJwtQuery([['age_over_18'], ['birth_date']]))))).toEqual(['UNREGISTERED_CLAIM_PATH']);
    expect(codes(report(AGE_CERT, dcql(sdJwtQuery([['age_over_18']], ['https://example.org/other']))))).toEqual(['UNREGISTERED_CREDENTIAL_TYPE']);
    expect(report(AGE_CERT, dcql(sdJwtQuery([['age_over_18']], [AGE_VCT, 'https://example.org/other']))).decision).toBe('fail');
    expect(codes(report(AGE_CERT, dcql(mdocQuery([[MDL_NS, 'birth_date']]))))).toEqual(['UNREGISTERED_CLAIM_PATH']);
  });

  it('several vct_values in one entry declare every type with the same claims', () => {
    const cert = certificate([sdJwt([AGE_VCT, 'https://example.org/b'], [['age_over_18']])]);
    expect(report(cert, dcql(sdJwtQuery([['age_over_18']], ['https://example.org/b']))).decision).toBe('pass');
    expect(report(cert, dcql(sdJwtQuery([['age_over_18']], [AGE_VCT, 'https://example.org/b']))).decision).toBe('pass');
  });

  it('entries for the same type are merged', () => {
    const cert = certificate([sdJwt([AGE_VCT], [['a']]), sdJwt([AGE_VCT], [['b']])]);
    expect(report(cert, dcql(sdJwtQuery([['a'], ['b']]))).decision).toBe('pass');
    expect(report(cert, dcql(sdJwtQuery([['c']]))).decision).toBe('fail');
  });

  it('an entry without claim (or with an empty claim list) declares the type but no claims', () => {
    for (const entry of [sdJwt([AGE_VCT]), { ...sdJwt([AGE_VCT]), claim: [] }]) {
      const cert = certificate([entry]);
      const withClaims = report(cert, AGE_QUERY);
      expect(withClaims.decision).toBe('fail');
      expect(withClaims.findings[0]?.message).toContain('No claim paths are declared for this type.');
      expect(codes(report(cert, dcql(sdJwtQuery(undefined))))).toEqual(['MISSING_CLAIM_SELECTION']);
    }
  });

  it('paths match exactly: parent, child, wildcard and index are distinct', () => {
    const cert = certificate([sdJwt([AGE_VCT], [['address', 'street'], ['nationalities', null]])]);
    expect(report(cert, dcql(sdJwtQuery([['address']]))).decision).toBe('fail');
    expect(report(cert, dcql(sdJwtQuery([['nationalities', 0]]))).decision).toBe('fail');
    expect(report(cert, dcql(sdJwtQuery([['nationalities', null]]))).decision).toBe('pass');
  });

  it('entries in unsupported formats are skipped; queries in those formats stay indeterminate', () => {
    const cert = certificate([{ format: 'jwt_vc_json', anything: true }, sdJwt([AGE_VCT], [['age_over_18']])]);
    expect(report(cert, AGE_QUERY).decision).toBe('pass');
    const query = dcql({ id: 'w3c', format: 'jwt_vc_json', meta: { type_values: [['VerifiableCredential']] }, claims: [{ path: ['a'] }] });
    expect(codes(report(cert, query))).toEqual(['UNSUPPORTED_CREDENTIAL_FORMAT']);
  });

  it('claim values are ignored for matching but must be well formed', () => {
    const withValues = certificate([{ ...sdJwt([AGE_VCT]), claim: [{ path: ['age_over_18'], values: [true] }] }]);
    expect(report(withValues, AGE_QUERY).decision).toBe('pass');
    const badValues = certificate([{ ...sdJwt([AGE_VCT]), claim: [{ path: ['age_over_18'], values: 'yes' }] }]);
    expect(invalid(badValues).issues[0]?.pointer).toBe('/credentials/0/claim/0/values');
  });

  it('ignores payload fields that do not describe requestable data', () => {
    const cert = { ...AGE_CERT, name: 'x', srv_description: [[{ lang: 'en', value: 'x' }]], provides_attestations: [{ format: 'dc+sd-jwt' }], future_field: 1 };
    expect(report(cert, AGE_QUERY).decision).toBe('pass');
  });

  it('identical reports for reordered payload keys', () => {
    const reordered = { credentials: AGE_CERT['credentials'], intended_use_id: 'age-check', sub: 'synthetic-rp-0001' };
    expect(JSON.stringify(check(reordered, AGE_QUERY))).toBe(JSON.stringify(check(AGE_CERT, AGE_QUERY)));
  });

  it.each<[string, Json, string]>([
    ['missing sub', { intended_use_id: 'x', credentials: AGE_CERT['credentials'] }, '/sub'],
    ['empty intended_use_id', { ...AGE_CERT, intended_use_id: '' }, '/intended_use_id'],
    ['missing credentials', { sub: 'x' }, '/credentials'],
    ['empty credentials', { sub: 'x', credentials: [] }, '/credentials'],
    ['an entry that is not an object', certificate([1]), '/credentials/0'],
    ['a missing format', certificate([{ meta: { vct_values: [AGE_VCT] } }]), '/credentials/0/format'],
    ['a missing meta', certificate([{ format: 'dc+sd-jwt' }]), '/credentials/0/meta'],
    ['empty vct_values', certificate([sdJwt([])]), '/credentials/0/meta/vct_values'],
    ['a missing doctype_value', certificate([{ format: 'mso_mdoc', meta: {} }]), '/credentials/0/meta/doctype_value'],
    ['an unknown meta key', certificate([{ format: 'dc+sd-jwt', meta: { vct_values: [AGE_VCT], issuer: 'x' } }]), '/credentials/0/meta/issuer'],
    ['an unknown entry key', certificate([{ ...sdJwt([AGE_VCT], [['a']]), trusted_authorities: [] }]), '/credentials/0/trusted_authorities'],
    ['an unknown claim key', certificate([{ ...sdJwt([AGE_VCT]), claim: [{ path: ['a'], intent_to_retain: true }] }]), '/credentials/0/claim/0/intent_to_retain'],
    ['claim not an array', certificate([{ ...sdJwt([AGE_VCT]), claim: { path: ['a'] } }]), '/credentials/0/claim'],
    ['a negative path index', certificate([sdJwt([AGE_VCT], [['a', -1]])]), '/credentials/0/claim/0/path/1'],
    ['an mdoc path with three elements', certificate([mdoc([[MDL_NS, 'age_over_18', 'x']])]), '/credentials/0/claim/0/path'],
  ])('rejects %s', (_name, cert, pointer) => {
    const error = invalid(cert);
    expect(error.issues.map((issue) => issue.pointer)).toContain(pointer);
    expect(error.issues.every((issue) => issue.code === 'MALFORMED_SCOPE' && issue.source === 'scope')).toBe(true);
  });

  it('"claims" instead of the specification\'s "claim" is rejected with a hint, not silently read', () => {
    const cert = certificate([{ format: 'dc+sd-jwt', meta: { vct_values: [AGE_VCT] }, claims: [{ path: ['age_over_18'] }] }]);
    const issue = invalid(cert).issues[0];
    expect(issue?.pointer).toBe('/credentials/0/claims');
    expect(issue?.message).toContain('names this field "claim"');
  });

  it('property: pass iff every requested type and path is declared (union over entries)', () => {
    const TYPES = [AGE_VCT, 'https://example.org/b', 'https://example.org/c'];
    const segment = fc.oneof(fc.constantFrom('a', 'b', 'c'), fc.constantFrom(0, 1), fc.constant(null));
    const pathArb = fc.array(segment, { minLength: 1, maxLength: 3 });
    const entry = fc.record({ types: fc.uniqueArray(fc.constantFrom(...TYPES), { minLength: 1, maxLength: 2 }), paths: fc.array(pathArb, { maxLength: 3 }) });
    fc.assert(
      fc.property(fc.array(entry, { minLength: 1, maxLength: 3 }), fc.uniqueArray(fc.constantFrom(...TYPES), { minLength: 1, maxLength: 2 }), fc.uniqueArray(pathArb, { minLength: 1, maxLength: 3, selector: (p) => JSON.stringify(p) }), (entries, requestedTypes, requestedPaths) => {
        const cert = certificate(entries.map((e) => sdJwt(e.types, e.paths)));
        const declared = new Map<string, Set<string>>();
        for (const e of entries) for (const type of e.types) {
          const set = declared.get(type) ?? new Set<string>();
          for (const p of e.paths) set.add(JSON.stringify(p));
          declared.set(type, set);
        }
        const inScope = requestedTypes.every((type) => declared.has(type) && requestedPaths.every((p) => declared.get(type)?.has(JSON.stringify(p))));
        expect(report(cert, dcql(sdJwtQuery(requestedPaths, requestedTypes))).decision).toBe(inScope ? 'pass' : 'fail');
      }),
      { numRuns: 300 },
    );
  });
});

describe('WRPG-CRT-02: context for a certificate', () => {
  it('no context is needed: the certificate binds the request', () => {
    expect(report(AGE_CERT, AGE_QUERY).findings).toEqual([]);
  });

  it('a matching intendedUseId passes; a different one fails', () => {
    expect(report(AGE_CERT, AGE_QUERY, { intendedUseId: 'age-check' }).decision).toBe('pass');
    const mismatch = report(AGE_CERT, AGE_QUERY, { intendedUseId: 'other' });
    expect(mismatch.findings.map((f) => [f.code, f.ruleId])).toEqual([['WRONG_INTENDED_USE', 'WRPG-CRT-02']]);
  });

  it('an intendedUseId cannot be confirmed when the certificate has no intended_use_id', () => {
    expect(report(withoutId, AGE_QUERY).decision).toBe('pass');
    const unconfirmed = report(withoutId, AGE_QUERY, { intendedUseId: 'age-check' });
    expect(unconfirmed.findings.map((f) => [f.code, f.effect])).toEqual([['MISSING_CONTEXT', 'indeterminate']]);
  });

  it('a serviceId is rejected because certificates have none', () => {
    const error = invalid(AGE_CERT, AGE_QUERY, { serviceId: 'onboarding' });
    expect(error.issues.map((issue) => [issue.code, issue.pointer])).toEqual([['MALFORMED_CONTEXT', '/serviceId']]);
  });
});
