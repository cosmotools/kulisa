// Local review compares actual Git history and worktree contents, including unusual paths.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { refused } from '../shared/result.ts';
import { listDiff, listDiffTargets, readDiff, loadReview } from './main/diff.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-diff-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const run = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const working = { to: 'HEAD' } as const, task = { to: 'main' } as const;
function repo() {
  const dir = fs.mkdtempSync(path.join(root, 'repo-'));
  run(dir, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['user.name', 'test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']] as const) run(dir, 'config', key, value);
  const write = (name: string, text: string | Buffer) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), text); };
  const commit = () => { run(dir, 'add', '-A'); run(dir, 'commit', '-qm', 'changes'); };
  write('src/a.ts', '  before\n\n'); write('delete.txt', 'delete\n'); write('.gitignore', 'ignored\n'); commit();
  return { dir, write, commit };
}

test('worktree against a target includes committed and local files; worktree against HEAD excludes committed changes', async () => {
  const { dir, write, commit } = repo();
  run(dir, 'checkout', '-qb', 'task');
  write('committed.txt', 'committed\n'); commit();
  write('staged.txt', 'staged\n'); run(dir, 'add', 'staged.txt');
  write('src/a.ts', '  after\n\n'); write('untracked.txt', 'new\n'); write('ignored', 'secret');
  fs.rmSync(path.join(dir, 'delete.txt'));
  const all = await listDiff(dir, task); assert(!refused(all), all.error);
  assert.deepEqual(all.files.map((f) => f.path).sort(), ['committed.txt', 'delete.txt', 'src/a.ts', 'staged.txt', 'untracked.txt']);
  assert.deepEqual(all.files.find((f) => f.path === 'src/a.ts'), { path: 'src/a.ts', status: 'M', additions: 1, deletions: 1 });
  const local = await listDiff(dir, working); assert(!refused(local), local.error);
  assert(!local.files.some((f) => f.path === 'committed.txt'));
  const diff = await readDiff(dir, 'src/a.ts', task); assert(!refused(diff), diff.error);
  assert.equal(diff.original, '  before\n\n'); assert.equal(diff.modified, '  after\n\n');
  const deleted = await readDiff(dir, 'delete.txt', task); assert(!refused(deleted), deleted.error);
  assert.equal(deleted.original, 'delete\n'); assert.equal(deleted.modified, '');
});

test('renames, deletions and unusual paths survive listing, content reads and patch batching', async () => {
  const { dir, write, commit } = repo();
  write('empty.txt', ''); write('gone/nested.txt', 'deleted\n'); write('invalid.txt', 'valid\n'); commit();
  run(dir, 'mv', 'src/a.ts', 'src/renamed file.ts');
  write(' empty added.txt ', ''); fs.rmSync(path.join(dir, 'empty.txt'));
  fs.rmSync(path.join(dir, 'gone'), { recursive: true });
  write('invalid.txt', Buffer.from([0xc0, 0x80])); write('__proto__', 'literal name\n');
  if (process.platform !== 'win32') write('tab\tand\nnewline.txt', 'new\n');
  const result = await listDiff(dir, working); assert(!refused(result), result.error);
  assert.deepEqual(result.files.find((f) => f.path === 'src/renamed file.ts'), { path: 'src/renamed file.ts', previousPath: 'src/a.ts', status: 'R', additions: 0, deletions: 0 });
  assert(result.files.some((f) => f.path === ' empty added.txt '));
  assert(result.files.some((f) => f.path === 'empty.txt' && f.status === 'D'));
  if (process.platform !== 'win32') assert(result.files.some((f) => f.path === 'tab\tand\nnewline.txt'));
  const diff = await readDiff(dir, 'src/renamed file.ts', working); assert(!refused(diff), diff.error);
  assert.equal(diff.original, diff.modified); assert.equal(diff.previousPath, 'src/a.ts');
  if (process.platform !== 'win32') run(dir, 'add', 'tab\tand\nnewline.txt');
  const review = await loadReview(dir, working); assert(!refused(review), review.error);
  assert(review.diffs.some(({ result }) => !refused(result) && result.patch?.includes('-deleted')));
  assert(review.diffs.some(({ result }) => !refused(result) && result.patch?.includes('rename to src/renamed file.ts')));
  const invalid = review.diffs.find((d) => d.path === 'invalid.txt')?.result;
  assert(invalid && !refused(invalid));
  assert(invalid.notice);
  assert(review.diffs.filter((d) => d.path !== 'invalid.txt').every((d) => !refused(d.result) && d.result.version));
});

