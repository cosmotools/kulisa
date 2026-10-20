// git for tasks (worktrees.ts): what a folder's repository is; a task on a branch there is already.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { repoOf, branches, adoptWorktree, removeWorktree, renameBranch } from '../../src/main/worktrees.ts';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-worktrees-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));

// macOS names its temporary folders through a symlink (/var is /private/var), and a human's folder may be one too:
// git answers with the real path, and a task got the project's own folder for its copy (2026-10-16).
test('a repository named through a symlink: its top as the folder is named, the folder at its top', async () => {
  const real = path.join(dir, 'real'), link = path.join(dir, 'link');
  fs.mkdirSync(path.join(real, 'web'), { recursive: true });
  execFileSync('git', ['init', '-q', real]);
  fs.symlinkSync(real, link);
  assert.deepEqual(await repoOf(link), { top: link, sub: '', commit: false });
  assert.deepEqual(await repoOf(path.join(link, 'web')), { top: link, sub: 'web', commit: false });
});

// A link into a repository (a monorepo's app named by a folder of its own): no name of its top through the link, so the
// real one; going up from the link reached a folder outside it (no repository, or another one).
test('a folder linked into a repository: its real top, the folder inside it', async () => {
  const mono = path.join(dir, 'mono'), app = path.join(dir, 'app');
  fs.mkdirSync(path.join(mono, 'apps', 'web'), { recursive: true });
  execFileSync('git', ['init', '-q', mono]);
  fs.symlinkSync(path.join(mono, 'apps', 'web'), app);
  const top = fs.realpathSync(mono);
  assert.deepEqual(await repoOf(app), { top, sub: path.join('apps', 'web'), commit: false });
  fs.symlinkSync(path.join(mono, 'apps', 'web'), path.join(mono, 'web'));
  assert.deepEqual(await repoOf(path.join(mono, 'web')), { top, sub: path.join('apps', 'web'), commit: false });
});

// A task on a branch there is already (New Task from a Branch…): one pushed from another computer, or the repository's
// own. Neither is renamed with the task, and the repository's own stays when the task goes: it is not the task's.
test('a task on a branch: the branches to work on, newest first, none checked out; its copy on it; the repository\'s own kept', async () => {
  Object.assign(process.env, { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' });
  const g = (cwd: string, ...a: string[]) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
  const origin = path.join(dir, 'origin.git'), shop = path.join(dir, 'shop'), mac = path.join(dir, 'mac');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  execFileSync('git', ['clone', '-q', origin, shop], { stdio: 'pipe' });
  g(shop, 'commit', '-q', '--allow-empty', '-m', 'first'); g(shop, 'push', '-q', 'origin', 'main');
  g(shop, 'branch', 'mine'); g(shop, 'branch', 'busy'); g(shop, 'worktree', 'add', '-q', path.join(dir, 'shop@busy'), 'busy');
  // Pushed from the other computer, after the others: the newest.
  execFileSync('git', ['clone', '-q', origin, mac], { stdio: 'pipe' });
  g(mac, 'switch', '-q', '-c', 'partner');
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'checked on macOS'], { cwd: mac, env: { ...process.env, GIT_COMMITTER_DATE: '2030-01-01T00:00:00' } });
  g(mac, 'push', '-q', 'origin', 'partner');
  const list = await branches(shop);
  assert.deepEqual(list.map((b) => [b.name, b.remote]), [['partner', true], ['mine', false]], 'not main (the project\'s folder) nor busy (a task\'s)');
  assert.equal(list[0].subject, 'checked on macOS');
  // The remote's: a local branch following it, deleted with the task; the remote's stays.
  const theirs = await adoptWorktree(shop, 'partner', null, []);
  assert.deepEqual([theirs.branch, theirs.existing, theirs.worktree], ['partner', 'remote', `${shop}@partner`]);
  assert.equal(g(theirs.worktree, 'rev-parse', '--abbrev-ref', '@{upstream}'), 'origin/partner', 'pushing goes back to it');
  assert.equal(theirs.base, g(shop, 'rev-parse', 'origin/partner'), 'what the task does comes after where it is now');
  assert.equal(await renameBranch([theirs], 'other-name'), 'partner', 'its name kept: its pull request\'s');
  await removeWorktree(theirs);
  assert.equal(g(shop, 'branch', '--list', 'partner'), '');
  assert.ok(g(shop, 'branch', '-r').includes('origin/partner'));
  // The repository's own: kept when the task goes.
  const own = await adoptWorktree(shop, 'mine', null, []);
  assert.equal(own.existing, 'local');
  await removeWorktree(own);
  assert.ok(!fs.existsSync(own.worktree));
  assert.equal(g(shop, 'branch', '--list', 'mine'), 'mine');
  await assert.rejects(adoptWorktree(shop, 'nowhere', null, []), /no branch nowhere/);
});
