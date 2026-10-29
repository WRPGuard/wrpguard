/** Small, dependency-free text helpers shared by the parser, validator and report. */

/**
 * Code point ranges that can reorder, hide or inject terminal control sequences when printed,
 * or render as nothing: DEL and C1 controls, soft hyphen, combining grapheme joiner, Arabic
 * letter mark, Hangul fillers, Khmer inherent vowels, Mongolian selectors, zero-width and bidi
 * controls, line/paragraph separators, invisible operators, deprecated format characters,
 * braille blank, variation selectors, BOM, interlinear annotations, shorthand format controls,
 * musical format controls, tag characters and supplementary variation selectors.
 * C0 controls are handled separately because JSON.stringify already escapes them.
 * Ranges are numeric so the source stays ASCII.
 */
const UNSAFE_DISPLAY_RANGES: readonly (readonly [number, number])[] = [
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x34f, 0x34f],
  [0x61c, 0x61c],
  [0x115f, 0x1160],
  [0x17b4, 0x17b5],
  [0x180b, 0x180f],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0x2800, 0x2800],
  [0x3164, 0x3164],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
  [0xfff9, 0xfffb],
  [0x1bca0, 0x1bca3],
  [0x1d173, 0x1d17a],
  [0xe0000, 0xe007f],
  [0xe0100, 0xe01ef],
];

const codePointClass = (code: number): string => `\\u{${code.toString(16)}}`;
const UNSAFE_DISPLAY_CHARS = new RegExp(
  `[${UNSAFE_DISPLAY_RANGES.map(([from, to]) => (from === to ? codePointClass(from) : `${codePointClass(from)}-${codePointClass(to)}`)).join('')}]`,
  'gu',
);

/** Replaces C0 controls and display-unsafe characters with `\uXXXX` escapes. */
export function escapeControlCharacters(text: string): string {
  // eslint-disable-next-line no-control-regex -- matching control characters is the point
  return escapeJsonForDisplay(text.replace(/[\u0000-\u001f]/g, toUnicodeEscape));
}

/**
 * Escapes display-unsafe non-C0 characters in serialized JSON. The result is still valid
 * JSON with identical meaning: such characters can only occur inside JSON strings, and
 * JSON.stringify has already escaped C0 controls there.
 */
export function escapeJsonForDisplay(jsonText: string): string {
  return jsonText.replace(UNSAFE_DISPLAY_CHARS, toUnicodeEscape);
}

/** Escapes every UTF-16 code unit, so astral characters become a valid JSON surrogate pair. */
function toUnicodeEscape(char: string): string {
  let escaped = '';
  for (let i = 0; i < char.length; i++) {
    escaped += `\\u${char.charCodeAt(i).toString(16).padStart(4, '0')}`;
  }
  return escaped;
}

/** Shortens an untrusted string for display inside a message (output amplification bound). */
export function truncateForMessage(text: string, maxLength = 200): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...(${String(text.length)} chars)`;
}

/** Renders an untrusted string as a quoted, escaped literal for messages. */
export function quote(text: string): string {
  return escapeControlCharacters(JSON.stringify(truncateForMessage(text)));
}

/** Renders a claims path pointer for messages, e.g. `["address","street"]`; long elements are shortened. */
export function formatPath(path: readonly (string | number | null)[]): string {
  const shortened = path.map((element) => (typeof element === 'string' ? truncateForMessage(element, 64) : element));
  return escapeControlCharacters(JSON.stringify(shortened));
}

/** Appends one reference token to an RFC 6901 JSON Pointer. */
export function appendPointer(pointer: string, token: string | number): string {
  const text = typeof token === 'number' ? String(token) : token.replace(/~/g, '~0').replace(/\//g, '~1');
  return `${pointer}/${text}`;
}

/** Splits an RFC 6901 pointer into unescaped tokens. */
export function parsePointer(pointer: string): string[] {
  if (pointer === '') return [];
  return pointer
    .slice(1)
    .split('/')
    .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/**
 * Total order on pointers: segment by segment, numeric segments compared numerically and
 * ordered before non-numeric ones, then by UTF-16 code units. Shorter prefixes first.
 */
export function comparePointers(a: string, b: string): number {
  if (a === b) return 0;
  const left = parsePointer(a);
  const right = parsePointer(b);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const x = left[i] as string;
    const y = right[i] as string;
    if (x === y) continue;
    const xNumeric = /^(0|[1-9][0-9]*)$/.test(x);
    const yNumeric = /^(0|[1-9][0-9]*)$/.test(y);
    if (xNumeric && yNumeric) {
      return x.length !== y.length ? x.length - y.length : x < y ? -1 : 1;
    }
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return left.length - right.length;
}

/** Plain code-unit comparison used for deterministic tie-breaking. */
export function compareStrings(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

/** UTF-8 byte length of a JS string, stopping early once `limit` is exceeded. */
export function utf8ByteLengthExceeds(text: string, limit: number): boolean {
  // Fast path: even if every code unit took 3 bytes the text would fit.
  if (text.length * 3 <= limit) return false;
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
    if (bytes > limit) return true;
  }
  return false;
}
