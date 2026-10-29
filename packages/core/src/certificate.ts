/**
 * ETSI TS 119 475 V1.2.1 wallet-relying party registration certificates (WRPRCs) as the scope
 * declaration (ADR-002 WRPG-CRT-01). Accepts the compact JWT (`typ: rc-wrp+jwt`, GEN-5.2.2-01),
 * the base64url-encoded JWT carried in a verifier_info "registration_cert" element (ETSI TS 119
 * 472-2 RO-16), or the decoded JSON payload. The signature, certificate chain, status and validity period are
 * NOT checked: like a wrpguard.scope/1 file, the certificate is a caller-supplied, unverified
 * declaration. CWT certificates (`rc-wrp+cwt`) are not supported.
 */
import { getOwn, isJsonArray, isJsonObject, parseJsonStrict, type JsonObject, type JsonParseResult, type JsonValue } from './json.js';
import type { Limits } from './limits.js';
import { Issues, isSupportedFormat, nonEmptyString, parsePath, pathKey, type ParseOutcome, type ScopeNode } from './parse.js';
import { appendPointer, quote, utf8ByteLengthExceeds } from './text.js';
import type { ClaimPath, InputIssue, SupportedFormat } from './types.js';

const JWT_TYPE = 'rc-wrp+jwt';
const BOM = String.fromCharCode(0xfeff);
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CREDENTIAL_KEYS = ['format', 'meta', 'claim'];
const CLAIM_KEYS = ['path', 'values'];
const SPEC = 'ETSI TS 119 475 V1.2.1';

export interface DecodedCertificate {
  readonly payload: JsonValue | undefined;
  readonly issues: readonly InputIssue[];
}

/** Turns the certificate text (compact JWT or JSON payload) into its payload, without verifying anything. */
export function decodeRegistrationCertificate(text: string, limits: Limits): DecodedCertificate {
  const issues = new Issues('scope', 'MALFORMED_SCOPE');
  const malformed = (message: string): DecodedCertificate => {
    issues.malformed('', `registration certificate: ${message}`);
    return { payload: undefined, issues: issues.list };
  };
  if (utf8ByteLengthExceeds(text, limits.maxInputBytes)) {
    issues.tooLarge('', `registration certificate exceeds maxInputBytes (${limits.maxInputBytes})`);
    return { payload: undefined, issues: issues.list };
  }

  let trimmed = (text.startsWith(BOM) ? text.slice(1) : text).trim();
  if (trimmed.startsWith('{')) return fromJson(parseJsonStrict(text, limits), 'payload', issues);

  // A verifier_info "registration_cert" element carries the base64url encoding of the serialized
  // certificate (ETSI TS 119 472-2 OIDFVP-HAIP-COMMON-REQ-RO-16): unwrap it once.
  if (!trimmed.includes('.') && BASE64URL.test(trimmed)) {
    const inner = decodeBase64UrlUtf8(trimmed)?.trim();
    if (inner === undefined || inner.split('.').length !== 3) {
      return malformed(
        'a single base64url value must encode a compact JWT, as in a verifier_info "registration_cert" element (ETSI TS 119 472-2 RO-16); CWT certificates ("rc-wrp+cwt") are not supported',
      );
    }
    trimmed = inner;
  }

  const segments = trimmed.split('.');
  const [headerPart, payloadPart] = segments;
  if (segments.length !== 3 || !segments.every((segment) => BASE64URL.test(segment)) || headerPart === undefined || payloadPart === undefined) {
    return malformed(`expected a compact JWT (typ "${JWT_TYPE}") or its decoded JSON payload; CWT certificates ("rc-wrp+cwt") are not supported`);
  }
  const header = decodeBase64UrlUtf8(headerPart);
  if (header === undefined) return malformed('the JWT header is not valid base64url-encoded UTF-8');
  const headerJson = parseJsonStrict(header, limits);
  if (!headerJson.ok) return malformed(`the JWT header is not valid JSON (${headerJson.error.message})`);
  const typ = isJsonObject(headerJson.value) ? getOwn(headerJson.value, 'typ') : undefined;
  if (typeof typ !== 'string' || typ.toLowerCase() !== JWT_TYPE) {
    return malformed(`the JWT header typ must be "${JWT_TYPE}" (${SPEC} GEN-5.2.2-01)`);
  }
  const payload = decodeBase64UrlUtf8(payloadPart);
  if (payload === undefined) return malformed('the JWT payload is not valid base64url-encoded UTF-8');
  return fromJson(parseJsonStrict(payload, limits), 'JWT payload', issues);
}

