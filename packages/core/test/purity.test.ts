/** ADR-003 §6: @wrpguard/core performs no I/O and has no non-deterministic inputs. */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluate, fixture } from './helpers.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
// Comments are stripped so that documentation (e.g. "Date, Map are rejected") does not trip the scan.
const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const sources = readdirSync(SRC)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => ({ name, text: stripComments(readFileSync(SRC + name, 'utf8')) }));

describe('static purity scan of packages/core/src', () => {
  it('finds the source files', () => {
    expect(sources.map((s) => s.name)).toEqual(
      expect.arrayContaining(['evaluate.ts', 'index.ts', 'json.ts', 'limits.ts', 'match.ts', 'parse.ts', 'text.ts', 'types.ts']),
    );
  });

  const forbidden: [string, RegExp][] = [
    ['non-relative import', /\bfrom\s+['"](?!\.\/)/],
    ['dynamic import', /\bimport\s*\(/],
    ['require', /\brequire\s*\(/],
    ['fetch', /\bfetch\s*\(/],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['WebSocket', /\bWebSocket\b/],
    ['process', /\bprocess\./],
    ['Date', /\bDate\b/],
    ['Math.random', /\bMath\.random\b/],
    ['timers', /\bset(Timeout|Interval|Immediate)\s*\(/],
    ['eval', /\beval\s*\(|\bnew Function\s*\(/],
  ];
  for (const [label, pattern] of forbidden) {
    it(`contains no ${label}`, () => {
      const offenders = sources.filter((source) => pattern.test(source.text)).map((source) => source.name);
      expect(offenders).toEqual([]);
    });
  }
});

describe('runtime: no network access during evaluation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('evaluates with networking globals replaced by throwing stubs', () => {
    const trap = vi.fn(() => {
      throw new Error('network access attempted');
    });
    vi.stubGlobal('fetch', trap);
    vi.stubGlobal('XMLHttpRequest', trap);
    vi.stubGlobal('WebSocket', trap);
    expect(evaluate(fixture('request-overask.json')).decision).toBe('fail');
    expect(evaluate(fixture('request-pass.json')).decision).toBe('pass');
    expect(trap).not.toHaveBeenCalled();
  });
});
