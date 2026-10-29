/**
 * Scope index and exact matching (ADR-002 WRPG-TYP-01, WRPG-CLM-01).
 *
 * Matching is exact and type-sensitive. A registered descendant path never covers a requested
 * parent path, and `null` (all array elements) is only matched by `null`.
 */
import { pathKey, type ScopeNode } from './parse.js';
import type { ClaimPath, SupportedFormat } from './types.js';

export interface RegisteredCredential {
  /** Canonical keys of registered claims paths. */
  readonly paths: ReadonlySet<string>;
  /** Canonical keys of every strict prefix of a registered path (for explanatory messages only). */
  readonly ancestorPaths: ReadonlySet<string>;
}

export type ScopeIndex = ReadonlyMap<SupportedFormat, ReadonlyMap<string, RegisteredCredential>>;

export function buildScopeIndex(scope: ScopeNode): ScopeIndex {
  const index = new Map<SupportedFormat, Map<string, RegisteredCredential>>();
  for (const credential of scope.credentials) {
    const paths = new Set<string>();
    const ancestorPaths = new Set<string>();
    for (const path of credential.claims) {
      paths.add(pathKey(path));
      for (let length = 1; length < path.length; length++) {
        ancestorPaths.add(pathKey(path.slice(0, length)));
      }
    }
    let byType = index.get(credential.format);
    if (byType === undefined) {
      byType = new Map();
      index.set(credential.format, byType);
    }
    byType.set(credential.type, { paths, ancestorPaths });
  }
  return index;
}

export function lookupCredential(index: ScopeIndex, format: SupportedFormat, type: string): RegisteredCredential | undefined {
  return index.get(format)?.get(type);
}

export type PathMatch = 'registered' | 'unregistered' | 'parent-of-registered';

export function matchPath(registered: RegisteredCredential, path: ClaimPath): PathMatch {
  const key = pathKey(path);
  if (registered.paths.has(key)) return 'registered';
  return registered.ancestorPaths.has(key) ? 'parent-of-registered' : 'unregistered';
}
