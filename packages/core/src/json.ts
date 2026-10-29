/**
 * Strict, bounded JSON handling for untrusted input (ADR-003 §1, §2).
 *
 * - `parseJsonStrict` never calls JSON.parse on a whole document. It validates RFC 8259
 *   grammar iteratively, rejects duplicate keys, and enforces limits while parsing.
 * - `snapshotValue` copies caller-provided JS values into the same safe representation.
 *
 * Both produce null-prototype objects, so untrusted keys such as "__proto__" are plain data.
 */
import { DEFAULT_LIMITS, resolveLimits, type Limits } from './limits.js';
import { appendPointer, quote, utf8ByteLengthExceeds } from './text.js';

export type JsonValue = null | boolean | number | string | JsonArray | JsonObject;
export type JsonArray = readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonErrorCode = 'INVALID_JSON' | 'INPUT_TOO_LARGE';

export interface JsonError {
  readonly code: JsonErrorCode;
  /** RFC 6901 pointer to where the problem was detected. */
  readonly pointer: string;
  readonly message: string;
}

export type JsonParseResult =
  | { readonly ok: true; readonly value: JsonValue }
  | { readonly ok: false; readonly error: JsonError };

class JsonFailure extends Error {
  constructor(
    readonly code: JsonErrorCode,
    readonly pointer: string,
    message: string,
  ) {
    super(message);
  }
}

type ArrayFrame = { readonly kind: 'array'; readonly items: JsonValue[] };
type ObjectFrame = {
  readonly kind: 'object';
  readonly object: Record<string, JsonValue>;
  readonly keys: Set<string>;
  key: string | null;
};
type Frame = ArrayFrame | ObjectFrame;

const NUMBER_PATTERN = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
const OPENED: unique symbol = Symbol('opened');
const HEX4_PATTERN = /^[0-9a-fA-F]{4}$/;

/**
 * Parses untrusted JSON text. Accepts one leading UTF-8 BOM. Rejects duplicate object keys,
 * non-finite numbers, and anything exceeding `limits`.
 */
export function parseJsonStrict(text: string, limits?: Partial<Limits>): JsonParseResult {
  const resolved = limits === undefined ? DEFAULT_LIMITS : resolveLimits(limits);
  if (typeof text !== 'string') {
    throw new TypeError('parseJsonStrict expects a string');
  }
  if (utf8ByteLengthExceeds(text, resolved.maxInputBytes)) {
    return {
      ok: false,
      error: {
        code: 'INPUT_TOO_LARGE',
        pointer: '',
        message: `JSON text exceeds maxInputBytes (${resolved.maxInputBytes} bytes)`,
      },
    };
  }
  try {
    return { ok: true, value: new StrictParser(text, resolved).parse() };
  } catch (error) {
    if (error instanceof JsonFailure) {
      return { ok: false, error: { code: error.code, pointer: error.pointer, message: error.message } };
    }
    throw error;
  }
}

class StrictParser {
  private pos: number;
  private nodes = 0;
  private readonly stack: Frame[] = [];

  constructor(
    private readonly text: string,
    private readonly limits: Limits,
  ) {
    this.pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  }

  parse(): JsonValue {
    let result: JsonValue | undefined;
    let expectingValue = true;
    for (;;) {
      if (expectingValue) {
        const value = this.readValueOrOpen();
        expectingValue = false;
        if (value === OPENED) {
          // A container was opened; it may be empty.
          if (this.closeIfEmpty()) {
            result = this.closeTop(result);
          } else {
            expectingValue = true;
          }
          continue;
        }
        result = this.attach(value, result);
        continue;
      }

      this.skipWhitespace();
      const top = this.stack[this.stack.length - 1];
      if (top === undefined) {
        if (this.pos !== this.text.length) this.fail('INVALID_JSON', 'unexpected data after JSON value');
        return result as JsonValue;
      }
      const char = this.text[this.pos];
      if (char === ',') {
        this.pos++;
        if (top.kind === 'object') this.readKey(top);
        expectingValue = true;
      } else if ((char === ']' && top.kind === 'array') || (char === '}' && top.kind === 'object')) {
        this.pos++;
        result = this.closeTop(result);
      } else {
        this.fail('INVALID_JSON', char === undefined ? 'unexpected end of input' : `unexpected character ${quote(char)}`);
      }
    }
  }

