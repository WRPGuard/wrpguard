/** ADR-003 §1–§2: strict parser and value snapshot. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, evaluateDcqlScopeFromJson, parseJsonStrict } from '@wrpguard/core';
import { snapshotValue } from '../src/json.js';
import { CONTEXT, fixture, fixtureText } from './helpers.js';

function parseOk(text: string): unknown {
  const result = parseJsonStrict(text);
  if (!result.ok) throw new Error(`unexpected parse failure: ${result.error.message}`);
  return result.value;
}

function parseError(text: string, limits?: Parameters<typeof parseJsonStrict>[1]) {
  const result = parseJsonStrict(text, limits);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  return result.error;
}

describe('parseJsonStrict: grammar', () => {
  it('parses all JSON value kinds like JSON.parse', () => {
    const text = ' {"a":[1,-2.5e-3,0.25,1E-7,true,false,null,"x\\n\\u00e9\\ud83d\\ude00"],"b":{},"c":[]} ';
    expect(JSON.stringify(parseOk(text))).toBe(JSON.stringify(JSON.parse(text)));
  });

  it('accepts one leading BOM only', () => {
    const bom = String.fromCharCode(0xfeff);
    expect(parseOk(`${bom}{"a":1}`)).toEqual({ a: 1 });
    expect(parseError(`${bom}${bom}{"a":1}`).code).toBe('INVALID_JSON');
  });

  const invalid: [string, string][] = [
    ['empty input', ''],
    ['whitespace only', '   '],
    ['trailing comma in array', '[1,]'],
    ['trailing comma in object', '{"a":1,}'],
    ['leading zero', '[01]'],
    ['plus sign', '[+1]'],
    ['bare decimal point', '[.5]'],
    ['NaN literal', '[NaN]'],
    ['single quotes', "{'a':1}"],
    ['unquoted key', '{a:1}'],
    ['comment', '{"a":1 /* c */}'],
    ['raw control character in string', '["a\u0001"]'],
    ['raw newline in string', '["a\nb"]'],
    ['invalid escape', '["\\x41"]'],
    ['short unicode escape', '["\\u12"]'],
    ['unterminated string', '["abc'],
    ['unterminated array', '[1,2'],
    ['trailing data', '{"a":1} {"b":2}'],
    ['mismatched bracket', '[1}'],
    ['truncated literal', '[tru]'],
    ['non-finite number', '[1e400]'],
    ['missing colon', '{"a" 1}'],
    ['missing comma', '[1 2]'],
  ];
  for (const [label, text] of invalid) {
    it(`rejects ${label}`, () => {
      expect(parseError(text).code).toBe('INVALID_JSON');
    });
  }

  // Reviewer finding F1: these become integers as doubles, but exact-decimal parsers disagree.
  for (const lexeme of ['0.99999999999999999999', '1.0', '1e0', '1E2', '10e-1', '1e-400', '0.0', '-0.0', '2.9999999999999999999', '1e21']) {
    it(`rejects integral number written with fraction or exponent: ${lexeme}`, () => {
      expect(parseError(`[${lexeme}]`).message).toContain('WRPG-SYN-02');
    });
  }

  it('accepts genuinely fractional numbers', () => {
    expect(parseOk('[1.5,2.5e-3,1E-7,-0.25]')).toEqual([1.5, 0.0025, 1e-7, -0.25]);
  });

  it('accepts lone surrogate escapes exactly like JSON.parse', () => {
    expect(parseOk('["\\ud800"]')).toEqual(JSON.parse('["\\ud800"]'));
  });
});

