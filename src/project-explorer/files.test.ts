import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { refused } from '../shared/result.ts';
import { listResourceFiles, listResourceGitStatus, resourcePath } from './main/index.ts';
import { git } from '../main/worktrees.ts';

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

test('Project Git status preserves filenames, renames and ignored folders within a resource', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'kulisa-tree-git-'));
  try {
    const root = path.join(temp, 'repo'), sub = path.join(root, 'src');
    await fs.mkdir(sub, { recursive: true });
    await git(root, ['init', '-q']);
    for (const name of ['changed.txt', 'deleted.txt', 'old name.txt', 'src/nested.txt']) await fs.writeFile(path.join(root, name), 'original\n');
    await fs.writeFile(path.join(root, '.gitignore'), 'ignored/\n*.log\n');
    await git(root, ['add', '.']);
    await git(root, ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Initial']);
    await fs.writeFile(path.join(root, 'changed.txt'), 'modified\n');
    await fs.rm(path.join(root, 'deleted.txt'));
    await git(root, ['mv', 'old name.txt', 'renamed name.txt']);
    await fs.writeFile(path.join(root, 'added.txt'), 'added\n'); await git(root, ['add', 'added.txt']);
    const unusual = process.platform === 'win32' ? 'src/untracked space.txt' : 'src/untracked\nwith\ttabs.txt';
    await fs.writeFile(path.join(root, unusual), 'untracked\n');
    await fs.mkdir(path.join(root, 'ignored')); await fs.writeFile(path.join(root, 'ignored', 'build.txt'), 'ignored\n');
    await fs.writeFile(path.join(root, 'src', 'debug.log'), 'ignored\n');
    const result = await listResourceGitStatus(root, git);
    assert.equal(result.error, undefined);
    if (refused(result)) return;
    assert.deepEqual(new Map(result.entries.map((entry) => [entry.path, entry.status])), new Map([
      ['changed.txt', 'modified'], ['deleted.txt', 'deleted'], ['renamed name.txt', 'renamed'], ['added.txt', 'added'],
      [unusual, 'untracked'], ['ignored/', 'ignored'], ['src/debug.log', 'ignored'],
    ]));
    assert.deepEqual(await listResourceGitStatus(sub, git), { entries: [
      { path: unusual.slice(4), status: 'untracked' }, { path: 'debug.log', status: 'ignored' },
    ] });
    assert.deepEqual(await listResourceGitStatus(path.join(root, 'ignored'), git), { entries: [{ path: '', status: 'ignored' }] });
    await git(root, ['mv', 'src/nested.txt', 'outside.txt']);
    const moved = await listResourceGitStatus(sub, git);
    assert.ok(!refused(moved) && moved.entries.some((entry) => entry.path === 'nested.txt' && entry.status === 'deleted'));
    assert.deepEqual(await listResourceGitStatus(temp, git), { entries: [] });
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