test('merge-base comparison excludes independent updates on the base branch', async () => {
  const { dir, write, commit } = repo();
  const start = run(dir, 'rev-parse', 'HEAD');
  run(dir, 'checkout', '-qb', 'task'); write('own.txt', 'own\n'); commit();
  run(dir, 'checkout', '-q', 'main'); write('others.txt', 'other work\n'); commit();
  run(dir, 'checkout', '-q', 'task');
  const result = await listDiff(dir, task); assert(!refused(result), result.error);
  assert.deepEqual(result.files.map((f) => f.path), ['own.txt']);
  const fallback = await listDiff(dir, {}, start); assert(!refused(fallback), fallback.error);
  assert.equal(fallback.to, 'main'); assert.deepEqual(fallback.files.map((f) => f.path), ['own.txt']);
  run(dir, 'branch', '-m', 'main', 'integration');
  const initial = await listDiff(dir, {}, start); assert(!refused(initial), initial.error);
  assert.equal(initial.to, 'Task start');
  assert((await listDiff(dir, { to: '--output=unsafe' })).error);
});

test('From is the current worktree and To uses the remote default branch ahead of local main', async () => {
  const { dir, write, commit } = repo();
  const start = run(dir, 'rev-parse', 'HEAD');
  run(dir, 'update-ref', 'refs/remotes/origin/trunk', start);
  run(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
  run(dir, 'checkout', '-qb', 'feature'); write('feature.txt', 'feature\n'); commit();
  const result = await listDiff(dir, {}, start); assert(!refused(result), result.error);
  assert.equal(result.from, 'feature (worktree)'); assert.equal(result.branch, 'feature'); assert.equal(result.to, 'origin/trunk');
  assert.deepEqual(result.files.map((f) => f.path), ['feature.txt']);
  run(dir, 'branch', 'other');
  const targets = await listDiffTargets(dir); assert(!refused(targets), targets.error);
  assert(targets.branches.includes('other')); assert(targets.branches.includes('origin/trunk'));
  assert(!targets.branches.includes('origin'));
});

test('subdirectory resources cannot list or read neighboring files', async () => {
  const { dir, write } = repo();
  write('outside.txt', 'outside'); write('src/a.ts', 'inside\n');
  const folder = path.join(dir, 'src');
  const result = await listDiff(folder, working); assert(!refused(result), result.error);
  assert.deepEqual(result.files.map((f) => f.path), ['a.ts']);
  const diff = await readDiff(folder, 'a.ts', working); assert(!refused(diff), diff.error);
  assert.equal(diff.original, '  before\n\n');
  assert((await readDiff(folder, '../outside.txt', working)).error);
  assert((await readDiff(folder, '.git/config', working)).error);
});

test('UTF-8 is preserved; binary, invalid and oversized text returns a notice', async () => {
  const { dir, write, commit } = repo();
  write('binary', Buffer.from([0, 1, 2])); write('large', 'a'.repeat((2 << 20) + 1));
  write('unicode.txt', '\ufeffvalid \ufffd\n'); commit();
  write('binary', Buffer.from([0, 4, 5])); write('large', 'b');
  write('unicode.txt', '\ufeffchanged \ufffd\n'); write('invalid.txt', Buffer.from([0xc0, 0x80]));
  for (const file of ['binary', 'invalid.txt', 'large']) {
    const diff = await readDiff(dir, file, working); assert(!refused(diff), diff.error);
    assert(diff.notice); assert.equal(diff.original, ''); assert.equal(diff.modified, '');
  }
  const valid = await readDiff(dir, 'unicode.txt', working); assert(!refused(valid), valid.error);
  assert.equal(valid.original, '\ufeffvalid \ufffd\n'); assert.equal(valid.modified, '\ufeffchanged \ufffd\n');
  assert((await readDiff(dir, 'missing.txt', working)).error);
});

test('unborn and non-Git folders have explicit review states', async () => {
  const dir = fs.mkdtempSync(path.join(root, 'unborn-'));
  assert.deepEqual(await listDiff(dir, working), { git: false, revision: null, from: '', to: '', branch: null, branches: [], files: [] });
  run(dir, 'init', '-q'); fs.writeFileSync(path.join(dir, 'first.txt'), 'first\n'); run(dir, 'add', '-A');
  const result = await listDiff(dir, {}); assert(!refused(result), result.error);
  assert.deepEqual(result.files, [{ path: 'first.txt', status: 'A', untracked: true, additions: 1, deletions: 0 }]);
  const diff = await readDiff(dir, 'first.txt', {}); assert(!refused(diff), diff.error);
  assert.equal(diff.original, ''); assert.equal(diff.modified, 'first\n');
});

test('symbolic link entries show their link text without reading the target', { skip: process.platform === 'win32' }, async () => {
  const { dir, write } = repo();
  write('outside.txt', 'private');
  fs.symlinkSync('../outside.txt', path.join(dir, 'src', 'link'));
  const diff = await readDiff(path.join(dir, 'src'), 'link', working); assert(!refused(diff), diff.error);
  assert.equal(diff.modified, '../outside.txt');
});

test('review batches patches, defers automatic overflow and loads requested tracked and new files', async () => {
  const { dir, write, commit } = repo();
  for (let i = 0; i < 40; i++) write(`file-${String(i).padStart(2, '0')}.txt`, `before ${i}\n`);
  commit();
  for (let i = 0; i < 40; i++) write(`file-${String(i).padStart(2, '0')}.txt`, `after ${i}\n`);
  write('untracked.txt', 'untracked\n');
  const trace = path.join(root, 'batch-trace.log'), prior = process.env.GIT_TRACE;
  process.env.GIT_TRACE = trace.replaceAll('\\', '/');
  try {
    let listed = 0;
    const review = await loadReview(dir, working, undefined, [], (summary) => {
      listed = summary.files.length;
      assert(!fs.readFileSync(trace, 'utf8').includes('--patch'));
    });
    assert(!refused(review), review.error);
    assert.equal(listed, 41);
    assert.equal(review.files.length, 41);
    assert.equal(review.diffs.length, 41);
    assert.equal(review.diffs.filter(({ result }) => !refused(result) && result.version).length, 32);
    assert.equal(review.diffs.filter(({ result }) => !refused(result) && result.deferred).length, 9);
    const commands = fs.readFileSync(trace, 'utf8');
    assert(!commands.includes('cat-file'));
    assert.equal(commands.split('\n').filter((line) => line.includes('built-in: git ') && line.includes('--numstat')).length, 1);
    assert.equal(commands.split('\n').filter((line) => line.includes('built-in: git ') && line.includes('--patch')).length, 1);
  } finally {
    if (prior === undefined) delete process.env.GIT_TRACE; else process.env.GIT_TRACE = prior;
  }
  const loaded = await loadReview(dir, working, undefined, ['file-39.txt', 'untracked.txt']);
  assert(!refused(loaded), loaded.error);
  assert(loaded.diffs.some(({ path, result }) => path === 'file-39.txt' && !refused(result) && result.patch?.includes('+after 39')));
  assert(loaded.diffs.some(({ path, result }) => path === 'untracked.txt' && !refused(result) && result.addition === 'untracked\n'));
  assert((await loadReview(dir, working, undefined, ['a', 'b', 'c', 'd', 'e'])).error);
});

test('large diffs defer patch generation until explicitly loaded', async () => {
  const { dir, write, commit } = repo();
  const content = 'unchanged context line\n'.repeat(10000);
  write('large.txt', content); commit();
  write('large.txt', content.replace('unchanged', 'changed'));
  write('new-large.txt', content);
  const review = await loadReview(dir, working);
  assert(!refused(review), review.error);
  assert(review.diffs.every(({ result }) => !refused(result) && !result.patch));
  for (const { result } of review.diffs) {
    assert(!refused(result), result.error);
    assert(result.deferred); assert.equal(result.addition, undefined);
  }
  const loaded = await loadReview(dir, working, undefined, ['large.txt', 'new-large.txt']);
  assert(!refused(loaded), loaded.error);
  assert(loaded.diffs.some(({ result }) => !refused(result) && result.patch?.includes('+changed context line')));
  const addition = loaded.diffs.find((diff) => diff.path === 'new-large.txt')?.result;
  assert(addition && !refused(addition));
  assert.equal(addition.addition, content);
});

test('patch versions retain unaffected files and distinguish additions from modifications', async () => {
  const { dir, write, commit } = repo();
  const read = async () => {
    const review = await loadReview(dir, working); assert(!refused(review), review.error);
    const result = review.diffs.find((d) => d.path === 'new.txt')?.result;
    assert(result && !refused(result));
    return result;
  };
  write('new.txt', 'new contents\n');
  const addition = await read(); assert.equal(addition.addition, 'new contents\n');
  write('new.txt', ''); commit();
  write('new.txt', 'new contents\n');
  const modification = await read(); assert.notEqual(modification.version, addition.version);
  write('src/a.ts', 'changed\n');
  assert.equal((await read()).version, modification.version);
});
