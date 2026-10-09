// The one rule for names (names.js): the characters of an email address, letters of any language; slugs for ids.
const { test } = require('node:test');
const assert = require('assert/strict');
const { nameError, slugOf } = require('../../src/main/names');

test('names: the characters of an email address, letters of any language', () => {
  for (const ok of ['ann+test@shop.com', 'ann_lee.admin', 'Анна', '花子', 'x'.repeat(64)]) assert.equal(nameError(ok), null, ok);
  for (const bad of ['', '@', '-', '_x', '-x', '.x', 'Ann admin', 'Sam · seller', 'a/b', '..', '.', 'x'.repeat(65)]) assert.ok(nameError(bad), bad);
  assert.equal(slugOf('花子@Shop.com', 'p'), '花子-shop-com');
});
