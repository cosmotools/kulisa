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
