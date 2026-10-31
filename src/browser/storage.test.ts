// Browser data survives copying and reopening; see README.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyProfile, readTabs, writeTabs } from './main/storage.ts';

test('a copied browser keeps storage and saved tabs, leaving caches and the open cookie database to its session', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-browser-'));
  try {
    const master = path.join(root, 'master'), copy = path.join(root, 'copy');
    const files = ['Local Storage/leveldb/data', 'IndexedDB/site/data', 'Network/Cookies', 'Network/Cookies-journal',
      'Cache/data', 'Code Cache/js/data', 'GPUCache/data', 'DawnGraphiteCache/data', 'Kulisa Session Cookies.bin'];
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(master, file)), { recursive: true });
      fs.writeFileSync(path.join(master, file), file);
    }
    const tabs = { urls: ['https://example.test/a', 'https://example.test/b'], active: 1 };
    writeTabs(master, tabs);
    await copyProfile(master, copy);
    assert.deepEqual(readTabs(copy), tabs);
    for (const file of ['Local Storage/leveldb/data', 'IndexedDB/site/data', 'Kulisa Session Cookies.bin']) {
      assert.equal(fs.readFileSync(path.join(copy, file), 'utf8'), file);
    }
    for (const file of ['Network/Cookies', 'Network/Cookies-journal', 'Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache']) {
      assert.equal(fs.existsSync(path.join(copy, file)), false, file);
    }
    writeTabs(copy, { urls: ['https://example.test/c'], active: 0 });
    assert.deepEqual(readTabs(master), tabs, 'a copy keeps its own tabs');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