function fromJson(result: JsonParseResult, label: string, issues: Issues): DecodedCertificate {
  if (result.ok) return { payload: result.value, issues: issues.list };
  const message = `registration certificate ${label}: ${result.error.message}`;
  if (result.error.code === 'INPUT_TOO_LARGE') issues.tooLarge(result.error.pointer, message);
  else issues.malformed(result.error.pointer, message);
  return { payload: undefined, issues: issues.list };
}

/**
 * Strict unpadded base64url (RFC 7515 §2) to a UTF-8 string. Invalid UTF-8 is rejected by
 * `decodeURIComponent`, which validates the byte sequence as RFC 3629 requires.
 */
function decodeBase64UrlUtf8(segment: string): string | undefined {
  if (segment.length % 4 === 1) return undefined;
  const encoded: string[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of segment) {
    buffer = (buffer << 6) | BASE64URL_ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      encoded.push(`%${((buffer >> bits) & 0xff).toString(16).padStart(2, '0')}`);
      buffer &= (1 << bits) - 1;
    }
  }
  if (buffer !== 0) return undefined; // non-canonical trailing bits
  try {
    return decodeURIComponent(encoded.join(''));
  } catch {
    return undefined;
  }
}

interface MergedCredential {
  readonly format: SupportedFormat;
  readonly type: string;
  readonly claims: ClaimPath[];
  readonly keys: Set<string>;
}

/**
 * Maps the payload to the internal scope model. Credentials entries with the same format and type
 * are merged; an entry without `claim` declares the type but no claim paths (Annex B.2.9).
 * Report subject: `sub` as relyingPartyId, `intended_use_id` (or "") as intendedUseId, and "" as
 * serviceId, because a certificate has no service identifier.
 */
export function parseRegistrationCertificate(root: JsonValue, limits: Limits): ParseOutcome<ScopeNode> {
  const issues = new Issues('scope', 'MALFORMED_SCOPE');
  if (!isJsonObject(root)) {
    issues.malformed('', 'the registration certificate payload must be a JSON object');
    return { node: undefined, issues: issues.list };
  }
  const sub = getOwn(root, 'sub');
  if (!nonEmptyString(sub)) {
    issues.malformed('/sub', `sub is required: the identifier of the wallet-relying party (${SPEC} Table 7)`);
  }
  const intendedUseId = getOwn(root, 'intended_use_id');
  if (intendedUseId !== undefined && !nonEmptyString(intendedUseId)) {
    issues.malformed('/intended_use_id', `intended_use_id must be a non-empty string when present (${SPEC} Table 9)`);
  }

  const merged = new Map<string, MergedCredential>();
  const credentials = getOwn(root, 'credentials');
  if (!isJsonArray(credentials) || credentials.length === 0) {
    issues.malformed(
      '/credentials',
      `credentials is required and must be a non-empty array of the credential queries the relying party may make (${SPEC} Table 9, Annex B.2.7)`,
    );
  } else if (credentials.length > limits.maxScopeCredentials) {
    issues.tooLarge('/credentials', `credentials exceeds maxScopeCredentials (${limits.maxScopeCredentials})`);
  } else {
    credentials.forEach((entry, index) => {
      parseCertificateCredential(entry, appendPointer('/credentials', index), limits, issues, merged);
    });
  }

  if (issues.list.length > 0 || !nonEmptyString(sub)) return { node: undefined, issues: issues.list };
  return {
    node: {
      relyingPartyId: sub,
      serviceId: '',
      intendedUseId: typeof intendedUseId === 'string' ? intendedUseId : '',
      credentials: [...merged.values()].map(({ format, type, claims }) => ({ format, type, claims })),
    },
    issues: [],
  };
}

function parseCertificateCredential(
  value: JsonValue,
  pointer: string,
  limits: Limits,
  issues: Issues,
  merged: Map<string, MergedCredential>,
): void {
  if (!isJsonObject(value)) {
    issues.malformed(pointer, `each credentials entry must be an object (${SPEC} Annex B.2.9)`);
    return;
  }
  const format = getOwn(value, 'format');
  if (!nonEmptyString(format)) {
    issues.malformed(appendPointer(pointer, 'format'), `format is required (${SPEC} Annex B.2.9)`);
    return;
  }
  // An entry in a format WRPGuard does not evaluate cannot make a query in a supported format
  // pass, and a query in an unsupported format is indeterminate anyway (WRPG-FMT-01).
  if (!isSupportedFormat(format)) return;

  rejectUnknownKeys(value, CREDENTIAL_KEYS, pointer, 'B.2.9', issues);
  const types = parseCertificateMeta(getOwn(value, 'meta'), appendPointer(pointer, 'meta'), format, limits, issues);
  const claims = parseCertificateClaims(getOwn(value, 'claim'), appendPointer(pointer, 'claim'), format, limits, issues);

  for (const type of types) {
    const key = JSON.stringify([format, type]);
    let entry = merged.get(key);
    if (entry === undefined) {
      entry = { format, type, claims: [], keys: new Set() };
      merged.set(key, entry);
    }
    for (const path of claims) {
      const pathId = pathKey(path);
      if (entry.keys.has(pathId)) continue;
      entry.keys.add(pathId);
      entry.claims.push(path);
    }
  }
}

