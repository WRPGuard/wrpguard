/**
 * Validation of the three inputs into typed nodes (ADR-002 WRPG-SYN-*, WRPG-SCP-01).
 *
 * Structural violations become input issues (no decision). Unknown DCQL properties are NOT
 * malformed (OpenID4VP 1.0 §6 says implementations MUST ignore them); they are recorded so the
 * evaluator can return `indeterminate` under WRPG-EXT-01.
 */
import { getOwn, isJsonArray, isJsonObject, type JsonObject, type JsonValue } from './json.js';
import type { Limits } from './limits.js';
import { appendPointer, quote } from './text.js';
import {
  SCOPE_SCHEMA_VERSION,
  SUPPORTED_FORMATS,
  type ClaimPath,
  type ClaimPathElement,
  type InputErrorCode,
  type InputIssue,
  type InputSource,
  type SupportedFormat,
} from './types.js';

/** OpenID4VP 1.0 §6.1 / §6.3: non-empty, alphanumeric, underscore or hyphen. */
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface ClaimQueryNode {
  readonly pointer: string;
  readonly id: string | undefined;
  readonly path: ClaimPath;
}

export interface TypeValueNode {
  readonly pointer: string;
  readonly value: string;
}

export interface CredentialQueryNode {
  readonly pointer: string;
  readonly id: string;
  readonly format: string;
  /** Undefined when the format is outside the supported allowlist (WRPG-FMT-01). */
  readonly supportedFormat: SupportedFormat | undefined;
  /** `meta.vct_values` entries, or the single `meta.doctype_value`. Empty when unsupported. */
  readonly types: readonly TypeValueNode[];
  /** Undefined when `claims` is absent (WRPG-CLM-02). */
  readonly claims: readonly ClaimQueryNode[] | undefined;
  /** Pointers to empty options inside `claim_sets` (WRPG-CLM-02). */
  readonly emptyClaimSetOptions: readonly string[];
}

export interface DcqlQueryNode {
  readonly credentials: readonly CredentialQueryNode[];
  /** Pointers to properties policy 0.1 does not model (WRPG-EXT-01). */
  readonly unsupportedProperties: readonly string[];
}

export interface ScopeCredentialNode {
  readonly format: SupportedFormat;
  readonly type: string;
  readonly claims: readonly ClaimPath[];
}

export interface ScopeNode {
  readonly relyingPartyId: string;
  readonly serviceId: string;
  readonly intendedUseId: string;
  readonly credentials: readonly ScopeCredentialNode[];
}

export interface ContextNode {
  readonly serviceId: string | undefined;
  readonly intendedUseId: string | undefined;
}

export interface ParseOutcome<T> {
  readonly node: T | undefined;
  readonly issues: readonly InputIssue[];
}

/** Canonical, type-sensitive key for a claims path: `["a",0,null]` differs from `["a","0",null]`. */
export function pathKey(path: ClaimPath): string {
  return JSON.stringify(path);
}

export class Issues {
  readonly list: InputIssue[] = [];
  constructor(
    private readonly source: InputSource,
    private readonly malformedCode: InputErrorCode,
  ) {}

  malformed(pointer: string, message: string): void {
    this.list.push({ code: this.malformedCode, source: this.source, pointer, message });
  }

  tooLarge(pointer: string, message: string): void {
    this.list.push({ code: 'INPUT_TOO_LARGE', source: this.source, pointer, message });
  }
}

export function isSupportedFormat(format: string): format is SupportedFormat {
  return (SUPPORTED_FORMATS as readonly string[]).includes(format);
}

/**
 * Validates a claims path pointer (OpenID4VP 1.0 §7; mdoc §7.2). Empty-string components and
 * `-0` are rejected by WRPGuard policy (WRPG-SYN-02).
 */
