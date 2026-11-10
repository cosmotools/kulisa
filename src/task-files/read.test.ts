// Preview reads cannot escape owned regular files or allocate unbounded buffers (README.md).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFileRange } from './main/index.ts';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kulisa-preview-'));
after(() => fs.rm(root, { recursive: true, force: true }));
test('artifact reads are bounded ranges of regular files; missing files and invalid ranges return errors', async () => {
  const file = path.join(root, 'data.txt');
  await fs.writeFile(file, '0123456789');
  const read = await readFileRange(root, file, 3, 4);
  assert.ok('bytes' in read);
  assert.equal(new TextDecoder().decode(read.bytes), '3456');
  assert.equal(read.size, 10);
  const end = await readFileRange(root, file, 9, 100);
  assert.ok('bytes' in end); assert.equal(end.bytes.length, 1);
  for (const [offset, length] of [[-1, 1], [0, 4 * 1024 * 1024 + 1], [NaN, 1], [1.5, 1]] as const)
    assert.ok('error' in await readFileRange(root, file, offset, length));
  assert.ok('error' in await readFileRange(root, root, 0, 10));
  assert.ok('error' in await readFileRange(root, `${file}.missing`, 0, 10));
});
test('artifact reads reject paths outside their root and symlinks', async () => {
  const folder = path.join(root, 'task'); await fs.mkdir(folder);
  const outside = path.join(root, 'outside.txt'); await fs.writeFile(outside, 'private');
  assert.ok('error' in await readFileRange(folder, outside, 0, 10));
  // Windows developers may not have symlink privileges; containment itself is checked above on every OS.
  if (process.platform !== 'win32') {
    const link = path.join(folder, 'link.txt'); await fs.symlink(outside, link);
    assert.ok('error' in await readFileRange(folder, link, 0, 10));
    const inner = path.join(folder, 'inner.txt'); await fs.writeFile(inner, 'inside');
    const innerLink = path.join(folder, 'inside-link.txt'); await fs.symlink(inner, innerLink);
    assert.ok('error' in await readFileRange(folder, innerLink, 0, 10));
    const directoryLink = path.join(root, 'directory-link'); await fs.symlink(folder, directoryLink, 'dir');
    assert.ok('error' in await readFileRange(root, path.join(directoryLink, 'inner.txt'), 0, 10));
    assert.ok('error' in await readFileRange(directoryLink, path.join(directoryLink, 'inner.txt'), 0, 10));
  }
});
test('read revisions match listings and invalidate same-sized replacements with the same modification time', async () => {
  const folder = path.join(root, 'revision'); await fs.mkdir(folder);
  const file = path.join(folder, 'report.txt'), replacement = path.join(folder, 'replacement.txt');
  await fs.writeFile(file, 'before');
  const { listArtifacts } = await import('./main/index.ts');
  const before = (await listArtifacts(folder))[0]!;
  const read = await readFileRange(folder, file, 0, 10);
  assert.ok('revision' in read); assert.equal(read.revision, before.revision);
  const stat = await fs.stat(file);
  await fs.writeFile(replacement, 'after!'); await fs.utimes(replacement, stat.atime, stat.mtime);
  await fs.rename(replacement, file);
  const after = await readFileRange(folder, file, 0, 10);
  assert.ok('revision' in after); assert.equal(after.size, before.bytes);
  assert.notEqual(after.revision, before.revision);
});
