// Bounded reads of confined regular files (../README.md).
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { ownedPath } from './files.ts';

export async function readFileRange(root: string, file: string, offset: number, length: number): Promise<{ bytes: Uint8Array; size: number; revision: string } | { error: string }> {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 0 || length > 4 * 1024 * 1024)
    return { error: 'Artifact reads are limited to 4 MiB at a time.' };
  try {
    if (!await ownedPath(root, file)) return { error: 'This file is outside the results folder or is a symbolic link.' };
    const original = await fs.lstat(file);
    if (!original.isFile()) return { error: 'Only regular artifact files can be previewed.' };
    const handle = await fs.open(file, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.dev !== original.dev || stat.ino !== original.ino) return { error: 'The artifact changed while opening.' };
      const bytes = Buffer.alloc(Math.min(length, Math.max(0, stat.size - offset)));
      let read = 0;
      while (read < bytes.length) {
        const result = await handle.read(bytes, read, bytes.length - read, offset + read);
        if (!result.bytesRead) break;
        read += result.bytesRead;
      }
      const after = await handle.stat();
      if (stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs) return { error: 'The artifact changed while reading.' };
      return { bytes: bytes.subarray(0, read), size: stat.size, revision: `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}` };
    } finally { await handle.close(); }
  } catch (error) { return { error: (error as Error).message }; }
}