export function parsePath(
  value: JsonValue | undefined,
  pointer: string,
  mdoc: boolean,
  limits: Limits,
  issues: Issues,
): ClaimPath | undefined {
  if (!isJsonArray(value)) {
    issues.malformed(pointer, 'claims path pointer must be an array (OpenID4VP 1.0 §7)');
    return undefined;
  }
  if (value.length === 0) {
    issues.malformed(pointer, 'claims path pointer must be non-empty (OpenID4VP 1.0 §7)');
    return undefined;
  }
  if (value.length > limits.maxPathLength) {
    issues.tooLarge(pointer, `claims path pointer exceeds maxPathLength (${limits.maxPathLength})`);
    return undefined;
  }
  let valid = true;
  const path: ClaimPathElement[] = [];
  value.forEach((element, index) => {
    const elementPointer = appendPointer(pointer, index);
    if (typeof element === 'string') {
      if (element.length === 0) {
        issues.malformed(elementPointer, 'empty claim name in path (WRPGuard policy WRPG-SYN-02)');
        valid = false;
      }
      path.push(element);
    } else if (element === null) {
      path.push(null);
    } else if (typeof element === 'number') {
      if (!Number.isSafeInteger(element) || element < 0 || Object.is(element, -0)) {
        issues.malformed(elementPointer, 'path index must be a non-negative integer (OpenID4VP 1.0 §7)');
        valid = false;
      }
      path.push(element);
    } else {
      issues.malformed(elementPointer, 'path elements must be strings, null or non-negative integers (OpenID4VP 1.0 §7)');
      valid = false;
    }
  });
  if (valid && mdoc && (path.length !== 2 || path.some((element) => typeof element !== 'string'))) {
    issues.malformed(
      pointer,
      'mso_mdoc claims path must be exactly two strings: namespace and data element identifier (OpenID4VP 1.0 §7.2)',
    );
    valid = false;
  }
  return valid ? path : undefined;
}

function checkId(value: JsonValue | undefined, pointer: string, what: string, issues: Issues): string | undefined {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    issues.malformed(pointer, `${what} must be a non-empty string of alphanumeric, "_" or "-" characters`);
    return undefined;
  }
  return value;
}

function checkOptionalBoolean(object: JsonObject, key: string, pointer: string, issues: Issues): void {
  const value = getOwn(object, key);
  if (value !== undefined && typeof value !== 'boolean') {
    issues.malformed(appendPointer(pointer, key), `${key} must be a boolean (OpenID4VP 1.0 §6)`);
  }
}

function collectUnknownKeys(object: JsonObject, known: readonly string[], pointer: string, sink: string[]): void {
  for (const key of Object.keys(object)) {
    if (!known.includes(key)) sink.push(appendPointer(pointer, key));
  }
}