  /** Reads a primitive, or opens a container and returns OPENED. */
  private readValueOrOpen(): JsonValue | typeof OPENED {
    this.skipWhitespace();
    const char = this.text[this.pos];
    this.countNode();
    switch (char) {
      case '{': {
        this.pos++;
        this.push({ kind: 'object', object: Object.create(null) as Record<string, JsonValue>, keys: new Set(), key: null });
        return OPENED;
      }
      case '[':
        this.pos++;
        this.push({ kind: 'array', items: [] });
        return OPENED;
      case '"':
        return this.readString();
      case 't':
        return this.readLiteral('true', true);
      case 'f':
        return this.readLiteral('false', false);
      case 'n':
        return this.readLiteral('null', null);
      case undefined:
        return this.fail('INVALID_JSON', 'unexpected end of input');
      default:
        if (char === '-' || (char >= '0' && char <= '9')) return this.readNumber();
        return this.fail('INVALID_JSON', `unexpected character ${quote(char)}`);
    }
  }

  /** After opening a container: consume `]`/`}` if empty, otherwise prepare the first key. */
  private closeIfEmpty(): boolean {
    this.skipWhitespace();
    const top = this.stack[this.stack.length - 1] as Frame;
    const char = this.text[this.pos];
    if ((top.kind === 'array' && char === ']') || (top.kind === 'object' && char === '}')) {
      this.pos++;
      return true;
    }
    if (top.kind === 'object') this.readKey(top);
    return false;
  }

  private push(frame: Frame): void {
    if (this.stack.length + 1 > this.limits.maxDepth) {
      this.fail('INPUT_TOO_LARGE', `nesting exceeds maxDepth (${this.limits.maxDepth})`);
    }
    this.stack.push(frame);
  }

  private closeTop(result: JsonValue | undefined): JsonValue | undefined {
    const frame = this.stack.pop() as Frame;
    const value = frame.kind === 'array' ? frame.items : frame.object;
    return this.attach(value, result);
  }

  private attach(value: JsonValue, result: JsonValue | undefined): JsonValue | undefined {
    const top = this.stack[this.stack.length - 1];
    if (top === undefined) return value;
    if (top.kind === 'array') {
      if (top.items.length >= this.limits.maxArrayLength) {
        this.fail('INPUT_TOO_LARGE', `array exceeds maxArrayLength (${this.limits.maxArrayLength})`);
      }
      top.items.push(value);
    } else {
      top.object[top.key as string] = value;
      top.key = null;
    }
    return result;
  }

  private readKey(frame: ObjectFrame): void {
    this.skipWhitespace();
    if (this.text[this.pos] !== '"') this.fail('INVALID_JSON', 'expected a string object key');
    const key = this.readString();
    if (frame.keys.has(key)) {
      this.fail('INVALID_JSON', `duplicate object key ${quote(key)}`);
    }
    if (frame.keys.size >= this.limits.maxObjectProperties) {
      this.fail('INPUT_TOO_LARGE', `object exceeds maxObjectProperties (${this.limits.maxObjectProperties})`);
    }
    frame.keys.add(key);
    frame.key = key;
    this.skipWhitespace();
    if (this.text[this.pos] !== ':') this.fail('INVALID_JSON', 'expected ":" after object key');
    this.pos++;
  }

  private readString(): string {
    const start = this.pos;
    this.pos++; // opening quote
    let escaped = false;
    for (;;) {
      if (this.pos >= this.text.length) this.fail('INVALID_JSON', 'unterminated string');
      const unit = this.text.charCodeAt(this.pos);
      if (unit === 0x22) break;
      if (unit < 0x20) this.fail('INVALID_JSON', 'unescaped control character in string');
      if (unit === 0x5c) {
        escaped = true;
        const next = this.text[this.pos + 1];
        if (next === 'u') {
          if (!HEX4_PATTERN.test(this.text.slice(this.pos + 2, this.pos + 6))) {
            this.fail('INVALID_JSON', 'invalid \\u escape in string');
          }
          this.pos += 6;
        } else if (next !== undefined && '"\\/bfnrt'.includes(next)) {
          this.pos += 2;
        } else {
          this.fail('INVALID_JSON', 'invalid escape in string');
        }
        continue;
      }
      this.pos++;
    }
    this.pos++; // closing quote
    const token = this.text.slice(start, this.pos);
    // The token is grammar-checked above, so JSON.parse only performs escape decoding here.
    const value = escaped ? (JSON.parse(token) as string) : token.slice(1, -1);
    if (value.length > this.limits.maxStringLength) {
      this.fail('INPUT_TOO_LARGE', `string exceeds maxStringLength (${this.limits.maxStringLength})`);
    }
    return value;
  }

