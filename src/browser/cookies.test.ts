// Cookie synchronization rules; see README.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takes, details } from './main/cookie-sync.ts';

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
