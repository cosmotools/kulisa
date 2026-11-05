// What the human and agent keep of the pages (artifacts.ts): numbered files, the oldest gone past a limit.
// Plain Node (npm run test:unit), in a temporary folder of its own.
import { test, after } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { listArtifacts, saveArtifact } from '../../src/main/artifacts.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-artifacts-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('artifacts: each its own file, numbered in the order made, also when written at once; never one replacing another', async () => {
  const dir = path.join(root, 'task');
  const a = await saveArtifact(dir, 'p-t1-snapshot.yml', 'before');
  const [b, c] = await Promise.all([saveArtifact(dir, 'p-t1-snapshot.yml', 'after'), saveArtifact(dir, 'q-t2-screenshot.jpg', 'x')]);
  assert.deepEqual([a, b, c].map((f) => path.basename(f)), ['1-p-t1-snapshot.yml', '2-p-t1-snapshot.yml', '3-q-t2-screenshot.jpg']);
  assert.equal(fs.readFileSync(a, 'utf8'), 'before', 'two snapshots of one tab, both kept to compare');
});

test('artifacts: numbers go on from what the folder holds (Kulisa started again)', async () => {
  const dir = path.join(root, 'again');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, '7-p-t1-snapshot.yml'), '');
  assert.equal(path.basename(await saveArtifact(dir, 'p-t1-snapshot.yml', '')), '8-p-t1-snapshot.yml');
});

test('artifacts: past the limit the oldest go, the one just written stays', async () => {
  const dir = path.join(root, 'full');
  for (let i = 0; i < 3; i++) await saveArtifact(dir, 'a.txt', 'x'.repeat(40), 100);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['2-a.txt', '3-a.txt']);
  await saveArtifact(dir, 'big.txt', 'x'.repeat(500), 100);
  assert.deepEqual(fs.readdirSync(dir), ['4-big.txt'], 'one larger than the limit is kept alone');
});

test('artifacts: listed the newest first, whose and what each is from its name, its size; a file of another name left out', async () => {
  const dir = path.join(root, 'list');
  await saveArtifact(dir, 'p1-k1-screenshot.jpg', 'x');
  await saveArtifact(dir, 'p2-k3-snapshot.yml', 'y');
  fs.writeFileSync(path.join(dir, 'notes.txt'), '');
  assert.deepEqual((await listArtifacts(dir)).map(({ file, source, kind, bytes }) => [path.basename(file), source.id, kind, bytes]),
    [['2-p2-k3-snapshot.yml', 'p2', 'snapshot', 1], ['1-p1-k1-screenshot.jpg', 'p1', 'screenshot', 1]]);
  assert.deepEqual(await listArtifacts(path.join(root, 'none')), [], 'no folder yet: none');
});

test('artifacts identify Stage terminal screens separately from browser profiles', async () => {
  const dir = path.join(root, 'sources');
  await saveArtifact(dir, 'application-3-terminal.txt', 'terminal screen');
  await saveArtifact(dir, 'terminal-4-terminal.txt', 'new terminal screen');
  await saveArtifact(dir, 'application-t1-screenshot.jpg', 'browser picture');
  const list = await listArtifacts(dir);
  assert.deepEqual(list.map((a) => a.source), [{ kind: 'profile', id: 'application', tab: 't1' }, { kind: 'stage-terminal', id: 4 }, { kind: 'stage-terminal', id: 3 }]);
});
