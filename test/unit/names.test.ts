// The one rule for names (names.ts): a readable label (spaces allowed), the characters of an email address, letters
// of any language; slugs for ids.
import { test } from 'node:test';
import assert from 'assert/strict';
import { nameError, slugOf } from '../../src/shared/names.ts';
import { isLocal, loginAllowed } from '../../src/main/local.ts';
import { takes, details } from '../../src/main/cookie-sync.ts';

test('names: a readable label with spaces, the characters of an email address, letters of any language', () => {
  for (const ok of ['ann+test@shop.com', 'ann_lee.admin', 'Анна', '花子', 'Fix header', 'x'.repeat(64)]) assert.equal(nameError(ok), null, ok);
  for (const bad of ['', '@', '-', '_x', '-x', '.x', ' x', 'Sam · seller', 'a/b', '..', '.', 'x'.repeat(65)]) assert.ok(nameError(bad), bad);
  assert.equal(slugOf('Fix header', 'p'), 'fix-header');
  assert.equal(slugOf('花子@Shop.com', 'p'), '花子-shop-com');
});

test('local addresses: a pair is typed on the developer\'s own machine or network, or a page a local one led to, never on a big provider', () => {
  for (const u of ['http://localhost:3000/', 'http://shop.localhost/', 'http://127.0.0.1:4417/app', 'http://[::1]:8080/', 'http://192.168.1.20/',
    'http://10.0.0.5/', 'http://172.20.0.2/', 'https://shop.test/', 'http://printer.local/']) assert.ok(isLocal(u), u);
  // IPv6's private and link-local addresses, and IPv4 written as IPv6 (URL makes ::ffff:127.0.0.1 ::ffff:7f00:1): the
  // regular expressions before ipaddr.js missed them.
  for (const u of ['http://[::ffff:127.0.0.1]:3000/', 'http://[::ffff:192.168.1.20]/', 'http://[fd12:3456::1]/', 'http://[fe80::1]/',
    'http://169.254.1.1/']) assert.ok(isLocal(u), u);
  for (const u of ['https://shop.com/', 'http://172.32.0.1/', 'https://localhost.evil.com/', 'not a url', 'https://test.com/',
    'http://8.8.8.8/', 'http://[2001:4860::8888]/', 'http://[::ffff:8.8.8.8]/', 'http://127.0.0.1.nip.io/']) assert.ok(!isLocal(u), u);
  assert.ok(isLocal('https://abc.ngrok.app/login', ['ngrok.app']), "the project's own list");
  assert.ok(loginAllowed(['http://localhost:3000/', 'https://dev-x.auth0.com/login']), 'reached from a local page in the same tab');
  assert.ok(!loginAllowed(['http://localhost:3000/', 'https://accounts.google.com/signin']), 'never a big provider');
  assert.ok(!loginAllowed(['https://login.microsoftonline.com/x']));
  assert.ok(!loginAllowed(['https://example.com/', 'https://dev-x.auth0.com/login']), 'not reached from a local page');
});

test("real accounts kept in step: a non-local site's cookie set or removed by the site is taken; a local one, a replaced or expired one is not", () => {
  const c = (domain: string, more = {}) => ({ name: 'sid', value: 'v', domain, path: '/', secure: true, httpOnly: true, sameSite: 'lax', ...more }) as Electron.Cookie;
  assert.ok(takes({ cookie: c('.github.com'), cause: 'inserted' }));
  assert.ok(takes({ cookie: c('.github.com'), cause: 'explicit', removed: true }), 'removed');
  assert.ok(takes({ cookie: c('.github.com'), cause: 'expired-overwrite', removed: true }), 'a sign-out: the site sends it expired');
  assert.ok(!takes({ cookie: c('.github.com'), cause: 'overwrite', removed: true }), 'replaced: its new value comes as its own change');
  assert.ok(!takes({ cookie: c('.github.com'), cause: 'expired', removed: true }));
  assert.ok(!takes({ cookie: c('localhost'), cause: 'inserted' }), "a local app's: each task's own");
  assert.ok(!takes({ cookie: c('abc.ngrok.app'), cause: 'inserted' }, ['ngrok.app']), "the project's own local list");
  assert.deepEqual(details(c('.github.com', { session: true })), { url: 'https://github.com/', name: 'sid', value: 'v', path: '/', secure: true, httpOnly: true, sameSite: 'lax', domain: '.github.com' });
  assert.equal(details(c('github.com', { hostOnly: true, expirationDate: 99 })).expirationDate, 99);
  assert.equal(details(c('github.com', { hostOnly: true })).domain, undefined);
});