  private readNumber(): number {
    NUMBER_PATTERN.lastIndex = this.pos;
    const match = NUMBER_PATTERN.exec(this.text);
    if (match === null) this.fail('INVALID_JSON', 'invalid number');
    const lexeme = match[0];
    this.pos += lexeme.length;
    const value = Number(lexeme);
    if (!Number.isFinite(value)) this.fail('INVALID_JSON', 'number is not finite');
    // WRPG-SYN-02: integral values must be written as integers. `0.99999999999999999999`, `1.0`
    // and `1e-400` all become integers as doubles, but a parser keeping exact decimals (or
    // rejecting floats) reads them differently, which could turn into a false pass.
    if (/[.eE]/.test(lexeme) && Number.isInteger(value)) {
      this.fail('INVALID_JSON', 'integral number written with a fraction or exponent (WRPGuard policy WRPG-SYN-02)');
    }
    return value;
  }

  private readLiteral<T extends JsonValue>(word: string, value: T): T {
    if (!this.text.startsWith(word, this.pos)) this.fail('INVALID_JSON', 'invalid literal');
    this.pos += word.length;
    return value;
  }

  private skipWhitespace(): void {
    for (;;) {
      const unit = this.text.charCodeAt(this.pos);
      if (unit === 0x20 || unit === 0x09 || unit === 0x0a || unit === 0x0d) this.pos++;
      else return;
    }
  }

  private countNode(): void {
    this.nodes++;
    if (this.nodes > this.limits.maxNodes) {
      this.fail('INPUT_TOO_LARGE', `document exceeds maxNodes (${this.limits.maxNodes})`);
    }
  }

  private currentPointer(): string {
    let pointer = '';
    for (const frame of this.stack) {
      if (frame.kind === 'array') pointer = appendPointer(pointer, frame.items.length);
      else if (frame.key !== null) pointer = appendPointer(pointer, frame.key);
    }
    return pointer;
  }

  private fail(code: JsonErrorCode, message: string): never {
    throw new JsonFailure(code, this.currentPointer(), `${message} (at offset ${this.pos})`);
  }
}

/**
 * Copies a caller-provided JS value into fresh JSON data, mirroring what JSON.stringify would
 * send: own enumerable string keys only; object properties whose value is `undefined` are
 * omitted. Everything that would serialize differently from how it is evaluated is rejected:
 * any reachable `toJSON`, getters, functions, symbols as values, bigint, non-finite numbers, sparse arrays,
 * `undefined` array elements, and non-plain objects (class instances, Date, Map, ...).
 */
export function snapshotValue(value: unknown, limits: Limits): JsonParseResult {
  try {
    return { ok: true, value: snapshot(value, limits) };
  } catch (error) {
    if (error instanceof JsonFailure) {
      return { ok: false, error: { code: error.code, pointer: error.pointer, message: error.message } };
    }
    throw error;
  }
}

type SnapshotTask = {
  readonly source: unknown;
  readonly depth: number;
  readonly pointer: string;
  readonly assign: (value: JsonValue) => void;
};

