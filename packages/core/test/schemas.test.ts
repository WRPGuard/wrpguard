/**
 * The published JSON Schemas (packages/core/schemas) must agree with the implementation: the
 * schema accepts every scope the parser accepts, the two reject the same malformed scopes (the
 * one documented exception is a duplicate format + type), and every report or invalid_input
 * report the library produces validates against report-1.
 */
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  INPUT_ERROR_CODES,
  POLICY_VERSION,
  REASON_CODES,
  REPORT_VERSION,
  SCOPE_SCHEMA_VERSION,
  SUPPORTED_FORMATS,
  evaluateDcqlScope,
  evaluateDcqlRegistrationCertificate,
  evaluateDcqlScopeFromJson,
  type EvaluationContext,
  type EvaluationResult,
} from '@wrpguard/core';
import { AGE_VCT, CONTEXT, fixture, fixtureText } from './helpers.js';

type Json = Record<string, unknown>;

const readSchema = (name: string): Json =>
  JSON.parse(readFileSync(new URL(`../schemas/${name}.schema.json`, import.meta.url), 'utf8')) as Json;
const scopeSchema = readSchema('scope-1');
const reportSchema = readSchema('report-1');
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateScope = ajv.compile(scopeSchema);
const validateReport = ajv.compile(reportSchema);

const PASS_QUERY = fixture('request-pass.json');
const REQUEST_FIXTURES = [
  'request-pass.json',
  'request-mdoc-pass.json',
  'request-overask.json',
  'request-claim-sets-overask.json',
  'request-indeterminate.json',
  'request-unsupported-format.json',
  'request-credential-sets-unsupported.json',
  'request-malformed-path.json',
];

/** Parser verdict on a scope: rejected only if an input issue points into the scope. */
function parserAccepts(scope: unknown): { accepted: boolean; messages: string[] } {
  const result = evaluateDcqlScope({ scope, dcqlQuery: PASS_QUERY, context: CONTEXT });
  if (result.ok) return { accepted: true, messages: [] };
  const scopeIssues = result.error.issues.filter((issue) => issue.source === 'scope');
  return { accepted: scopeIssues.length === 0, messages: scopeIssues.map((issue) => issue.message) };
}

function expectValidReport(result: EvaluationResult): void {
  const output = JSON.parse(JSON.stringify(result.ok ? result.report : result.error)) as unknown;
  const valid = validateReport(output);
  expect(valid, JSON.stringify(validateReport.errors)).toBe(true);
}

const freshScope = (): Json => fixture('scope.json') as Json;
const credential = (scope: Json, index: number): Json => (scope['credentials'] as Json[])[index] as Json;

describe('schemas match the exported constants', () => {
  it('versions, formats and codes', () => {
    const scopeProps = scopeSchema['properties'] as Record<string, Json>;
    expect(scopeProps['schemaVersion']).toEqual({ const: SCOPE_SCHEMA_VERSION });
    const defs = scopeSchema['$defs'] as Record<string, Json>;
    expect((defs['credential']?.['properties'] as Record<string, Json>)['format']).toEqual({ enum: [...SUPPORTED_FORMATS] });

    const reportDefs = reportSchema['$defs'] as Record<string, Json>;
    const reportProps = reportDefs['evaluationReport']?.['properties'] as Record<string, Json>;
    expect(reportProps['reportVersion']).toEqual({ const: REPORT_VERSION });
    expect(reportProps['policyVersion']).toEqual({ const: POLICY_VERSION });
    const findingProps = reportDefs['finding']?.['properties'] as Record<string, Json>;
    expect(findingProps['code']).toEqual({ enum: [...REASON_CODES] });
    const issueSchema = (reportDefs['inputErrorReport']?.['properties'] as Record<string, Json>)['issues']?.['items'] as Json;
    expect((issueSchema['properties'] as Record<string, Json>)['code']).toEqual({ enum: [...INPUT_ERROR_CODES] });
  });
});

