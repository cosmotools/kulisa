// Streaming range semantics, backpressure and disposal without Electron (README.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaResponse } from './main/media.ts';
import { readText } from './renderer/viewers/text/read.ts';
import { ImageBudget } from './renderer/viewers/markdown/image-budget.ts';

test('one Markdown document bounds image bytes, count and pixels, releasing reservations once', () => {
  const budget = new ImageBudget(), first = budget.reserve(8 * 1024 * 1024), second = budget.reserve(8 * 1024 * 1024);
  assert.throws(() => budget.reserve(1), /16 MiB/);
  first.dimensions(4000, 2000); second.dimensions(4000, 2000);
  assert.throws(() => first.dimensions(4000, 2001), /16 million pixels/);
  first.dispose(); first.dispose();
  const third = budget.reserve(8 * 1024 * 1024); third.dimensions(4000, 2000);
  second.dispose(); third.dispose();
  const images = Array.from({ length: 32 }, () => budget.reserve(1));
  assert.throws(() => budget.reserve(1), /32 images/); images[0]!.dispose(); budget.reserve(1).dispose();
});
test('formatted text is bounded before reading and source preserves UTF-8 validation', async () => {
  let read = false;
  const source = { id: 'doc', name: 'doc.md', size: 256 * 1024 + 1, read: async () => { read = true; return new Uint8Array(); } };
  await assert.rejects(readText(source, new AbortController().signal, 256 * 1024), /Choose Source/);
  assert.equal(read, false);
  await assert.rejects(readText({ ...source, size: 2, read: async () => new Uint8Array([0xff, 0xff]) }, new AbortController().signal), /encoded data/);
});
test('media handles bounded, open and suffix ranges, HEAD and invalid requests', async () => {
  const signal = new AbortController().signal, data = Uint8Array.from({ length: 100 }, (_, i) => i);
  const source = { size: data.length, read: async (offset: number, length: number) => data.slice(offset, offset + length) };
  for (const [range, start, end] of [['bytes=10-19', 10, 19], ['bytes=90-', 90, 99], ['bytes=-10', 90, 99], ['bytes=90-1000', 90, 99]] as const) {
    const response = mediaResponse(new Request('https://test/', { headers: { range } }), source, signal);
    assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/100`);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), data.slice(start, end + 1));
  }
  const head = mediaResponse(new Request('https://test/', { method: 'HEAD' }), { ...source, read: async () => { throw new Error('HEAD must not read'); } }, signal);
  assert.equal(head.headers.get('content-length'), '100'); assert.equal(head.body, null);
  for (const range of ['bytes=100-', 'bytes=20-10', 'bytes=-0', 'bytes=0-1,3-4', 'bytes=-', 'items=0-1', 'bytes=999999999999999999999-']) {
    assert.equal(mediaResponse(new Request('https://test/', { headers: { range } }), source, signal).status, 416, range);
  }
  assert.equal(mediaResponse(new Request('https://test/', { method: 'POST' }), source, signal).status, 405);
});
test('large media reads only on demand in bounded chunks and revocation cancels pending reads', async () => {
  const reads: number[] = [], owner = new AbortController();
  let reading: AbortSignal | undefined;
  const response = mediaResponse(new Request('https://test/'), { size: 2 ** 40,
    read: async (_offset, length, signal) => { reads.push(length); reading = signal; return new Uint8Array(length); } }, owner.signal);
  await Promise.resolve(); assert.deepEqual(reads, []);
  const reader = response.body!.getReader();
  await reader.read(); assert.deepEqual(reads, [256 * 1024]);
  await Promise.resolve(); assert.deepEqual(reads, [256 * 1024]);
  owner.abort(); assert.equal(reading?.aborted, true);
  await assert.rejects(reader.read(), /abort/i);
  assert.equal(mediaResponse(new Request('https://test/'), { size: 1, read: async () => new Uint8Array(1) }, owner.signal).status, 410);
});
test('consumer cancellation stops a stream and short reads fail instead of serving a changed file', async () => {
  const owner = new AbortController();
  let reading: AbortSignal | undefined;
  const response = mediaResponse(new Request('https://test/'), { size: 512 * 1024,
    read: async (_offset, length, signal) => { reading = signal; return new Uint8Array(length); } }, owner.signal);
  const reader = response.body!.getReader(); await reader.read(); await reader.cancel(); assert.equal(reading?.aborted, true);
  const changed = mediaResponse(new Request('https://test/'), { size: 1024, read: async () => new Uint8Array(1) }, owner.signal);
  await assert.rejects(changed.arrayBuffer(), /changed/);
});
