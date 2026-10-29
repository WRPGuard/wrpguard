/**
 * Resource limits for untrusted input (ADR-003 §3).
 * Defaults are deliberately small: real DCQL queries and scope declarations are tiny.
 */
export interface Limits {
  /** Maximum UTF-8 byte length of one JSON text. */
  readonly maxInputBytes: number;
  /** Maximum nesting of arrays/objects (root container = depth 1). */
  readonly maxDepth: number;
  /** Maximum number of JSON values in one document. */
  readonly maxNodes: number;
  /** Maximum length (UTF-16 code units) of any string or object key. */
  readonly maxStringLength: number;
  /** Maximum number of elements in any array. */
  readonly maxArrayLength: number;
  /** Maximum number of properties in any object. */
  readonly maxObjectProperties: number;
  readonly maxCredentialQueries: number;
  readonly maxVctValues: number;
  readonly maxClaimsPerCredentialQuery: number;
  readonly maxPathLength: number;
  readonly maxCredentialSets: number;
  readonly maxClaimSets: number;
  readonly maxScopeCredentials: number;
  readonly maxClaimsPerScopeCredential: number;
  /** Cap on input issues listed in an `invalid_input` result. */
  readonly maxReportedIssues: number;
  /** Cap on findings listed in a report; `totalFindings` stays exact. */
  readonly maxReportedFindings: number;
}

export const DEFAULT_LIMITS: Readonly<Limits> = Object.freeze({
  maxInputBytes: 1_048_576,
  maxDepth: 32,
  maxNodes: 50_000,
  maxStringLength: 1_024,
  maxArrayLength: 1_024,
  maxObjectProperties: 256,
  maxCredentialQueries: 32,
  maxVctValues: 8,
  maxClaimsPerCredentialQuery: 128,
  maxPathLength: 16,
  maxCredentialSets: 64,
  maxClaimSets: 64,
  maxScopeCredentials: 256,
  maxClaimsPerScopeCredential: 1_024,
  maxReportedIssues: 100,
  maxReportedFindings: 200,
});

/**
 * Merges caller overrides onto the defaults. Overrides come from trusted caller code, so an
 * invalid override is a programming error and throws instead of producing a result.
 */
export function resolveLimits(overrides?: Partial<Limits>): Limits {
  if (overrides === undefined) return DEFAULT_LIMITS;
  if (typeof overrides !== 'object' || overrides === null) {
    throw new TypeError('options.limits must be an object');
  }
  const merged: Record<string, number> = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(DEFAULT_LIMITS, key)) {
      throw new TypeError(`Unknown limit "${key}"`);
    }
    const value: unknown = (overrides as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`Limit "${key}" must be a positive safe integer`);
    }
    merged[key] = value;
  }
  return Object.freeze(merged as unknown as Limits);
}
