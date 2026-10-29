/**
 * Property-based tests (fast-check). The central property: the decision is `pass` if and only if
 * every requested type and every requested claim path is registered exactly. Any request outside
 * the scope must never pass.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evaluateDcqlScope, evaluateDcqlScopeFromJson, parseJsonStrict } from '@wrpguard/core';
import { AGE_VCT, CONTEXT, fixtureText, makeScope, type Path } from './helpers.js';

const RUNS = { numRuns: 300 };

const segment = fc.oneof(fc.constantFrom('a', 'b', 'c', 'address', 'street'), fc.constantFrom(0, 1), fc.constant(null));
const path = fc.array(segment, { minLength: 1, maxLength: 3 });
const pathKey = (value: Path): string => JSON.stringify(value);
const uniquePaths = (min: number) => fc.uniqueArray(path, { minLength: min, maxLength: 6, selector: pathKey });
const TYPES = [AGE_VCT, 'https://example.org/credentials/b', 'https://example.org/credentials/c'];

describe('no false pass (oracle)', () => {
  it('pass iff all requested types and paths are registered exactly', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...TYPES), { minLength: 1, maxLength: 2 }),
        uniquePaths(1),
        fc.uniqueArray(fc.constantFrom(...TYPES), { minLength: 1, maxLength: 3 }),
        uniquePaths(1),
        (registeredTypes, registeredPaths, requestedTypes, requestedPaths) => {
          const scope = makeScope(registeredTypes.map((type) => ({ format: 'dc+sd-jwt', type, claims: registeredPaths })));
          const dcqlQuery = {
            credentials: [{ id: 'q', format: 'dc+sd-jwt', meta: { vct_values: requestedTypes }, claims: requestedPaths.map((p) => ({ path: p })) }],
          };
          const result = evaluateDcqlScope({ scope, dcqlQuery, context: CONTEXT });
          if (!result.ok) throw new Error('generated inputs should be valid');

          const registeredKeys = new Set(registeredPaths.map(pathKey));
          const inScope =
            requestedTypes.every((type) => registeredTypes.includes(type)) &&
            requestedPaths.every((p) => registeredKeys.has(pathKey(p)));
          expect(result.report.decision).toBe(inScope ? 'pass' : 'fail');
        },
      ),
      RUNS,
    );
  });

  it('adding any unregistered path, in claims or as a claim_sets alternative, never passes', () => {
    fc.assert(
      fc.property(uniquePaths(1), path, fc.boolean(), (registered, extra, viaClaimSets) => {
        fc.pre(!registered.some((p) => pathKey(p) === pathKey(extra)));
        const scope = makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: registered }]);
        const claims = [...registered, extra].map((p, index) => ({ id: `c${String(index)}`, path: p }));
        const query: Record<string, unknown> = { id: 'q', format: 'dc+sd-jwt', meta: { vct_values: [AGE_VCT] }, claims };
        if (viaClaimSets) {
          // The registered-only option comes first; the over-request is a less-preferred alternative.
          query['claim_sets'] = [claims.slice(0, -1).map((c) => c.id), [claims.at(-1)?.id]];
        }
        const result = evaluateDcqlScope({ scope, dcqlQuery: { credentials: [query] }, context: CONTEXT });
        expect(result.ok && result.report.decision).toBe('fail');
      }),
      RUNS,
    );
  });
});

describe('determinism', () => {
  it('key order never changes the report', () => {
    const shuffleKeys = (value: unknown, seed: number): unknown => {
      if (Array.isArray(value)) return value.map((item) => shuffleKeys(item, seed));
      if (typeof value === 'object' && value !== null) {
        const entries = Object.entries(value);
        const rotated = entries.map((_, index) => entries[(index + seed) % entries.length] as [string, unknown]);
        return Object.fromEntries(rotated.map(([key, inner]) => [key, shuffleKeys(inner, seed + 1)]));
      }
      return value;
    };
    fc.assert(
      fc.property(uniquePaths(1), uniquePaths(1), fc.nat(10), (registered, requested, seed) => {
        const scope = makeScope([{ format: 'dc+sd-jwt', type: AGE_VCT, claims: registered }]);
        const dcqlQuery = {
          credentials: [{ id: 'q', format: 'dc+sd-jwt', meta: { vct_values: [AGE_VCT] }, multiple: false, claims: requested.map((p) => ({ path: p })) }],
        };
        const a = evaluateDcqlScope({ scope, dcqlQuery, context: CONTEXT });
        const b = evaluateDcqlScope({ scope: shuffleKeys(scope, seed), dcqlQuery: shuffleKeys(dcqlQuery, seed), context: CONTEXT });
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      }),
      RUNS,
    );
  });
});

describe('robustness', () => {
  const scopeJson = fixtureText('scope.json');

  it('arbitrary JSON values as DCQL or scope never throw', () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 6 }), fc.jsonValue({ maxDepth: 6 }), (dcqlQuery, scope) => {
        const a = evaluateDcqlScope({ scope: JSON.parse(scopeJson) as unknown, dcqlQuery, context: CONTEXT });
        const b = evaluateDcqlScope({ scope, dcqlQuery, context: CONTEXT });
        expect(typeof a.ok).toBe('boolean');
        expect(typeof b.ok).toBe('boolean');
      }),
      RUNS,
    );
  });

  it('arbitrary text never throws', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (text) => {
        const result = evaluateDcqlScopeFromJson({ scopeJson, dcqlQueryJson: text, context: CONTEXT });
        expect(typeof result.ok).toBe('boolean');
      }),
      RUNS,
    );
  });

  it('strict parser agrees with JSON.parse on valid documents', () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 8 }), fc.boolean(), (value, pretty) => {
        // JSON.stringify writes integers >= 1e21 in exponent form, which WRPG-SYN-02 rejects on purpose.
        const replacer = (_key: string, inner: unknown): unknown =>
          typeof inner === 'number' && Number.isInteger(inner) && Math.abs(inner) >= 1e21 ? 1 : inner;
        const text = JSON.stringify(value, replacer, pretty ? 2 : undefined);
        const result = parseJsonStrict(text);
        expect(result.ok).toBe(true);
        if (result.ok) expect(JSON.stringify(result.value)).toBe(JSON.stringify(JSON.parse(text)));
      }),
      { numRuns: 500 },
    );
  });
});
