/** Bounded local file reading for the CLI. Never reads more than `maxBytes + 1` bytes. */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

// O_NONBLOCK keeps open() from blocking on a FIFO with no writer (POSIX); it is undefined and
// unnecessary on Windows. Regular files are unaffected. The isFile() check below rejects FIFOs.
const OPEN_FLAGS = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0);

export type ReadOutcome =
  | { readonly kind: 'ok'; readonly text: string }
  | { readonly kind: 'too-large'; readonly message: string }
  | { readonly kind: 'invalid-utf8'; readonly message: string }
  | { readonly kind: 'io-error'; readonly message: string };

const CHUNK_SIZE = 64 * 1024;

export async function readInputFile(path: string, maxBytes: number): Promise<ReadOutcome> {
  let handle;
  try {
    handle = await open(path, OPEN_FLAGS);
  } catch (error) {
    return { kind: 'io-error', message: describeIoError(error) };
  }
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) return { kind: 'io-error', message: 'not a regular file' };
    if (stats.size > maxBytes) {
      return { kind: 'too-large', message: `file exceeds maxInputBytes (${maxBytes} bytes)` };
    }
    // Re-check while reading: the file may grow after stat().
    const chunks: Buffer[] = [];
    let total = 0;
    const buffer = Buffer.alloc(CHUNK_SIZE);
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, CHUNK_SIZE, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > maxBytes) {
        return { kind: 'too-large', message: `file exceeds maxInputBytes (${maxBytes} bytes)` };
      }
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    try {
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks, total));
      return { kind: 'ok', text };
    } catch {
      return { kind: 'invalid-utf8', message: 'file is not valid UTF-8' };
    }
  } catch (error) {
    return { kind: 'io-error', message: describeIoError(error) };
  } finally {
    await handle.close();
  }
}

function describeIoError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;
  switch (code) {
    case 'ENOENT':
      return 'file not found';
    case 'EACCES':
    case 'EPERM':
      return 'permission denied';
    case 'EISDIR':
      return 'not a regular file';
    default:
      return code === undefined ? 'could not read file' : `could not read file (${code})`;
  }
}
