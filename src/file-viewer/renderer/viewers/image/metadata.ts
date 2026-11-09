// Read dimensions before Chromium allocates a raster; decoding remains the browser's job (../../../README.md).
import { imageSize } from 'image-size';
import type { FileSource } from '../../registry.ts';

export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_PIXELS = 16_000_000, MAX_AXIS = 32_768;
const mimeTypes: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  bmp: 'image/bmp', ico: 'image/x-icon', svg: 'image/svg+xml',
};
export function checkImageDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('The image has invalid dimensions.');
  if (width > MAX_AXIS || height > MAX_AXIS || width * height > MAX_PIXELS)
    throw new Error('Image preview is limited to 16 million pixels and 32,768 pixels per side.');
}
export function imageMetadata(bytes: Uint8Array) {
  let result: ReturnType<typeof imageSize>;
  try { result = imageSize(bytes); }
  catch { throw new Error('This image is damaged or its format is not supported.'); }
  const mime = mimeTypes[result.type ?? ''];
  if (!mime) throw new Error('This image format is not supported. Open it in a system application.');
  for (const { width, height } of [result, ...(result.images ?? [])]) checkImageDimensions(width, height);
  if (result.type === 'ico') checkIconPayloads(bytes);
  const rotated = result.orientation !== undefined && result.orientation >= 5 && result.orientation <= 8;
  return { mime, width: rotated ? result.height : result.width, height: rotated ? result.width : result.height };
}
function checkIconPayloads(bytes: Uint8Array) {
  // ICO directory dimensions can disagree with embedded PNG/DIB dimensions; check the actual raster too.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), count = view.getUint16(4, true);
  for (let index = 0; index < count; index++) {
    const entry = 6 + index * 16, length = view.getUint32(entry + 8, true), offset = view.getUint32(entry + 12, true);
    if (offset < 6 + count * 16 || length < 12 || offset + length > bytes.length) throw new Error('The icon has invalid image data.');
    const payload = bytes.subarray(offset, offset + length);
    if (payload[0] === 0x89) {
      const size = imageSize(payload); checkImageDimensions(size.width, size.height);
    } else {
      const dib = new DataView(payload.buffer, payload.byteOffset, payload.byteLength), header = dib.getUint32(0, true);
      if (header === 12) checkImageDimensions(dib.getUint16(4, true), dib.getUint16(6, true) / 2);
      else if (header >= 40 && header <= length) checkImageDimensions(dib.getInt32(4, true), Math.abs(dib.getInt32(8, true)) / 2);
      else throw new Error('The icon has an unsupported bitmap header.');
    }
  }
}
export async function readImage(source: FileSource, signal: AbortSignal) {
  if (!Number.isSafeInteger(source.size) || source.size < 1) throw new Error('The image is empty or its size is invalid.');
  if (source.size > MAX_IMAGE_BYTES) throw new Error('Image preview is limited to 16 MiB.');
  signal.throwIfAborted();
  const bytes = new Uint8Array(source.size);
  for (let offset = 0; offset < bytes.length;) {
    const length = Math.min(4 * 1024 * 1024, bytes.length - offset);
    const chunk = await source.read(offset, length, signal);
    signal.throwIfAborted();
    if (chunk.length !== length) throw new Error('The file changed while opening. Select it again to reload.');
    bytes.set(chunk, offset); offset += length;
  }
  return { bytes, ...imageMetadata(bytes) };
}
