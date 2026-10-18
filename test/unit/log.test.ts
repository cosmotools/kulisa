// What the log says of an action's arguments (log.ts, summary): a secret left out by its key or by its text, typed text
// left out, an address bare, the rest cut short.
import { test } from 'node:test';
import assert from 'assert/strict';
import { electronEvent, environment, issueUrl, quitSaid, stamp, summary } from '../../src/main/log.ts';

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

test('log: the environment a report names is the start line\'s, in the issue\'s address for its field', () => {
  assert.match(environment(), /^\d+\.\d+\.\d+, electron (\d+\.\d+\.\d+|undefined), \w+ \S+( \(\w+\))?, from source$/);
  const u = new URL(issueUrl('0.1.4, electron 44.8.0, linux 7.0.0 (wayland), packaged'));
  assert.equal(u.href.split('?')[0], 'https://github.com/cosmotools/kulisa/issues/new');
  assert.deepEqual([u.searchParams.get('template'), u.searchParams.get('environment')], ['bug.yml', 'Kulisa 0.1.4, electron 44.8.0, linux 7.0.0 (wayland), packaged']);
});

test('log: the time as ISO 8601 with the offset; whether the run before said it quit, read from the file\'s end', () => {
  assert.match(stamp(new Date(2026, 9, 18, 14, 5, 25, 77)), /^2026-10-18T14:05:25\.077[+-]\d\d:\d\d$/);
  assert.match(stamp(new Date(2026, 0, 2, 3, 4, 5, 6)), /^2026-01-02T03:04:05\.006[+-]\d\d:\d\d$/, 'padded');
  const start = '[x] [kulisa] start 0.1.4\n', quit = '[x] [kulisa] quitting\n', running = '[x] [kulisa] already running with /d\n';
  assert.equal(quitSaid(null), null, 'no file: a first start');
  assert.equal(quitSaid(start + '[x] [task] open\n' + quit + '[x] [window] dropped\n'), true);
  assert.equal(quitSaid(start + '[x] [task] open\n'), false, 'crashed, killed or the computer went down');
  assert.equal(quitSaid(quit + start + '[x] [task] open\n'), false, 'an earlier run\'s quitting does not count');
  assert.equal(quitSaid(start + running + quit), true, 'a second Kulisa\'s start and exit, then the first one\'s quitting');
  assert.equal(quitSaid(start + running), false);
  assert.equal(quitSaid('[x] [task] open\n' + quit + '[x] [window] dropped\n'), true, 'a long run: its start past the tail');
});