describe('parseJsonStrict: duplicate keys (parser-differential false-pass defense)', () => {
  it('rejects duplicate keys', () => {
    const error = parseError('{"claims":[1],"claims":[2]}');
    expect(error.code).toBe('INVALID_JSON');
    expect(error.message).toContain('duplicate object key');
  });

  it('rejects duplicates that differ only by escaping', () => {
    expect(parseError('{"claims":1,"cl\\u0061ims":2}').message).toContain('duplicate');
  });

  it('reports the pointer of the object holding the duplicate', () => {
    expect(parseError('{"credentials":[{"id":"a","id":"b"}]}').pointer).toBe('/credentials/0');
  });

  it('allows the same key in different objects', () => {
    expect(parseOk('[{"a":1},{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('a duplicate "claims" key cannot smuggle an over-request past evaluation', () => {
    const text =
      '{"credentials":[{"id":"age","format":"dc+sd-jwt","meta":{"vct_values":["https://example.org/credentials/age-attestation"]},' +
      '"claims":[{"path":["birth_date"]}],"claims":[{"path":["age_over_18"]}]}]}';
    // JSON.parse is last-wins and would show only the registered claim; a first-wins parser would see birth_date.
    expect(JSON.parse(text)).toMatchObject({ credentials: [{ claims: [{ path: ['age_over_18'] }] }] });
    const result = evaluateDcqlScopeFromJson({ scopeJson: fixtureText('scope.json'), dcqlQueryJson: text, context: CONTEXT });
    expect(result).toMatchObject({ ok: false, error: { issues: [{ code: 'MALFORMED_DCQL', pointer: '/credentials/0' }] } });
  });
});

describe('parseJsonStrict: limits', () => {
  it('enforces maxDepth without recursion', () => {
    expect(parseError('['.repeat(33) + ']'.repeat(33)).code).toBe('INPUT_TOO_LARGE');
    expect(parseOk('['.repeat(32) + ']'.repeat(32))).toBeDefined();
    expect(parseError('['.repeat(200_000)).code).toBe('INPUT_TOO_LARGE');
  });

  it('enforces maxInputBytes in UTF-8 bytes, not code units', () => {
    const euro = String.fromCharCode(0x20ac); // 3 bytes in UTF-8
    const text = `"${euro.repeat(400)}"`; // 1202 bytes, 402 code units
    expect(parseError(text, { maxInputBytes: 1000 }).code).toBe('INPUT_TOO_LARGE');
    expect(parseJsonStrict(text, { maxInputBytes: 1300 }).ok).toBe(true);
  });

  it('enforces maxNodes, maxStringLength, maxArrayLength and maxObjectProperties', () => {
    expect(parseError(`[${'0,'.repeat(20)}0]`, { maxNodes: 10 }).code).toBe('INPUT_TOO_LARGE');
    expect(parseError(`["${'a'.repeat(DEFAULT_LIMITS.maxStringLength + 1)}"]`).code).toBe('INPUT_TOO_LARGE');
    expect(parseError(`{"${'k'.repeat(DEFAULT_LIMITS.maxStringLength + 1)}":1}`).code).toBe('INPUT_TOO_LARGE');
    expect(parseError(`[${Array.from({ length: 1025 }, () => '0').join(',')}]`).code).toBe('INPUT_TOO_LARGE');
    const props = Array.from({ length: 257 }, (_, i) => `"k${String(i)}":0`).join(',');
    expect(parseError(`{${props}}`).code).toBe('INPUT_TOO_LARGE');
  });

  it('rejects invalid limit overrides as programming errors', () => {
    expect(() => parseJsonStrict('1', { maxDepth: 0 })).toThrow(TypeError);
    expect(() => parseJsonStrict('1', { maxDepth: 1.5 })).toThrow(TypeError);
    expect(() => parseJsonStrict('1', { notALimit: 1 } as never)).toThrow(TypeError);
  });
});

describe('parseJsonStrict: prototype safety', () => {
  it('creates null-prototype objects with "__proto__" as plain data', () => {
    const value = parseOk('{"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}}}') as Record<string, unknown>;
    expect(Object.getPrototypeOf(value)).toBeNull();
    expect(Object.hasOwn(value, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('snapshotValue: caller-provided JS values', () => {
  const snap = (value: unknown) => snapshotValue(value, DEFAULT_LIMITS);

  it('accepts plain and null-prototype objects', () => {
    const nullProto = Object.assign(Object.create(null) as object, { a: [1, 'x', null, true] });
    expect(snap(nullProto)).toMatchObject({ ok: true, value: { a: [1, 'x', null, true] } });
  });

  it('omits undefined object properties like JSON.stringify', () => {
    expect(snap({ a: 1, b: undefined })).toEqual({ ok: true, value: Object.assign(Object.create(null) as object, { a: 1 }) });
  });

  it('rejects getters without invoking them', () => {
    let invoked = false;
    const value = {
      get claims() {
        invoked = true;
        return [];
      },
    };
    expect(snap(value).ok).toBe(false);
    expect(invoked).toBe(false);
  });

  const rejectedValues: [string, unknown][] = [
    ['function', { f: () => 1 }],
    ['toJSON method', { toJSON: () => ({}) }],
    ['bigint', { n: 1n }],
    ['symbol value', { s: Symbol('x') }],
    ['NaN', [Number.NaN]],
    ['Infinity', [Number.POSITIVE_INFINITY]],
    ['Date', { d: new Date(0) }],
    ['Map', new Map()],
    ['class instance', new (class Thing {})()],
    ['boxed string', [new String('x')]],
    ['sparse array', [1, , 3]], // eslint-disable-line no-sparse-arrays
    ['undefined array element', [undefined]],
    ['array subclass', new (class MyArray extends Array {})()],
  ];
  for (const [label, value] of rejectedValues) {
    it(`rejects ${label}`, () => {
      expect(snap(value).ok).toBe(false);
    });
  }

  // Reviewer finding F2: JSON.stringify would send what toJSON returns, not what was evaluated.
  it('rejects toJSON on an array (own, non-index property)', () => {
    const claims: unknown[] = [{ path: ['age_over_18'] }];
    (claims as unknown as Record<string, unknown>)['toJSON'] = () => [{ path: ['birth_date'] }];
    expect(snap({ claims })).toMatchObject({ ok: false, error: { pointer: '/claims' } });
  });

  it('rejects a non-enumerable toJSON on a plain object', () => {
    const value = { a: 1 };
    Object.defineProperty(value, 'toJSON', { value: () => ({ a: 2 }), enumerable: false });
    expect(snap(value).ok).toBe(false);
  });

  it('rejects toJSON inherited through polluted Array.prototype or Object.prototype', () => {
    for (const prototype of [Array.prototype, Object.prototype] as object[]) {
      Object.defineProperty(prototype, 'toJSON', { value: () => 'swapped', configurable: true, writable: true });
      try {
        expect(snap({ list: [1] }).ok).toBe(false);
      } finally {
        delete (prototype as Record<string, unknown>)['toJSON'];
      }
    }
    expect(snap({ list: [1] }).ok).toBe(true);
  });

  it('bounds cycles and depth', () => {
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(snap(cyclic)).toMatchObject({ ok: false, error: { code: 'INPUT_TOO_LARGE' } });
  });

  it('copies data so later caller mutation cannot change the evaluated input', () => {
    const request = fixture('request-pass.json') as { credentials: { claims: unknown[] }[] };
    const result = snap(request);
    request.credentials[0]?.claims.push({ path: ['birth_date'] });
    expect(JSON.stringify(result)).not.toContain('birth_date');
  });
});