export function nonEmptyString(value: JsonValue | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

// ---------------------------------------------------------------------------------------------
// DCQL query
// ---------------------------------------------------------------------------------------------

const DCQL_TOP_KEYS = ['credentials', 'credential_sets'] as const;
const CREDENTIAL_QUERY_KEYS = [
  'id',
  'format',
  'multiple',
  'meta',
  'trusted_authorities',
  'require_cryptographic_holder_binding',
  'claims',
  'claim_sets',
] as const;
const CLAIM_QUERY_KEYS = ['id', 'path', 'values'] as const;
const MDOC_CLAIM_QUERY_KEYS = [...CLAIM_QUERY_KEYS, 'intent_to_retain'] as const;
const TRUSTED_AUTHORITY_KEYS = ['type', 'values'] as const;
const CREDENTIAL_SET_KEYS = ['options', 'required'] as const;

export function parseDcqlQuery(root: JsonValue, limits: Limits): ParseOutcome<DcqlQueryNode> {
  const issues = new Issues('dcqlQuery', 'MALFORMED_DCQL');
  const unsupported: string[] = [];

  if (!isJsonObject(root)) {
    issues.malformed('', 'DCQL query must be a JSON object (OpenID4VP 1.0 §6)');
    return { node: undefined, issues: issues.list };
  }
  collectUnknownKeys(root, DCQL_TOP_KEYS, '', unsupported);

  const credentialsValue = getOwn(root, 'credentials');
  const credentials: CredentialQueryNode[] = [];
  const ids = new Set<string>();
  if (credentialsValue === undefined) {
    const hint = getOwn(root, 'dcql_query') !== undefined ? '; pass the value of "dcql_query", not the whole request' : '';
    issues.malformed('/credentials', `credentials is REQUIRED (OpenID4VP 1.0 §6)${hint}`);
  } else if (!isJsonArray(credentialsValue) || credentialsValue.length === 0) {
    issues.malformed('/credentials', 'credentials must be a non-empty array (OpenID4VP 1.0 §6)');
  } else if (credentialsValue.length > limits.maxCredentialQueries) {
    issues.tooLarge('/credentials', `credentials exceeds maxCredentialQueries (${limits.maxCredentialQueries})`);
  } else {
    credentialsValue.forEach((value, index) => {
      const pointer = appendPointer('/credentials', index);
      // Collect ids from raw entries so one bad query does not cascade into credential_sets errors.
      const rawId = isJsonObject(value) ? getOwn(value, 'id') : undefined;
      if (typeof rawId === 'string') {
        if (ids.has(rawId)) {
          issues.malformed(appendPointer(pointer, 'id'), `duplicate credential query id ${quote(rawId)} (OpenID4VP 1.0 §6.1)`);
        }
        ids.add(rawId);
      }
      const node = parseCredentialQuery(value, pointer, limits, issues, unsupported);
      if (node !== undefined) credentials.push(node);
    });
  }

  const credentialSets = getOwn(root, 'credential_sets');
  if (credentialSets !== undefined) {
    parseCredentialSets(credentialSets, ids, limits, issues, unsupported);
  }

  if (issues.list.length > 0) return { node: undefined, issues: issues.list };
  return { node: { credentials, unsupportedProperties: unsupported }, issues: [] };
}

function parseCredentialQuery(
  value: JsonValue,
  pointer: string,
  limits: Limits,
  issues: Issues,
  unsupported: string[],
): CredentialQueryNode | undefined {
  if (!isJsonObject(value)) {
    issues.malformed(pointer, 'credential query must be an object (OpenID4VP 1.0 §6.1)');
    return undefined;
  }
  const before = issues.list.length;
  collectUnknownKeys(value, CREDENTIAL_QUERY_KEYS, pointer, unsupported);

  const id = checkId(getOwn(value, 'id'), appendPointer(pointer, 'id'), 'credential query id (OpenID4VP 1.0 §6.1)', issues);

  const formatValue = getOwn(value, 'format');
  let format = '';
  if (typeof formatValue !== 'string') {
    issues.malformed(appendPointer(pointer, 'format'), 'format is REQUIRED and must be a string (OpenID4VP 1.0 §6.1)');
  } else {
    format = formatValue;
  }
  const supportedFormat = isSupportedFormat(format) ? format : undefined;

  checkOptionalBoolean(value, 'multiple', pointer, issues);
  checkOptionalBoolean(value, 'require_cryptographic_holder_binding', pointer, issues);
  parseTrustedAuthorities(getOwn(value, 'trusted_authorities'), appendPointer(pointer, 'trusted_authorities'), issues, unsupported);

  const types = parseMeta(getOwn(value, 'meta'), appendPointer(pointer, 'meta'), supportedFormat, limits, issues, unsupported);
  const claims = parseClaims(value, pointer, supportedFormat, limits, issues, unsupported);
  const emptyClaimSetOptions = parseClaimSets(value, pointer, claims, limits, issues);

  if (issues.list.length > before || id === undefined) return undefined;
  return { pointer, id, format, supportedFormat, types, claims, emptyClaimSetOptions };
}

function parseTrustedAuthorities(value: JsonValue | undefined, pointer: string, issues: Issues, unsupported: string[]): void {
  if (value === undefined) return;
  if (!isJsonArray(value) || value.length === 0) {
    issues.malformed(pointer, 'trusted_authorities must be a non-empty array (OpenID4VP 1.0 §6.1)');
    return;
  }
  value.forEach((entry, index) => {
    const entryPointer = appendPointer(pointer, index);
    if (!isJsonObject(entry)) {
      issues.malformed(entryPointer, 'trusted authorities query must be an object (OpenID4VP 1.0 §6.1.1)');
      return;
    }
    collectUnknownKeys(entry, TRUSTED_AUTHORITY_KEYS, entryPointer, unsupported);
    if (typeof getOwn(entry, 'type') !== 'string') {
      issues.malformed(appendPointer(entryPointer, 'type'), 'type is REQUIRED and must be a string (OpenID4VP 1.0 §6.1.1)');
    }
    const values = getOwn(entry, 'values');
    if (!isJsonArray(values) || values.length === 0 || values.some((item) => typeof item !== 'string')) {
      issues.malformed(appendPointer(entryPointer, 'values'), 'values must be a non-empty array of strings (OpenID4VP 1.0 §6.1.1)');
    }
  });
}

function parseMeta(
  value: JsonValue | undefined,
  pointer: string,
  format: SupportedFormat | undefined,
  limits: Limits,
  issues: Issues,
  unsupported: string[],
): TypeValueNode[] {
  if (!isJsonObject(value)) {
    issues.malformed(pointer, 'meta is REQUIRED and must be an object (OpenID4VP 1.0 §6.1)');
    return [];
  }
  // Metadata of unsupported formats is not modeled; the query is indeterminate anyway.
  if (format === undefined) return [];

  if (format === 'dc+sd-jwt') {
    collectUnknownKeys(value, ['vct_values'], pointer, unsupported);
    const vctPointer = appendPointer(pointer, 'vct_values');
    const vctValues = getOwn(value, 'vct_values');
    if (!isJsonArray(vctValues) || vctValues.length === 0) {
      issues.malformed(vctPointer, 'vct_values is REQUIRED and must be a non-empty array (OpenID4VP 1.0 Appendix B.3.5)');
      return [];
    }
    if (vctValues.length > limits.maxVctValues) {
      issues.tooLarge(vctPointer, `vct_values exceeds maxVctValues (${limits.maxVctValues})`);
      return [];
    }
    const types: TypeValueNode[] = [];
    vctValues.forEach((vct, index) => {
      const vctItemPointer = appendPointer(vctPointer, index);
      if (!nonEmptyString(vct)) {
        issues.malformed(vctItemPointer, 'vct_values entries must be non-empty strings (OpenID4VP 1.0 Appendix B.3.5)');
      } else {
        types.push({ pointer: vctItemPointer, value: vct });
      }
    });
    return types;
  }

  collectUnknownKeys(value, ['doctype_value'], pointer, unsupported);
  const doctypePointer = appendPointer(pointer, 'doctype_value');
  const doctype = getOwn(value, 'doctype_value');
  if (!nonEmptyString(doctype)) {
    issues.malformed(doctypePointer, 'doctype_value is REQUIRED and must be a non-empty string (OpenID4VP 1.0 Appendix B.2.3)');
    return [];
  }
  return [{ pointer: doctypePointer, value: doctype }];
}

function parseClaims(
  query: JsonObject,
  queryPointer: string,
  format: SupportedFormat | undefined,
  limits: Limits,
  issues: Issues,
  unsupported: string[],
): ClaimQueryNode[] | undefined {
  const value = getOwn(query, 'claims');
  if (value === undefined) return undefined;
  const pointer = appendPointer(queryPointer, 'claims');
  if (!isJsonArray(value) || value.length === 0) {
    issues.malformed(pointer, 'claims must be a non-empty array when present (OpenID4VP 1.0 §6.1)');
    return [];
  }
  if (value.length > limits.maxClaimsPerCredentialQuery) {
    issues.tooLarge(pointer, `claims exceeds maxClaimsPerCredentialQuery (${limits.maxClaimsPerCredentialQuery})`);
    return [];
  }
  const mdoc = format === 'mso_mdoc';
  const claimSetsPresent = getOwn(query, 'claim_sets') !== undefined;
  const ids = new Set<string>();
  const paths = new Set<string>();
  const claims: ClaimQueryNode[] = [];

  value.forEach((entry, index) => {
    const entryPointer = appendPointer(pointer, index);
    if (!isJsonObject(entry)) {
      issues.malformed(entryPointer, 'claims query must be an object (OpenID4VP 1.0 §6.3)');
      return;
    }
    collectUnknownKeys(entry, mdoc ? MDOC_CLAIM_QUERY_KEYS : CLAIM_QUERY_KEYS, entryPointer, unsupported);

    const idValue = getOwn(entry, 'id');
    let id: string | undefined;
    if (idValue !== undefined) {
      id = checkId(idValue, appendPointer(entryPointer, 'id'), 'claims query id (OpenID4VP 1.0 §6.3)', issues);
      if (id !== undefined) {
        if (ids.has(id)) {
          issues.malformed(appendPointer(entryPointer, 'id'), `duplicate claims query id ${quote(id)} (OpenID4VP 1.0 §6.3)`);
        }
        ids.add(id);
      }
    } else if (claimSetsPresent) {
      issues.malformed(appendPointer(entryPointer, 'id'), 'claims query id is REQUIRED when claim_sets is present (OpenID4VP 1.0 §6.3)');
    }

    const pathPointer = appendPointer(entryPointer, 'path');
    const path = parsePath(getOwn(entry, 'path'), pathPointer, mdoc, limits, issues);
    if (path !== undefined) {
      const key = pathKey(path);
      if (paths.has(key)) {
        issues.malformed(pathPointer, 'the same claim path appears twice; Verifiers MUST NOT point to the same claim more than once (OpenID4VP 1.0 §6.1)');
      }
      paths.add(key);
    }

    const values = getOwn(entry, 'values');
    if (values !== undefined) {
      // Never echo the values themselves (WRPG-VAL-01).
      const valid =
        isJsonArray(values) &&
        values.length > 0 &&
        values.every((item) => typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isInteger(item)));
      if (!valid) {
        issues.malformed(appendPointer(entryPointer, 'values'), 'values must be a non-empty array of strings, integers or booleans (OpenID4VP 1.0 §6.3)');
      }
    }
    if (mdoc) checkOptionalBoolean(entry, 'intent_to_retain', entryPointer, issues);

    if (path !== undefined) claims.push({ pointer: entryPointer, id, path });
  });
  return claims;
}

