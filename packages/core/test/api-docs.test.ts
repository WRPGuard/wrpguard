/** docs/API.md must document every name exported from the package entry point. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as core from '@wrpguard/core';

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf8');
const apiDoc = read('../../../docs/API.md');

/** Every identifier in the `export { ... }` and `export type { ... }` lists of src/index.ts. */
function exportedNames(): string[] {
  const source = read('../src/index.ts');
  const lists = [...source.matchAll(/export (?:type )?\{([^}]*)\}/g)].map((match) => match[1] ?? '');
  return lists.flatMap((list) => list.split(',').map((name) => name.trim()).filter((name) => name.length > 0));
}

describe('docs/API.md', () => {
  it('the export lists were read', () => {
    expect(exportedNames()).toEqual(expect.arrayContaining(Object.keys(core)));
  });

  it.each(exportedNames())('documents %s', (name) => {
    expect(apiDoc).toMatch(new RegExp(`\\b${name}\\b`));
  });
});
