// The rules for names (names.ts): the characters of an email address, letters of any language; a task's, a label;
// slugs for ids, and portable names for new project folders.
import { test } from 'node:test';
import assert from 'assert/strict';
import { nameError, folderNameError, labelError, slugOf } from '../../src/shared/names.ts';
import { isLocal, loginAllowed } from '../../src/main/local.ts';

test("names: the characters of an email address, letters of any language; a task's, any one line with a letter or a digit", () => {
  for (const ok of ['ann+test@shop.com', 'ann_lee.admin', 'Анна', '花子', 'x'.repeat(64)]) assert.equal(nameError(ok), null, ok);
  for (const bad of ['', '@', '-', '_x', '-x', '.x', 'Ann admin', 'Sam · seller', 'a/b', '..', '.', 'x'.repeat(65)]) assert.ok(nameError(bad), bad);
  for (const ok of ['Fix header', 'Checkout: 3-D Secure (EU)', 'Анна', 'x'.repeat(64)]) assert.equal(labelError(ok), null, ok);
  for (const bad of ['', '--', '…', 'a\nb', 'a\tb', 'x'.repeat(65)]) assert.ok(labelError(bad), bad);
  assert.equal(slugOf('Fix header', 'p'), 'fix-header');
  assert.equal(slugOf('花子@Shop.com', 'p'), '花子-shop-com');
});

test('new project folders: portable ASCII names, including dots, without Windows device names or path traversal', () => {
  for (const ok of ['shop.v2', 'My-Project_2026', '1', 'con-tools', 'null', 'report.con', 'x'.repeat(64)])
    assert.equal(folderNameError(ok), null, ok);
  for (const bad of ['', '.hidden', '-option', '_tools', '.', '..', '../shop', 'a/b', 'a\\b', 'shop.', 'shop ',
    'my shop', 'shop@home', 'shop+tools', 'Магазин', '花子', 'x\ny', 'x\n', 'x\r', 'x\0y', 'x'.repeat(65)])
    assert.ok(folderNameError(bad), bad);
  for (const device of ['CON', 'PRN', 'AUX', 'NUL', ...Array.from({ length: 9 }, (_, i) => [`COM${i + 1}`, `LPT${i + 1}`]).flat()]) {
    assert.ok(folderNameError(device), device);
    assert.ok(folderNameError(`${device.toLowerCase()}.v2`), `${device}.v2`);
  }
  assert.equal(labelError('Мой магазин (v2)'), null, 'display names keep their own rules');
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
