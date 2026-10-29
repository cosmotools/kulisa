// A folder removed with all in it (src/main/remove.ts), by Electron's own Node, which Kulisa runs on: a read-only file
// (git's objects) too, a junction or link in it as a link, what it points to left as it is, and an .asar as a file.
import { test } from 'node:test';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import electron from 'electron';
import { createPackage } from '@electron/asar';
import { removeTree } from '../../src/main/remove.ts';

test('remove: a locked profile file leaves only the locked part; artifacts and unlocked siblings go, and retry removes the rest', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-remove-'));
  const dir = path.join(root, 'task'), profile = path.join(dir, '0-profile'), artifacts = path.join(dir, 'artifacts');
  fs.mkdirSync(profile, { recursive: true });
  fs.mkdirSync(artifacts);
  const locked = path.join(profile, '0-journal'), unlocked = path.join(profile, '1-cache'), shot = path.join(artifacts, 'screenshot.png');
  for (const file of [locked, unlocked, shot]) fs.writeFileSync(file, 'x');
  const busy = Object.assign(new Error('file is locked'), { code: 'EBUSY', path: locked });
  const unlink = fs.unlinkSync;
  const lock = t.mock.method(fs, 'unlinkSync', (file: fs.PathLike) => {
    if (file === locked) throw busy;
    return unlink(file);
  });
  try {
    assert.throws(() => removeTree(dir), (e) => e === busy);
    assert.ok(!fs.existsSync(shot), 'the locked profile does not keep task artifacts');
    assert.ok(!fs.existsSync(unlocked), 'unlocked files inside the profile go too');
    assert.ok(fs.existsSync(locked), 'the locked file stays for retry');
    lock.mock.restore();
    removeTree(dir);
    removeTree(dir);
    assert.ok(!fs.existsSync(dir), 'retry removes the remaining task data');
  } finally {
    lock.mock.restore();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('remove: a folder with a read-only file in it goes; a link in it goes as a link, not into what it points to; an .asar as a file', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-remove-'));
  const dir = path.join(root, 'repo'), kept = path.join(root, 'kept');
  fs.mkdirSync(path.join(dir, '.git', 'objects', 'ab'), { recursive: true });
  fs.mkdirSync(kept);
  fs.writeFileSync(path.join(kept, 'f'), 'x');
  const object = path.join(dir, '.git', 'objects', 'ab', 'cdef');
  fs.writeFileSync(object, 'x');
  fs.chmodSync(object, 0o444);
  fs.symlinkSync(kept, path.join(dir, 'node_modules'), 'junction');
  await createPackage(kept, path.join(dir, 'app.asar'));
  const script = `import { removeTree } from ${JSON.stringify(pathToFileURL(path.resolve('src/main/remove.ts')).href)}; removeTree(${JSON.stringify(dir)}); removeTree(${JSON.stringify(dir)});`;
  const r = spawnSync(electron as unknown as string, ['--input-type=module', '-e', script], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' });
  const gone = !fs.existsSync(dir), stays = fs.existsSync(path.join(kept, 'f'));
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(gone, 'the folder went (and once gone, removing it again is no error)');
  assert.ok(stays, 'what the link points to is untouched');
});