function parseClaimSets(
  query: JsonObject,
  queryPointer: string,
  claims: readonly ClaimQueryNode[] | undefined,
  limits: Limits,
  issues: Issues,
): string[] {
  const value = getOwn(query, 'claim_sets');
  if (value === undefined) return [];
  const pointer = appendPointer(queryPointer, 'claim_sets');
  if (claims === undefined) {
    issues.malformed(pointer, 'claim_sets MUST NOT be present if claims is absent (OpenID4VP 1.0 §6.4.1)');
    return [];
  }
  if (!isJsonArray(value) || value.length === 0) {
    issues.malformed(pointer, 'claim_sets must be a non-empty array (OpenID4VP 1.0 §6.1)');
    return [];
  }
  if (value.length > limits.maxClaimSets) {
    issues.tooLarge(pointer, `claim_sets exceeds maxClaimSets (${limits.maxClaimSets})`);
    return [];
  }
  const claimIds = new Set(claims.flatMap((claim) => (claim.id === undefined ? [] : [claim.id])));
  const empty: string[] = [];
  value.forEach((option, index) => {
    const optionPointer = appendPointer(pointer, index);
    if (!isJsonArray(option)) {
      issues.malformed(optionPointer, 'each claim_sets option must be an array of claims query ids (OpenID4VP 1.0 §6.1)');
      return;
    }
    if (option.length === 0) empty.push(optionPointer);
    option.forEach((reference, referenceIndex) => {
      const referencePointer = appendPointer(optionPointer, referenceIndex);
      if (typeof reference !== 'string') {
        issues.malformed(referencePointer, 'claim_sets entries must be claims query id strings (OpenID4VP 1.0 §6.1)');
      } else if (!claimIds.has(reference)) {
        issues.malformed(referencePointer, `claim_sets references unknown claims query id ${quote(reference)} (OpenID4VP 1.0 §6.1)`);
      }
    });
  });
  return empty;
}