describe('scope-1 schema agrees with the parser', () => {
  const cases: [string, (scope: Json) => void, boolean][] = [
    ['the fixture scope', () => undefined, true],
    ['a null wildcard path', (s) => { credential(s, 0)['claims'] = [['nationalities', null]]; }, true],
    ['an array index path', (s) => { credential(s, 0)['claims'] = [['degrees', 0, 'type']]; }, true],
    ['a snapshot with both fields', (s) => { s['snapshot'] = { observedAt: 'x', sourceLabel: 'y' }; }, true],
    ['no snapshot', (s) => { delete s['snapshot']; }, true],
    ['an unknown top-level property', (s) => { s['extra'] = 1; }, false],
    ['a missing serviceId', (s) => { delete s['serviceId']; }, false],
    ['an empty relyingPartyId', (s) => { s['relyingPartyId'] = ''; }, false],
    ['a wrong schemaVersion', (s) => { s['schemaVersion'] = 'wrpguard.scope/2'; }, false],
    ['empty credentials', (s) => { s['credentials'] = []; }, false],
    ['an unsupported format', (s) => { credential(s, 0)['format'] = 'jwt_vc_json'; }, false],
    ['an unknown credential property', (s) => { credential(s, 0)['extra'] = true; }, false],
    ['empty claims', (s) => { credential(s, 0)['claims'] = []; }, false],
    ['an empty path', (s) => { credential(s, 0)['claims'] = [[]]; }, false],
    ['an empty claim name', (s) => { credential(s, 0)['claims'] = [['']]; }, false],
    ['a negative index', (s) => { credential(s, 0)['claims'] = [['a', -1]]; }, false],
    ['a fractional index', (s) => { credential(s, 0)['claims'] = [['a', 1.5]]; }, false],
    ['an unsafe integer index', (s) => { credential(s, 0)['claims'] = [['a', 2 ** 53]]; }, false],
    ['an object path element', (s) => { credential(s, 0)['claims'] = [['a', {}]]; }, false],
    ['a duplicate path', (s) => { credential(s, 0)['claims'] = [['a'], ['a']]; }, false],
    ['an mdoc path with three strings', (s) => { credential(s, 1)['claims'] = [['ns', 'el', 'x']]; }, false],
    ['an mdoc path with an index', (s) => { credential(s, 1)['claims'] = [['ns', 0]]; }, false],
    ['a non-string snapshot field', (s) => { s['snapshot'] = { observedAt: 1 }; }, false],
    ['an unknown snapshot property', (s) => { s['snapshot'] = { other: 'x' }; }, false],
  ];

  it.each(cases)('%s', (_name, mutate, expected) => {
    const scope = freshScope();
    mutate(scope);
    expect(parserAccepts(scope).accepted).toBe(expected);
    expect(validateScope(scope), JSON.stringify(validateScope.errors)).toBe(expected);
  });

  it('documented exception: a duplicate format + type passes the schema but not the parser', () => {
    const scope = freshScope();
    (scope['credentials'] as Json[]).push(structuredClone(credential(scope, 0)));
    expect(validateScope(scope)).toBe(true);
    expect(parserAccepts(scope).accepted).toBe(false);
  });

  it('random scopes: parser accepts => schema accepts; otherwise only a duplicate format + type may differ', () => {
    const element = fc.oneof(
      fc.constantFrom('a', 'b', '', 'ns'),
      fc.constant(null),
      fc.integer({ min: -2, max: 3 }),
      fc.constantFrom(1.5, true, {}),
    );
    const path = fc.array(element, { maxLength: 3 });
    const credentialArb = fc.record({
      format: fc.constantFrom('dc+sd-jwt', 'mso_mdoc', 'jwt_vc_json'),
      type: fc.constantFrom('t1', 't2', ''),
      claims: fc.array(path, { maxLength: 3 }),
    });
    const scopeArb = fc.record(
      {
        schemaVersion: fc.constantFrom(SCOPE_SCHEMA_VERSION, 'other'),
        relyingPartyId: fc.constantFrom('rp', ''),
        serviceId: fc.constant('onboarding'),
        intendedUseId: fc.constant('age-check'),
        credentials: fc.array(credentialArb, { maxLength: 3 }),
        extra: fc.constant(1),
      },
      { requiredKeys: ['schemaVersion', 'serviceId', 'intendedUseId', 'credentials'] },
    );
    fc.assert(
      fc.property(scopeArb, (scope) => {
        const parser = parserAccepts(scope);
        const schema = validateScope(scope);
        if (parser.accepted) expect(schema).toBe(true);
        if (schema && !parser.accepted) {
          expect(parser.messages.every((message) => message.startsWith('duplicate entry for format'))).toBe(true);
        }
      }),
      { numRuns: 1000 },
    );
  });
});

describe('report-1 schema matches every report the library produces', () => {
  const contexts: [string, EvaluationContext][] = [
    ['matching context', CONTEXT],
    ['no context', {}],
    ['wrong service and intended use', { serviceId: 'other', intendedUseId: 'other' }],
  ];

  it.each(REQUEST_FIXTURES.flatMap((file) => contexts.map(([name, context]) => [file, name, context] as const)))(
    '%s with %s',
    (file, _name, context) => {
      expectValidReport(evaluateDcqlScopeFromJson({ scopeJson: fixtureText('scope.json'), dcqlQueryJson: fixtureText(file), context }));
    },
  );

  it('invalid_input reports', () => {
    const scopeJson = fixtureText('scope.json');
    const dcqlQueryJson = fixtureText('request-pass.json');
    const results: EvaluationResult[] = [
      evaluateDcqlScopeFromJson({ scopeJson, dcqlQueryJson: '{"credentials": [', context: CONTEXT }),
      evaluateDcqlScopeFromJson({ scopeJson: '{"a":1,"a":2}', dcqlQueryJson, context: CONTEXT }),
      evaluateDcqlScopeFromJson({ scopeJson, dcqlQueryJson, context: { serviceId: '' } }),
      evaluateDcqlScopeFromJson({ scopeJson, dcqlQueryJson, context: CONTEXT }, { limits: { maxInputBytes: 16 } }),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      expectValidReport(result);
    }
  });

  it.each(['registration-cert.json', 'registration-cert.jwt'])('reports from the registration certificate %s', (certFile) => {
    const registrationCertificate = fixtureText(certFile);
    for (const file of REQUEST_FIXTURES) {
      for (const context of [{}, { intendedUseId: 'age-check' }, { intendedUseId: 'other' }, { serviceId: 'onboarding' }]) {
        expectValidReport(evaluateDcqlRegistrationCertificate({ registrationCertificate, dcqlQueryJson: fixtureText(file), context }));
      }
    }
    expectValidReport(evaluateDcqlRegistrationCertificate({ registrationCertificate: 'not a certificate', dcqlQueryJson: '{}' }));
  });

  it('a truncated findings list', () => {
    const claims = Array.from({ length: 30 }, (_, index) => ({ path: [`unregistered_${String(index)}`] }));
    const dcqlQuery = { credentials: [{ id: 'q', format: 'dc+sd-jwt', meta: { vct_values: [AGE_VCT] }, claims }] };
    const result = evaluateDcqlScope({ scope: freshScope(), dcqlQuery, context: CONTEXT }, { limits: { maxReportedFindings: 5 } });
    expect(result.ok && result.report.findingsTruncated).toBe(true);
    expectValidReport(result);
  });
});