function parseCertificateMeta(
  value: JsonValue | undefined,
  pointer: string,
  format: SupportedFormat,
  limits: Limits,
  issues: Issues,
): string[] {
  if (!isJsonObject(value)) {
    issues.malformed(pointer, `meta is required and must be an object (${SPEC} Annex B.2.9; OpenID4VP 1.0 §6.1)`);
    return [];
  }
  if (format === 'mso_mdoc') {
    rejectUnknownKeys(value, ['doctype_value'], pointer, 'B.2.9', issues);
    const doctype = getOwn(value, 'doctype_value');
    if (!nonEmptyString(doctype)) {
      issues.malformed(appendPointer(pointer, 'doctype_value'), 'doctype_value is required and must be a non-empty string (OpenID4VP 1.0 Appendix B.2.3)');
      return [];
    }
    return [doctype];
  }
  rejectUnknownKeys(value, ['vct_values'], pointer, 'B.2.9', issues);
  const vctPointer = appendPointer(pointer, 'vct_values');
  const vctValues = getOwn(value, 'vct_values');
  if (!isJsonArray(vctValues) || vctValues.length === 0) {
    issues.malformed(vctPointer, 'vct_values is required and must be a non-empty array (OpenID4VP 1.0 Appendix B.3.5)');
    return [];
  }
  if (vctValues.length > limits.maxVctValues) {
    issues.tooLarge(vctPointer, `vct_values exceeds maxVctValues (${limits.maxVctValues})`);
    return [];
  }
  const types: string[] = [];
  vctValues.forEach((vct, index) => {
    if (nonEmptyString(vct)) types.push(vct);
    else issues.malformed(appendPointer(vctPointer, index), 'vct_values entries must be non-empty strings (OpenID4VP 1.0 Appendix B.3.5)');
  });
  return types;
}

function parseCertificateClaims(
  value: JsonValue | undefined,
  pointer: string,
  format: SupportedFormat,
  limits: Limits,
  issues: Issues,
): ClaimPath[] {
  if (value === undefined) return []; // "the WRPRC does not declare any specific attributes" (Annex B.2.9)
  if (!isJsonArray(value)) {
    issues.malformed(pointer, `claim must be an array of claim objects (${SPEC} Annex B.2.9)`);
    return [];
  }
  if (value.length > limits.maxClaimsPerScopeCredential) {
    issues.tooLarge(pointer, `claim exceeds maxClaimsPerScopeCredential (${limits.maxClaimsPerScopeCredential})`);
    return [];
  }
  const paths: ClaimPath[] = [];
  value.forEach((claim, index) => {
    const claimPointer = appendPointer(pointer, index);
    if (!isJsonObject(claim)) {
      issues.malformed(claimPointer, `each claim must be an object with a path (${SPEC} Annex B.2.10)`);
      return;
    }
    rejectUnknownKeys(claim, CLAIM_KEYS, claimPointer, 'B.2.10', issues);
    const path = parsePath(getOwn(claim, 'path'), appendPointer(claimPointer, 'path'), format === 'mso_mdoc', limits, issues);
    // `values` only narrows which credential matches; it never narrows the declared paths (WRPG-VAL-01).
    const values = getOwn(claim, 'values');
    if (values !== undefined && (!isJsonArray(values) || values.length === 0 || !values.every(isClaimValue))) {
      issues.malformed(appendPointer(claimPointer, 'values'), `values must be a non-empty array of strings, integers or booleans (${SPEC} Annex B.2.10)`);
    }
    if (path !== undefined) paths.push(path);
  });
  return paths;
}

function isClaimValue(value: JsonValue): boolean {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isInteger(value));
}

/**
 * Unknown keys inside the parts WRPGuard evaluates are rejected rather than ignored: WRPGuard cannot
 * tell whether a field it does not know narrows the declaration, so ignoring it could pass a query
 * a wallet would flag.
 */
function rejectUnknownKeys(object: JsonObject, known: readonly string[], pointer: string, clause: string, issues: Issues): void {
  for (const key of Object.keys(object)) {
    if (known.includes(key)) continue;
    const hint = key === 'claims' ? ` ${SPEC} names this field "claim"; a wallet following the specification would not read "claims".` : '';
    issues.malformed(
      appendPointer(pointer, key),
      `${quote(key)} is not defined here by ${SPEC} Annex ${clause}; WRPGuard cannot tell whether it changes the declaration.${hint}`,
    );
  }
}