function parseCredentialSets(
  value: JsonValue,
  credentialIds: ReadonlySet<string>,
  limits: Limits,
  issues: Issues,
  unsupported: string[],
): void {
  const pointer = '/credential_sets';
  if (!isJsonArray(value) || value.length === 0) {
    issues.malformed(pointer, 'credential_sets must be a non-empty array (OpenID4VP 1.0 §6)');
    return;
  }
  if (value.length > limits.maxCredentialSets) {
    issues.tooLarge(pointer, `credential_sets exceeds maxCredentialSets (${limits.maxCredentialSets})`);
    return;
  }
  value.forEach((set, index) => {
    const setPointer = appendPointer(pointer, index);
    if (!isJsonObject(set)) {
      issues.malformed(setPointer, 'credential set query must be an object (OpenID4VP 1.0 §6.2)');
      return;
    }
    collectUnknownKeys(set, CREDENTIAL_SET_KEYS, setPointer, unsupported);
    checkOptionalBoolean(set, 'required', setPointer, issues);
    const optionsPointer = appendPointer(setPointer, 'options');
    const options = getOwn(set, 'options');
    if (!isJsonArray(options) || options.length === 0) {
      issues.malformed(optionsPointer, 'options is REQUIRED and must be a non-empty array (OpenID4VP 1.0 §6.2)');
      return;
    }
    options.forEach((option, optionIndex) => {
      const optionPointer = appendPointer(optionsPointer, optionIndex);
      if (!isJsonArray(option) || option.length === 0) {
        issues.malformed(optionPointer, 'each option must be a non-empty array of credential query ids (OpenID4VP 1.0 §6.2)');
        return;
      }
      option.forEach((reference, referenceIndex) => {
        const referencePointer = appendPointer(optionPointer, referenceIndex);
        if (typeof reference !== 'string') {
          issues.malformed(referencePointer, 'options entries must be credential query id strings (OpenID4VP 1.0 §6.2)');
        } else if (!credentialIds.has(reference)) {
          issues.malformed(referencePointer, `options references unknown credential query id ${quote(reference)} (OpenID4VP 1.0 §6.2)`);
        }
      });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Scope declaration (wrpguard.scope/1 — WRPGuard's own closed schema, not an EUDI schema)
// ---------------------------------------------------------------------------------------------

const SCOPE_KEYS = ['schemaVersion', 'relyingPartyId', 'serviceId', 'intendedUseId', 'credentials', 'snapshot'] as const;
const SCOPE_CREDENTIAL_KEYS = ['format', 'type', 'claims'] as const;
const SCOPE_SNAPSHOT_KEYS = ['observedAt', 'sourceLabel'] as const;

export function parseScope(root: JsonValue, limits: Limits): ParseOutcome<ScopeNode> {
  const issues = new Issues('scope', 'MALFORMED_SCOPE');
  if (!isJsonObject(root)) {
    issues.malformed('', 'scope must be a JSON object');
    return { node: undefined, issues: issues.list };
  }
  rejectUnknownKeys(root, SCOPE_KEYS, '', issues);

  if (getOwn(root, 'schemaVersion') !== SCOPE_SCHEMA_VERSION) {
    issues.malformed('/schemaVersion', `schemaVersion must be ${quote(SCOPE_SCHEMA_VERSION)}`);
  }
  const relyingPartyId = requireString(root, 'relyingPartyId', '', issues);
  const serviceId = requireString(root, 'serviceId', '', issues);
  const intendedUseId = requireString(root, 'intendedUseId', '', issues);

  const credentials: ScopeCredentialNode[] = [];
  const credentialsValue = getOwn(root, 'credentials');
  if (!isJsonArray(credentialsValue) || credentialsValue.length === 0) {
    issues.malformed('/credentials', 'credentials must be a non-empty array');
  } else if (credentialsValue.length > limits.maxScopeCredentials) {
    issues.tooLarge('/credentials', `credentials exceeds maxScopeCredentials (${limits.maxScopeCredentials})`);
  } else {
    const seen = new Set<string>();
    credentialsValue.forEach((value, index) => {
      const pointer = appendPointer('/credentials', index);
      const node = parseScopeCredential(value, pointer, limits, issues);
      if (node === undefined) return;
      const key = JSON.stringify([node.format, node.type]);
      if (seen.has(key)) {
        issues.malformed(appendPointer(pointer, 'type'), `duplicate entry for format ${quote(node.format)} and type ${quote(node.type)}`);
      }
      seen.add(key);
      credentials.push(node);
    });
  }

  const snapshot = getOwn(root, 'snapshot');
  if (snapshot !== undefined) {
    if (!isJsonObject(snapshot)) {
      issues.malformed('/snapshot', 'snapshot must be an object');
    } else {
      rejectUnknownKeys(snapshot, SCOPE_SNAPSHOT_KEYS, '/snapshot', issues);
      for (const key of SCOPE_SNAPSHOT_KEYS) {
        const value = getOwn(snapshot, key);
        if (value !== undefined && typeof value !== 'string') {
          issues.malformed(appendPointer('/snapshot', key), `${key} must be a string`);
        }
      }
    }
  }

  if (issues.list.length > 0 || relyingPartyId === undefined || serviceId === undefined || intendedUseId === undefined) {
    return { node: undefined, issues: issues.list };
  }
  return { node: { relyingPartyId, serviceId, intendedUseId, credentials }, issues: [] };
}

function parseScopeCredential(value: JsonValue, pointer: string, limits: Limits, issues: Issues): ScopeCredentialNode | undefined {
  if (!isJsonObject(value)) {
    issues.malformed(pointer, 'scope credential must be an object');
    return undefined;
  }
  const before = issues.list.length;
  rejectUnknownKeys(value, SCOPE_CREDENTIAL_KEYS, pointer, issues);

  const formatValue = getOwn(value, 'format');
  const format = typeof formatValue === 'string' && isSupportedFormat(formatValue) ? formatValue : undefined;
  if (format === undefined) {
    issues.malformed(appendPointer(pointer, 'format'), `format must be one of ${SUPPORTED_FORMATS.map((f) => quote(f)).join(', ')}`);
  }
  const type = requireString(value, 'type', pointer, issues);

  const claims: ClaimPath[] = [];
  const claimsPointer = appendPointer(pointer, 'claims');
  const claimsValue = getOwn(value, 'claims');
  if (!isJsonArray(claimsValue) || claimsValue.length === 0) {
    issues.malformed(claimsPointer, 'claims must be a non-empty array of claims path pointers');
  } else if (claimsValue.length > limits.maxClaimsPerScopeCredential) {
    issues.tooLarge(claimsPointer, `claims exceeds maxClaimsPerScopeCredential (${limits.maxClaimsPerScopeCredential})`);
  } else {
    const seen = new Set<string>();
    claimsValue.forEach((entry, index) => {
      const entryPointer = appendPointer(claimsPointer, index);
      const path = parsePath(entry, entryPointer, format === 'mso_mdoc', limits, issues);
      if (path === undefined) return;
      const key = pathKey(path);
      if (seen.has(key)) issues.malformed(entryPointer, 'duplicate claims path');
      seen.add(key);
      claims.push(path);
    });
  }

  if (issues.list.length > before || format === undefined || type === undefined) return undefined;
  return { format, type, claims };
}

function rejectUnknownKeys(object: JsonObject, known: readonly string[], pointer: string, issues: Issues): void {
  const unknown: string[] = [];
  collectUnknownKeys(object, known, pointer, unknown);
  for (const unknownPointer of unknown) issues.malformed(unknownPointer, 'unknown property (closed schema)');
}

function requireString(object: JsonObject, key: string, pointer: string, issues: Issues): string | undefined {
  const value = getOwn(object, key);
  if (!nonEmptyString(value)) {
    issues.malformed(appendPointer(pointer, key), `${key} must be a non-empty string`);
    return undefined;
  }
  return value;
}

// ---------------------------------------------------------------------------------------------
// Evaluation context
// ---------------------------------------------------------------------------------------------

const CONTEXT_KEYS = ['serviceId', 'intendedUseId'] as const;

export function parseContext(root: JsonValue): ParseOutcome<ContextNode> {
  const issues = new Issues('context', 'MALFORMED_CONTEXT');
  if (!isJsonObject(root)) {
    issues.malformed('', 'context must be an object');
    return { node: undefined, issues: issues.list };
  }
  rejectUnknownKeys(root, CONTEXT_KEYS, '', issues);
  const read = (key: string): string | undefined => {
    const value = getOwn(root, key);
    if (value === undefined) return undefined;
    if (!nonEmptyString(value)) {
      issues.malformed(appendPointer('', key), `${key} must be a non-empty string when provided`);
      return undefined;
    }
    return value;
  };
  const serviceId = read('serviceId');
  const intendedUseId = read('intendedUseId');
  if (issues.list.length > 0) return { node: undefined, issues: issues.list };
  return { node: { serviceId, intendedUseId }, issues: [] };
}
