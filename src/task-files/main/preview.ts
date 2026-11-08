// Reject oversized raster dimensions before Electron decodes a preview (../README.md).
// Unknown formats keep their file icon.
import fs from 'node:fs/promises';

export async function readPreview(file: string) {
  const handle = await fs.open(file, 'r').catch((): null => null);
  if (!handle) return null;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024) return null;
    // A concurrent writer can grow a file after stat; a bounded read cannot allocate for the growing contents.
    const data = Buffer.alloc(stat.size);
    const { bytesRead } = await handle.read(data, 0, data.length, 0);
    const image = data.subarray(0, bytesRead);
    return previewable(image) ? image : null;
  } catch { return null; } finally { await handle.close(); }
}

export function previewable(data: Buffer) {
  let width = 0, height = 0;
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    width = data.readUInt32BE(16); height = data.readUInt32BE(20);
  } else if (data.length >= 4 && data.readUInt16BE(0) === 0xffd8) {
    let at = 2;
    while (at + 4 <= data.length) {
      if (data[at++] !== 0xff) return false;
      while (data[at] === 0xff) at++;
      const marker = data[at++];
      if (marker === undefined || marker === 0xda || marker === 0xd9) break;
      if (at + 2 > data.length) break;
      const length = data.readUInt16BE(at);
      if (length < 2 || at + length > data.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 7) {
        height = data.readUInt16BE(at + 3); width = data.readUInt16BE(at + 5); break;
      }
      at += length;
    }
  } else if (data.length >= 30 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    const format = data.toString('ascii', 12, 16);
    if (format === 'VP8X') {
      width = data.readUIntLE(24, 3) + 1; height = data.readUIntLE(27, 3) + 1;
    } else if (format === 'VP8 ' && data.subarray(23, 26).equals(Buffer.from([0x9d, 1, 0x2a]))) {
      width = data.readUInt16LE(26) & 0x3fff; height = data.readUInt16LE(28) & 0x3fff;
    } else if (format === 'VP8L' && data[20] === 0x2f) {
      const bits = data.readUInt32LE(21); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    }
  }
  return width > 0 && height > 0 && width * height <= 16_000_000;
}
