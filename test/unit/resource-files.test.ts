import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { refused } from '../../src/shared/result.ts';
import { listResourceFiles, resourcePath } from '../../src/main/resource-files.ts';

test('resource directories are shallow, sorted, refreshed and confined to their task', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'kulisa-tree-'));
  try {
    const root = path.join(temp, 'project'), other = path.join(temp, 'project-other');
    await fs.mkdir(root); await fs.mkdir(other);
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'z.txt'), '');
    await fs.writeFile(path.join(root, '.hidden'), '');
    const result = await listResourceFiles([root], root);
    assert.equal(result.error, undefined);
    if (refused(result)) return;
    assert.deepEqual(result.entries.map((e) => [e.name, e.directory]), [['src', true], ['.hidden', false], ['z.txt', false]]);
    assert.ok((await listResourceFiles([root], other)).error);
    assert.ok((await resourcePath([root], path.join(root, '..', 'project-other'))).error);
    assert.equal((await listResourceFiles([root, other], other)).error, undefined);
    await fs.writeFile(path.join(root, 'new.txt'), '');
    const refreshed = await listResourceFiles([root], root);
    assert.ok(!refused(refreshed) && refreshed.entries.some((e) => e.name === 'new.txt'));
    assert.ok((await listResourceFiles([root], path.join(root, 'missing'))).error);
    await fs.symlink(other, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.ok((await listResourceFiles([root], path.join(root, 'link'))).error);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
