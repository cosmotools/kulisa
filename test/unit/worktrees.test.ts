// git for tasks (worktrees.ts): what a folder's repository is, whether a task's copy is merged.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { git, gitBuffer, repoOf, merged } from '../../src/main/worktrees.ts';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-worktrees-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));

// macOS names its temporary folders through a symlink (/var is /private/var), and a human's folder may be one too:
// git answers with the real path, and a task must not get the project's own folder for its copy.
test('a repository named through a symlink: its top as the folder is named, the folder at its top', async () => {
  const real = path.join(dir, 'real'), link = path.join(dir, 'link');
  fs.mkdirSync(path.join(real, 'web'), { recursive: true });
  execFileSync('git', ['init', '-q', real]);
  fs.symlinkSync(real, link, 'junction'); // a junction on Windows: a symlink there needs a privilege
  assert.deepEqual(await repoOf(link), { top: link, sub: '', commit: false });
  assert.deepEqual(await repoOf(path.join(link, 'web')), { top: link, sub: 'web', commit: false });
});

// A link into a repository (a monorepo's app named by a folder of its own): no name of its top through the link, so the
// real one; going up from the link reached a folder outside it (no repository, or another one).
test('a folder linked into a repository: its real top, the folder inside it', async () => {
  const mono = path.join(dir, 'mono'), app = path.join(dir, 'app');
  fs.mkdirSync(path.join(mono, 'apps', 'web'), { recursive: true });
  execFileSync('git', ['init', '-q', mono]);
  fs.symlinkSync(path.join(mono, 'apps', 'web'), app, 'junction');
  const top = fs.realpathSync.native(mono);
  assert.deepEqual(await repoOf(app), { top, sub: path.join('apps', 'web'), commit: false });
  fs.symlinkSync(path.join(mono, 'apps', 'web'), path.join(mono, 'web'), 'junction');
  assert.deepEqual(await repoOf(path.join(mono, 'web')), { top, sub: path.join('apps', 'web'), commit: false });
});

// A task's copy whose PR is merged on the remote (merged): its commits in the remote's default branch as they are, or
// made anew there by a squash or a rebase merge, as GitHub's buttons do.
function remoteRepo(name: string) {
  const origin = path.join(dir, `${name}.git`), top = path.join(dir, name), worktree = `${top}@task`;
  const run = (cwd: string, ...a: string[]) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
  run(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  fs.mkdirSync(top); run(top, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.name', 't'], ['user.email', 't@t'], ['commit.gpgsign', 'false']]) run(top, 'config', k, v);
  const commit = (cwd: string, file: string, text: string) => { fs.writeFileSync(path.join(cwd, file), text); run(cwd, 'add', '-A'); run(cwd, 'commit', '-qm', file); };
  commit(top, 'a.txt', 'a\n');
  run(top, 'remote', 'add', 'origin', origin); run(top, 'push', '-q', 'origin', 'main'); run(top, 'remote', 'set-head', 'origin', 'main');
  const base = run(top, 'rev-parse', 'HEAD');
  run(top, 'worktree', 'add', '-q', '-b', 'task', worktree, base);
  // The remote's main changed by someone else: a clone of it, its commit pushed.
  const elsewhere = (fn: (clone: string) => void) => {
    const clone = fs.mkdtempSync(path.join(dir, 'clone-'));
    run(dir, 'clone', '-q', origin, clone);
    for (const [k, v] of [['user.name', 'o'], ['user.email', 'o@o'], ['commit.gpgsign', 'false']]) run(clone, 'config', k, v);
    fn(clone);
    run(clone, 'push', '-q', 'origin', 'main');
  };
  const copy = { repo: top, worktree, branch: 'task', base, folder: worktree };
  return { run, commit, elsewhere, copy, worktree };
}

test('merged: a squash merge on the remote, also once main has gone on; not with a commit of the task not in it', async () => {
  const { run, commit, elsewhere, copy, worktree } = remoteRepo('squash');
  commit(worktree, 'b.txt', 'b\n'); commit(worktree, 'c.txt', 'c\n');
  assert.equal(await merged(copy), false);
  elsewhere((clone) => {
    run(clone, 'fetch', '-q', copy.repo, 'task');
    run(clone, 'merge', '-q', '--squash', 'FETCH_HEAD'); run(clone, 'commit', '-qm', 'task (#1)');
    fs.writeFileSync(path.join(clone, 'd.txt'), 'd\n'); run(clone, 'add', '-A'); run(clone, 'commit', '-qm', 'd');
  });
  assert.equal(await merged(copy), true);
  commit(worktree, 'e.txt', 'e\n');
  assert.equal(await merged(copy), false);
});

test('merged: a rebase merge on the remote; not with a file of the task uncommitted', async () => {
  const { run, commit, elsewhere, copy, worktree } = remoteRepo('rebase');
  commit(worktree, 'b.txt', 'b\n'); commit(worktree, 'c.txt', 'c\n');
  elsewhere((clone) => {
    fs.writeFileSync(path.join(clone, 'd.txt'), 'd\n'); run(clone, 'add', '-A'); run(clone, 'commit', '-qm', 'd');
    run(clone, 'fetch', '-q', copy.repo, 'task');
    run(clone, 'cherry-pick', `${copy.base}..FETCH_HEAD`);
  });
  assert.equal(await merged(copy), true);
  fs.writeFileSync(path.join(worktree, 'b.txt'), 'changed\n');
  assert.equal(await merged(copy), false);
});

// The Git client carries stdin and exact bytes for patches, ignored paths and blob batches.
test('Git client preserves binary input/output, whitespace, errors and output limits', async () => {
  const folder = fs.mkdtempSync(path.join(dir, 'client-'));
  execFileSync('git', ['init', '-q', folder]);
  await assert.rejects(git(folder, ['rev-parse', '--verify', '--quiet', 'refs/heads/missing']));
  assert.equal(await git(folder, ['patch-id', '--stable'], { input: '', timeout: 500 }), '');
  const oid = await git(folder, ['hash-object', '-w', '--stdin'], { input: ' leading\ntrailing \n' });
  const bytes = await gitBuffer(folder, ['cat-file', '--batch'], { input: `${oid}\n` });
  assert(bytes.includes(Buffer.from(' leading\ntrailing \n')));
  const text = await git(folder, ['cat-file', 'blob', oid], { trim: false });
  assert.equal(text, ' leading\ntrailing \n');
  const binary = Buffer.from([0, 0xff, 0xc0, 0x80, 10]);
  const binaryOid = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: folder, input: binary, encoding: 'utf8' }).trim();
  assert.deepEqual(await gitBuffer(folder, ['cat-file', 'blob', binaryOid]), binary);
  await assert.rejects(gitBuffer(folder, ['cat-file', 'blob', oid], { maxBuffer: 2 }), /output exceeds/);
  await assert.rejects(git(folder, ['cat-file', 'blob', 'missing-object']), (e: Error & { stderr?: string }) => !!e.stderr);
});
