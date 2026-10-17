// What the log says of an action's arguments (log.ts, summary): a secret left out by its key or by its text, typed text
// left out, an address bare, the rest cut short.
import { test } from 'node:test';
import assert from 'assert/strict';
import { electronEvent, summary } from '../../src/main/log.ts';

test('log: summary leaves out secrets, typed text and addresses\' queries, and cuts the rest short', () => {
  assert.equal(summary({ profile: 'tess', user: 'tess', password: 'secret-tess' }), '{"profile":"tess","user":"tess","password":"…"}');
  assert.equal(summary({ apiToken: 'x', Cookie: 'y', credentials: { a: 1 } }), '{"apiToken":"…","Cookie":"…","credentials":"…"}');
  assert.equal(summary({ command: 'curl -H "Authorization: Bearer abc" x' }), '{"command":"[…]"}', 'by what the text says of itself');
  assert.equal(summary({ command: 'export TOKEN=abc' }), '{"command":"[…]"}');
  assert.equal(summary({ text: 'hello', values: { name: 'x' } }), '{"text":"…","values":"…"}', 'what the agent types into a page');
  assert.equal(summary({ url: 'https://me:ghp_abc@github.com/me/repo.git' }), '{"url":"https://…@github.com/me/repo.git"}');
  assert.equal(summary({ url: 'https://ghp_abc@github.com/me/repo.git' }), '{"url":"https://…@github.com/me/repo.git"}');
  assert.equal(summary({ url: 'http://localhost:3000/cb?code=abc&state=x#top' }), '{"url":"http://localhost:3000/cb?…"}');
  assert.equal(summary('x'.repeat(100)), `"${'x'.repeat(80)}…"`);
  assert.equal(summary({ a: 'x'.repeat(60), b: 'y'.repeat(60), c: 'z'.repeat(60) }, 100).length, 101);
  assert.equal(summary(undefined), '');
  assert.equal(summary(['shop/1', { n: 2 }]), '["shop/1",{"n":2}]');
});

test("log: Electron's events as a line of ours, the page's address bare, nothing appended by electron-log", () => {
  const wc = { id: 7, getURL: () => 'https://shop.test/cb?code=abc', isDestroyed: () => false };
  assert.deepEqual(electronEvent({ eventName: 'unresponsive', event: { sender: wc }, args: [] }), ['[electron] unresponsive wc=7 https://shop.test/cb?…']);
  assert.deepEqual(electronEvent({ eventName: 'render-process-gone', event: {}, args: [wc, { reason: 'crashed', exitCode: 5 }] }),
    ['[electron] render-process-gone wc=7 https://shop.test/cb?…', { reason: 'crashed', exitCode: 5 }]);
  assert.deepEqual(electronEvent({ eventName: 'child-process-gone', event: {}, args: [{ type: 'GPU', reason: 'killed' }] }), ['[electron] child-process-gone', { type: 'GPU', reason: 'killed' }]);
  assert.deepEqual(electronEvent({ eventName: 'preload-error', event: { sender: { ...wc, isDestroyed: () => true } }, args: ['/p.cjs', new Error('boom')] }),
    ['[electron] preload-error', { preload: '/p.cjs', error: 'Error: boom' }]);
});