function snapshot(root: unknown, limits: Limits): JsonValue {
  let result: JsonValue = null;
  let nodes = 0;
  const tasks: SnapshotTask[] = [{ source: root, depth: 0, pointer: '', assign: (v) => (result = v) }];

  while (tasks.length > 0) {
    const task = tasks.pop() as SnapshotTask;
    const { source, pointer } = task;
    nodes++;
    if (nodes > limits.maxNodes) {
      throw new JsonFailure('INPUT_TOO_LARGE', pointer, `value exceeds maxNodes (${limits.maxNodes})`);
    }

    if (source === null || typeof source === 'boolean') {
      task.assign(source);
    } else if (typeof source === 'number') {
      if (!Number.isFinite(source)) throw new JsonFailure('INVALID_JSON', pointer, 'number is not finite');
      task.assign(source);
    } else if (typeof source === 'string') {
      if (source.length > limits.maxStringLength) {
        throw new JsonFailure('INPUT_TOO_LARGE', pointer, `string exceeds maxStringLength (${limits.maxStringLength})`);
      }
      task.assign(source);
    } else if (typeof source === 'object') {
      const depth = task.depth + 1;
      if (depth > limits.maxDepth) {
        throw new JsonFailure('INPUT_TOO_LARGE', pointer, `nesting exceeds maxDepth (${limits.maxDepth})`);
      }
      // JSON.stringify calls any reachable toJSON (own, non-enumerable, or inherited through a
      // polluted prototype), so the serialized request could differ from what is evaluated.
      // `in` checks presence without invoking accessors.
      if ('toJSON' in source) {
        throw new JsonFailure('INVALID_JSON', pointer, 'toJSON would change the serialized value');
      }
      if (Array.isArray(source)) {
        if (Object.getPrototypeOf(source) !== Array.prototype) {
          throw new JsonFailure('INVALID_JSON', pointer, 'array subclass is not plain JSON data');
        }
        if (source.length > limits.maxArrayLength) {
          throw new JsonFailure('INPUT_TOO_LARGE', pointer, `array exceeds maxArrayLength (${limits.maxArrayLength})`);
        }
        const items: JsonValue[] = new Array<JsonValue>(source.length).fill(null);
        for (let index = source.length - 1; index >= 0; index--) {
          const descriptor = Object.getOwnPropertyDescriptor(source, index);
          const itemPointer = appendPointer(pointer, index);
          if (descriptor === undefined) throw new JsonFailure('INVALID_JSON', itemPointer, 'sparse array element');
          if (!('value' in descriptor)) throw new JsonFailure('INVALID_JSON', itemPointer, 'accessor property is not plain JSON data');
          if (descriptor.value === undefined) throw new JsonFailure('INVALID_JSON', itemPointer, 'undefined is not JSON data');
          tasks.push({ source: descriptor.value, depth, pointer: itemPointer, assign: (v) => (items[index] = v) });
        }
        task.assign(items);
      } else {
        const prototype: unknown = Object.getPrototypeOf(source);
        if (prototype !== Object.prototype && prototype !== null) {
          throw new JsonFailure('INVALID_JSON', pointer, 'non-plain object is not JSON data');
        }
        const object = Object.create(null) as Record<string, JsonValue>;
        const keys = Object.keys(source);
        if (keys.length > limits.maxObjectProperties) {
          throw new JsonFailure('INPUT_TOO_LARGE', pointer, `object exceeds maxObjectProperties (${limits.maxObjectProperties})`);
        }
        for (let i = keys.length - 1; i >= 0; i--) {
          const key = keys[i] as string;
          const propertyPointer = appendPointer(pointer, key);
          if (key.length > limits.maxStringLength) {
            throw new JsonFailure('INPUT_TOO_LARGE', propertyPointer, `key exceeds maxStringLength (${limits.maxStringLength})`);
          }
          const descriptor = Object.getOwnPropertyDescriptor(source, key) as PropertyDescriptor;
          if (!('value' in descriptor)) {
            throw new JsonFailure('INVALID_JSON', propertyPointer, 'accessor property is not plain JSON data');
          }
          if (descriptor.value === undefined) continue;
          tasks.push({ source: descriptor.value, depth, pointer: propertyPointer, assign: (v) => (object[key] = v) });
        }
        task.assign(object);
      }
    } else {
      throw new JsonFailure('INVALID_JSON', pointer, `${typeof source} is not JSON data`);
    }
  }
  return result;
}

/** Own-property lookup that is safe for null-prototype and ordinary objects alike. */
export function getOwn(object: JsonObject, key: string): JsonValue | undefined {
  return Object.hasOwn(object, key) ? object[key] : undefined;
}

export function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonArray(value: JsonValue | undefined): value is JsonArray {
  return Array.isArray(value);
}
