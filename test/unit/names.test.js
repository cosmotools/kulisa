// The one rule for names (names.js): the characters of an email address, letters of any language; slugs for ids.
const { test } = require('node:test');
const assert = require('assert/strict');
const { nameError, slugOf } = require('../../src/main/names');

test('names: the characters of an email address, letters of any language', () => {
  for (const ok of ['ann+test@shop.com', 'ann_lee.admin', 'Анна', '花子', 'x'.repeat(64)]) assert.equal(nameError(ok), null, ok);
  for (const bad of ['', '@', '-', '_x', '-x', '.x', 'Ann admin', 'Sam · seller', 'a/b', '..', '.', 'x'.repeat(65)]) assert.ok(nameError(bad), bad);
  assert.equal(slugOf('花子@Shop.com', 'p'), '花子-shop-com');
});

test('local addresses: a pair is typed on the developer\'s own machine or network, or a page a local one led to, never on a big provider', () => {
  const { isLocal, loginAllowed } = require('../../src/main/local');
  for (const u of ['http://localhost:3000/', 'http://shop.localhost/', 'http://127.0.0.1:4417/app', 'http://[::1]:8080/', 'http://192.168.1.20/',
    'http://10.0.0.5/', 'http://172.20.0.2/', 'https://shop.test/', 'http://printer.local/']) assert.ok(isLocal(u), u);
  for (const u of ['https://shop.com/', 'http://172.32.0.1/', 'https://localhost.evil.com/', 'not a url', 'https://test.com/']) assert.ok(!isLocal(u), u);
  assert.ok(isLocal('https://abc.ngrok.app/login', ['ngrok.app']), "the project's own list");
  assert.ok(loginAllowed(['http://localhost:3000/', 'https://dev-x.auth0.com/login']), 'reached from a local page in the same tab');
  assert.ok(!loginAllowed(['http://localhost:3000/', 'https://accounts.google.com/signin']), 'never a big provider');
  assert.ok(!loginAllowed(['https://login.microsoftonline.com/x']));
  assert.ok(!loginAllowed(['https://example.com/', 'https://dev-x.auth0.com/login']), 'not reached from a local page');
});
