// The version installed on disk while Kulisa runs (installed.ts): read from an app archive as Forge packs it.
// Plain Node (npm run test:unit): the archives made with @electron/asar, the packer's own, in a temporary folder.
import { test, after } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createPackage } from '@electron/asar';
import { installedVersion, watchInstalled } from '../../src/main/installed.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-unit-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const asar = path.join(root, 'resources', 'app.asar');

// An archive of version, with a file before package.json in it (the offset read is not the first file's), written
// beside and renamed over, as dpkg does.
async function pack(version: string) {
  const src = path.join(root, 'src');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'index.js'), 'console.log("Kulisa")\n');
  fs.writeFileSync(path.join(src, 'package.json'), JSON.stringify({ name: 'kulisa', version, main: 'index.js' }));
  fs.mkdirSync(path.dirname(asar), { recursive: true });
  await createPackage(src, `${asar}.dpkg-new`);
  // createPackage resolves before its file is all written (@electron/asar 3.4.1 ends its stream without waiting for
  // it): read back half written on a busy disk, it had no version, now and then.
  for (const end = Date.now() + 5000; installedVersion(`${asar}.dpkg-new`) !== version && Date.now() < end;) await new Promise((r) => setTimeout(r, 20));
  fs.renameSync(`${asar}.dpkg-new`, asar);
}

test('the installed version is read from the app archive on disk; none when there is no archive', async () => {
  assert.equal(installedVersion(asar), null, 'not installed');
  await pack('0.1.4');
  assert.equal(installedVersion(asar), '0.1.4');
  fs.writeFileSync(asar, 'not an archive');
  assert.equal(installedVersion(asar), null);
});

test('a new version installed is found once, as the archive changes; the running one, or the same again, is not', async () => {
  const found: string[] = [];
  const { check } = watchInstalled(asar, '0.1.4', (v) => found.push(v));
  await pack('0.1.4');
  check();
  assert.deepEqual(found, [], 'the version running');
  await pack('0.1.5');
  check();
  check();
  assert.deepEqual(found, ['0.1.5'], 'once');
  await pack('0.1.5');
  check();
  assert.deepEqual(found, ['0.1.5'], 'the same again');
  await pack('0.1.6');
  check();
  assert.deepEqual(found, ['0.1.5', '0.1.6']);
});
