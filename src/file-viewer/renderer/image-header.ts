// Cheap bounded recognition; dimensions and full validity belong to the lazy image engine (../README.md).
export function hasImageHeader(header: Uint8Array) {
  const text = (start: number, end: number) => new TextDecoder().decode(header.subarray(start, end));
  return header.length >= 8 && (
    header[0] === 0x89 && text(1, 8) === 'PNG\r\n\x1a\n'
    || header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    || /^GIF8[79]a$/.test(text(0, 6))
    || text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP'
    || text(0, 2) === 'BM'
    || header[0] === 0 && header[1] === 0 && header[2] === 1 && header[3] === 0
    || text(4, 8) === 'ftyp' && /^(avif|avis)$/.test(text(8, 12))
    || /^\s*(?:<\?xml[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE\s+svg[^>]*>\s*)*<svg(?:\s|>)/i.test(text(0, 1024))
  );
}
