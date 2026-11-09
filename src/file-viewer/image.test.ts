// Header bounds and cancellation must hold before a browser decodes pixels (README.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageMetadata, readImage, MAX_IMAGE_BYTES } from './renderer/viewers/image/metadata.ts';
import { hasImageHeader } from './renderer/image-header.ts';
import type { FileSource } from './renderer/registry.ts';

function png(width: number, height: number) {
  const bytes = Buffer.alloc(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); bytes.write('IHDR', 12);
  bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); return bytes;
}
const source = (bytes: Uint8Array): FileSource => ({ id: 'image', name: 'image.png', size: bytes.length,
  read: async (offset, length) => bytes.subarray(offset, offset + length) });
test('image recognition accepts a root SVG and binary signatures without claiming HTML containing SVG', () => {
  assert.equal(hasImageHeader(png(2, 3)), true);
  for (const xml of ['<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"/>',
    '<?xml version="1.0"?><!-- comment --><svg width="2" height="3"/>']) assert.equal(hasImageHeader(new TextEncoder().encode(xml)), true);
  const html = new TextEncoder().encode('<!DOCTYPE html><html><body><svg width="2" height="3"></svg></body></html>');
  assert.equal(hasImageHeader(html), false);
  assert.equal(hasImageHeader(new TextEncoder().encode('%PDF-1.7')), false);
});
test('dimension checks accept tall images and reject huge, zero, malformed or unsupported headers before decoding', () => {
  assert.deepEqual(imageMetadata(png(1200, 8000)), { mime: 'image/png', width: 1200, height: 8000 });
  for (const [width, height] of [[4001, 4000], [1, 32769], [0, 1]] as const) assert.throws(() => imageMetadata(png(width, height)), /limited|invalid dimensions/);
  assert.throws(() => imageMetadata(new Uint8Array([255])), /damaged|not supported/);
  assert.throws(() => imageMetadata(new TextEncoder().encode('<svg width="99999" height="99999"/>')), /limited/);
});
test('bounded image reads reject oversize before allocation/reads, truncated replies and cancellation', async () => {
  let reads = 0;
  const signal = new AbortController().signal;
  await assert.rejects(readImage({ ...source(new Uint8Array()), size: MAX_IMAGE_BYTES + 1, read: async () => { reads++; return new Uint8Array(); } }, signal), /16 MiB/);
  assert.equal(reads, 0);
  await assert.rejects(readImage({ ...source(png(1, 1)), read: async () => new Uint8Array(1) }, signal), /changed/);
  const controller = new AbortController();
  await assert.rejects(readImage({ ...source(png(1, 1)), read: async () => { controller.abort(); return png(1, 1); } }, controller.signal), /abort/i);
  const bytes = Buffer.alloc(4 * 1024 * 1024 + 24); bytes.set(png(1, 1));
  const ranges: number[] = [];
  const read = await readImage({ ...source(bytes), read: async (offset, length) => { ranges.push(length); return bytes.subarray(offset, offset + length); } }, signal);
  assert.deepEqual(ranges, [4 * 1024 * 1024, 24]); assert.equal(read.width, 1);
});
test('icon directory dimensions cannot conceal an oversized embedded raster', () => {
  const icon = Buffer.alloc(22 + 24); icon.writeUInt16LE(1, 2); icon.writeUInt16LE(1, 4);
  icon[6] = icon[7] = 16; icon.writeUInt32LE(24, 14); icon.writeUInt32LE(22, 18);
  icon.set(png(100000, 100000), 22);
  assert.throws(() => imageMetadata(icon), /limited/);
  icon.set(png(16, 16), 22); assert.equal(imageMetadata(icon).mime, 'image/x-icon');
});
