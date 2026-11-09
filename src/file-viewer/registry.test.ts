// Registry rules and whole-source search, independent of Electron/React rendering (README.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createViewerRegistry, identifyMime } from './renderer/registry.ts';
import type { FileSource, ViewerDescriptor } from './renderer/registry.ts';
import { findText } from './renderer/viewers/text/search.ts';

const bytes = new TextEncoder().encode('example');
const source: FileSource = { id: 'sample', name: 'file.dat', size: bytes.length, mime: 'application/example', read: async () => bytes };
const viewer = (id: string, mime: string[], priority = 0): ViewerDescriptor => ({ id, mime, priority, load: async () => { throw new Error('selection must not load engines'); } });
test('registry ranks exact MIME above wildcards, then priority; registrations can replace engines', () => {
  const original = viewer('exact', ['application/example']);
  const replacement = viewer('exact', ['application/example'], 1);
  const alternate = viewer('alternate', ['application/example'], 0);
  const registry = createViewerRegistry([viewer('wildcard', ['application/*'], 100), original, alternate, replacement]);
  assert.equal(registry.select(source, bytes)?.id, 'exact');
  assert.equal(registry.select(source, bytes), replacement);
});
test('registry supports a new probed MIME without a central dispatch change and rejects unknown input', () => {
  const synthetic = { ...viewer('synthetic', []), probe: (header: Uint8Array) => header[0] === 0 };
  const registry = createViewerRegistry([synthetic]);
  assert.equal(registry.select({ ...source, mime: undefined }, new Uint8Array([0, 1]))?.id, 'synthetic');
  assert.equal(registry.select(source, bytes), undefined);
});
test('generic text detection leaves extension-based formats extensible, while specific MIME still wins', () => {
  const csv = { ...viewer('table', ['text/csv']), extensions: ['csv'] };
  const text = viewer('text', ['text/*']);
  const pdf = viewer('pdf', ['application/pdf']);
  const registry = createViewerRegistry([text, csv, pdf]);
  assert.equal(registry.select({ ...source, name: 'data.csv', mime: undefined }, bytes)?.id, 'table');
  assert.equal(registry.select({ ...source, name: 'data.csv', mime: 'text/plain' }, bytes)?.id, 'table');
  assert.equal(registry.select({ ...source, name: 'data.txt', mime: undefined }, bytes)?.id, 'text');
  assert.equal(registry.select({ ...source, name: 'data.csv', mime: undefined }, new TextEncoder().encode('%PDF-1.7'))?.id, 'pdf');
});
test('recognition validates text/PDF headers and does not treat invalid UTF-8 or binary controls as text', () => {
  assert.equal(identifyMime(new TextEncoder().encode('%PDF-1.7')), 'application/pdf');
  assert.equal(identifyMime(bytes, 'text/plain; charset=utf-8'), 'text/plain');
  assert.equal(identifyMime(new Uint8Array([0, 1])), 'application/octet-stream');
  assert.equal(identifyMime(new Uint8Array([255, 254])), 'application/octet-stream');
  assert.equal(identifyMime(new Uint8Array([65, 0xe2, 0x82])), 'text/plain');
});
test('full-document literal search finds virtualized lines, Unicode folds, CRLF and bounded results', () => {
  assert.deepEqual(findText(`${'line\r\n'.repeat(5000)}İ unique UNIQUE`, 'unique'), { lines: [5001, 5001], truncated: false });
  assert.deepEqual(findText('a\rb\rc', 'c').lines, [3]);
  assert.deepEqual(findText('aaaa', 'a', 2), { lines: [1, 1], truncated: true });
  assert.deepEqual(findText('aaaa', ''), { lines: [], truncated: false });
});
