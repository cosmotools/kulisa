// Task results are ordinary filesystem entries; no quota, implicit registration or automatic expiry (docs/tasks.md).
import { test, after } from 'node:test';
import assert from 'assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TaskFiles, listArtifacts, saveArtifact, deleteFiles, ownedPath } from './main/index.ts';
import { previewable } from './main/preview.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-artifacts-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('generated results use exclusive creation across concurrent writers and existing files', async () => {
  const dir = path.join(root, 'concurrent');
  const first = await saveArtifact(dir, 'p-t1-snapshot.yml', 'before');
  const files = await Promise.all(Array.from({ length: 12 }, (_, i) => saveArtifact(dir, 'p-t1-snapshot.yml', `after ${i}`)));
  assert.equal(new Set(files).size, 12);
  assert.equal(fs.readFileSync(first, 'utf8'), 'before');
  for (const [i, file] of files.entries()) assert.equal(fs.readFileSync(file, 'utf8'), `after ${i}`);
  fs.writeFileSync(path.join(dir, '50-p-t1-snapshot.yml'), 'existing');
  assert.equal(path.basename(await saveArtifact(dir, 'p-t1-snapshot.yml', '')), '51-p-t1-snapshot.yml');
});

test('large results stay, including after another result is saved', async () => {
  const dir = path.join(root, 'large'); fs.mkdirSync(dir);
  const large = path.join(dir, 'report.bin');
  const fd = fs.openSync(large, 'w'); fs.ftruncateSync(fd, 110 * 1024 * 1024); fs.closeSync(fd);
  await saveArtifact(dir, 'notes.txt', 'keep both');
  assert.equal(fs.statSync(large).size, 110 * 1024 * 1024);
  assert.equal((await listArtifacts(dir)).length, 2);
});

test('ordinary filenames, nested files and empty folders appear without registration; changes update revisions', async () => {
  const dir = path.join(root, 'ordinary'); fs.mkdirSync(path.join(dir, 'html', 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'empty')); fs.writeFileSync(path.join(dir, 'html', 'index.html'), 'hello');
  fs.writeFileSync(path.join(dir, 'Отчёт.txt'), 'one');
  const before = await listArtifacts(dir);
  assert.deepEqual(before.map((a) => a.path).sort(), ['empty/', 'html/', 'html/assets/', 'html/index.html', 'Отчёт.txt'].sort());
  assert.equal(before.find((a) => a.path === 'html/index.html')!.source, undefined);
  assert.equal(before.find((a) => a.path === 'empty/')!.directory, true);
  fs.writeFileSync(path.join(dir, 'Отчёт.txt'), 'a different result');
  const after = await listArtifacts(dir);
  assert.notEqual(before.find((a) => a.path === 'Отчёт.txt')!.revision, after.find((a) => a.path === 'Отчёт.txt')!.revision);
  assert.deepEqual(await listArtifacts(path.join(root, 'absent')), []);
});

test('generated screenshots and terminal files retain their optional source metadata', async () => {
  const dir = path.join(root, 'provenance');
  await saveArtifact(dir, 'terminal-4-terminal.txt', 'terminal');
  await saveArtifact(dir, 'application-t1-screenshot.jpg', 'image');
  assert.deepEqual((await listArtifacts(dir)).map((a) => a.source), [
    { kind: 'stage-terminal', id: 4 }, { kind: 'profile', id: 'application', tab: 't1' },
  ]);
});

test('folder deletion counts descendants once; Delete All results leaves the adjacent temporary folder', async () => {
  const task = path.join(root, 'delete'), dir = path.join(task, 'artifacts');
  fs.mkdirSync(path.join(dir, 'report'), { recursive: true }); fs.writeFileSync(path.join(dir, 'report', 'a.txt'), 'abc');
  fs.mkdirSync(path.join(task, 'tmp', 'agent-one'), { recursive: true }); fs.writeFileSync(path.join(task, 'tmp', 'agent-one', 'working.txt'), 'keep');
  assert.deepEqual(await deleteFiles(dir, [path.join(dir, 'report'), path.join(dir, 'report', 'a.txt')]), { deleted: 2, bytes: 3 });
  await saveArtifact(dir, 'result.txt', 'result'); await deleteFiles(dir, null);
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.equal(fs.readFileSync(path.join(task, 'tmp', 'agent-one', 'working.txt'), 'utf8'), 'keep');
  assert.ok('error' in await deleteFiles(dir, [path.join(task, 'tmp', 'agent-one', 'working.txt')]));
});

test('symbolic links and traversal cannot include, open or delete files outside results', async (t) => {
  const dir = path.join(root, 'links'), outside = path.join(root, 'outside');
  fs.mkdirSync(dir); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'important.txt'), 'keep');
  try { fs.symlinkSync(outside, path.join(dir, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EPERM') return t.skip('Creating links requires OS privileges.'); throw error; }
  assert.deepEqual(await listArtifacts(dir), []);
  assert.equal(await ownedPath(dir, path.join(dir, 'linked', 'important.txt')), false);
  assert.equal(await ownedPath(dir, path.join(dir, '..', 'outside', 'important.txt')), false);
  assert.ok('error' in await deleteFiles(dir, [path.join(dir, 'linked')]));
  await deleteFiles(dir, null);
  assert.equal(fs.readFileSync(path.join(outside, 'important.txt'), 'utf8'), 'keep');
  assert.deepEqual(await listArtifacts(path.join(dir, 'linked')), []);
  await assert.rejects(saveArtifact(path.join(dir, 'linked'), 'a.txt', 'bad'), /symbolic link/);
});

test('thumbnail headers reject huge dimensions, unknown images and truncated JPEGs before decoding', () => {
  const png = Buffer.alloc(24); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(1200, 16); png.writeUInt32BE(900, 20); assert.equal(previewable(png), true);
  png.writeUInt32BE(100000, 16); assert.equal(previewable(png), false);
  for (const bytes of [[0xff, 0xd8, 0xff, 0xff], [0xff, 0xd8, 0xff, 0xc0]]) assert.equal(previewable(Buffer.from(bytes)), false);
  assert.equal(previewable(Buffer.from('<svg/>')), false);
});

test('disposing while previews are being requested cannot notify or retain work after unload', async () => {
  const artifacts = path.join(root, 'disposed'); fs.mkdirSync(artifacts);
  const file = path.join(artifacts, 'invalid.png'); fs.writeFileSync(file, 'unknown image');
  let changes = 0;
  const results = new TaskFiles({ directory: root, artifacts, prepare: () => true, isOpen: () => true,
    changed: async () => { changes++; }, activity: () => {} });
  const pending = results.thumbnails([file]);
  results.dispose(); await pending;
  results.changed();
  assert.equal(changes, 0);
});
