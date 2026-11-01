// Local review compares actual Git history and worktree contents, including unusual paths.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { refused } from '../shared/result.ts';
import { listDiff, listDiffTargets, readDiff, readReview, loadReview } from './main/diff.ts';

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
  const all = await listDiff(dir, task); assert.equal(all.error, undefined); if (refused(all)) return;
  assert.deepEqual(all.files.map((f) => f.path).sort(), ['committed.txt', 'delete.txt', 'src/a.ts', 'staged.txt', 'untracked.txt']);
  assert.deepEqual(all.files.find((f) => f.path === 'src/a.ts'), { path: 'src/a.ts', status: 'M', additions: 1, deletions: 1 });
  const local = await listDiff(dir, working); assert.equal(local.error, undefined); if (refused(local)) return;
  assert(!local.files.some((f) => f.path === 'committed.txt'));
  const diff = await readDiff(dir, 'src/a.ts', task); assert.equal(diff.error, undefined); if (refused(diff)) return;
  assert.equal(diff.original, '  before\n\n'); assert.equal(diff.modified, '  after\n\n');
  const deleted = await readDiff(dir, 'delete.txt', task); assert.equal(deleted.error, undefined); if (refused(deleted)) return;
  assert.equal(deleted.original, 'delete\n'); assert.equal(deleted.modified, '');
});

test('rename pairs, whitespace in filenames, and added/deleted empty files remain distinct', async () => {
  const { dir, write, commit } = repo();
  write('empty.txt', ''); commit();
  run(dir, 'mv', 'src/a.ts', 'src/renamed file.ts');
  write(' empty added.txt ', ''); fs.rmSync(path.join(dir, 'empty.txt'));
  if (process.platform !== 'win32') write('tab\tand\nnewline.txt', 'new\n');
  const result = await listDiff(dir, working); assert.equal(result.error, undefined); if (refused(result)) return;
  assert.deepEqual(result.files.find((f) => f.path === 'src/renamed file.ts'), { path: 'src/renamed file.ts', previousPath: 'src/a.ts', status: 'R', additions: 0, deletions: 0 });
  assert(result.files.some((f) => f.path === ' empty added.txt '));
  assert(result.files.some((f) => f.path === 'empty.txt' && f.status === 'D'));
  if (process.platform !== 'win32') assert(result.files.some((f) => f.path === 'tab\tand\nnewline.txt'));
  const diff = await readDiff(dir, 'src/renamed file.ts', working); assert.equal(diff.error, undefined); if (refused(diff)) return;
  assert.equal(diff.original, diff.modified); assert.equal(diff.previousPath, 'src/a.ts');
});

test('merge-base comparison excludes independent updates on the base branch', async () => {
  const { dir, write, commit } = repo();
  const start = run(dir, 'rev-parse', 'HEAD');
  run(dir, 'checkout', '-qb', 'task'); write('own.txt', 'own\n'); commit();
  run(dir, 'checkout', '-q', 'main'); write('others.txt', 'other work\n'); commit();
  run(dir, 'checkout', '-q', 'task');
  const result = await listDiff(dir, task); assert.equal(result.error, undefined); if (refused(result)) return;
  assert.deepEqual(result.files.map((f) => f.path), ['own.txt']);
  const fallback = await listDiff(dir, {}, start); assert.equal(fallback.error, undefined); if (refused(fallback)) return;
  assert.equal(fallback.to, 'main'); assert.deepEqual(fallback.files.map((f) => f.path), ['own.txt']);
  run(dir, 'branch', '-m', 'main', 'integration');
  const initial = await listDiff(dir, {}, start); assert.equal(initial.error, undefined); if (refused(initial)) return;
  assert.equal(initial.to, 'Task start');
  assert((await listDiff(dir, { to: '--output=unsafe' })).error);
});

test('From is the current worktree and To uses the remote default branch ahead of local main', async () => {
  const { dir, write, commit } = repo();
  const start = run(dir, 'rev-parse', 'HEAD');
  run(dir, 'update-ref', 'refs/remotes/origin/trunk', start);
  run(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
  run(dir, 'checkout', '-qb', 'feature'); write('feature.txt', 'feature\n'); commit();
  const result = await listDiff(dir, {}, start); assert.equal(result.error, undefined); if (refused(result)) return;
  assert.equal(result.from, 'feature (worktree)'); assert.equal(result.branch, 'feature'); assert.equal(result.to, 'origin/trunk');
  assert.deepEqual(result.files.map((f) => f.path), ['feature.txt']);
});

test('a saved From branch cannot override the task worktree in listings, review batches or full contents', async () => {
  const { dir, write, commit } = repo();
  run(dir, 'checkout', '-qb', 'feature');
  run(dir, 'mv', 'delete.txt', 'renamed.txt');
  write('src/a.ts', 'committed feature\n'); commit();
  run(dir, 'checkout', '-q', 'main');
  write('src/a.ts', 'local worktree\n'); write('untracked.txt', 'local file\n');
  const options = { from: 'feature', to: 'main' };
  const result = await listDiff(dir, options); assert.equal(result.error, undefined); if (refused(result)) return;
  assert.equal(result.from, 'main (worktree)'); assert.equal(result.branch, 'main');
  assert.deepEqual(result.files.map((f) => f.path).sort(), ['src/a.ts', 'untracked.txt']);
  const diff = await readDiff(dir, 'src/a.ts', options); assert.equal(diff.error, undefined); if (refused(diff)) return;
  assert.equal(diff.original, '  before\n\n'); assert.equal(diff.modified, 'local worktree\n');
  const review = await readReview(dir, result.revision, result.files); assert.equal(review.error, undefined); if (refused(review)) return;
  assert(review.diffs.some(({ result }) => !refused(result) && result.patch?.includes('+local worktree')));
  assert.deepEqual(review.diffs.map((f) => f.path).sort(), ['src/a.ts', 'untracked.txt']);
  assert.equal(run(dir, 'branch', '--show-current'), 'main');
  assert.equal(fs.readFileSync(path.join(dir, 'src/a.ts'), 'utf8'), 'local worktree\n');
});

test('subdirectory resources cannot list or read neighboring files', async () => {
  const { dir, write } = repo();
  write('outside.txt', 'outside'); write('src/a.ts', 'inside\n');
  const folder = path.join(dir, 'src');
  const result = await listDiff(folder, working); assert.equal(result.error, undefined); if (refused(result)) return;
  assert.deepEqual(result.files.map((f) => f.path), ['a.ts']);
  const diff = await readDiff(folder, 'a.ts', working); assert.equal(diff.error, undefined); if (refused(diff)) return;
  assert.equal(diff.original, '  before\n\n');
  assert((await readDiff(folder, '../outside.txt', working)).error);
  assert((await readDiff(folder, '.git/config', working)).error);
});

test('binary and oversized files return a bounded notice, and missing files cannot retain stale text', async () => {
  const { dir, write, commit } = repo();
  write('binary', Buffer.from([0, 1, 2])); write('large', 'a'.repeat((2 << 20) + 1)); commit();
  write('binary', Buffer.from([0, 4, 5])); write('large', 'b');
  for (const file of ['binary', 'large']) {
    const diff = await readDiff(dir, file, working); assert.equal(diff.error, undefined); if (refused(diff)) return;
    assert(diff.notice); assert.equal(diff.original, ''); assert.equal(diff.modified, '');
  }
  assert((await readDiff(dir, 'missing.txt', working)).error);
});

test('unborn and non-Git folders have explicit review states', async () => {
  const dir = fs.mkdtempSync(path.join(root, 'unborn-'));
  assert.deepEqual(await listDiff(dir, working), { git: false, revision: null, from: '', to: '', branch: null, branches: [], files: [] });
  run(dir, 'init', '-q'); fs.writeFileSync(path.join(dir, 'first.txt'), 'first\n'); run(dir, 'add', '-A');
  const result = await listDiff(dir, {}); assert.equal(result.error, undefined); if (refused(result)) return;
  assert.deepEqual(result.files, [{ path: 'first.txt', status: 'A', untracked: true, additions: 1, deletions: 0 }]);
  const diff = await readDiff(dir, 'first.txt', {}); assert.equal(diff.error, undefined); if (refused(diff)) return;
  assert.equal(diff.original, ''); assert.equal(diff.modified, 'first\n');
});

test('UTF-8 replacement characters and BOMs are text, while invalid byte sequences are not', async () => {
  const { dir, write, commit } = repo();
  write('unicode.txt', '\ufeffvalid \ufffd\n'); commit();
  write('unicode.txt', '\ufeffchanged \ufffd\n');
  const valid = await readDiff(dir, 'unicode.txt', working); assert.equal(valid.error, undefined); if (refused(valid)) return;
  assert.equal(valid.original, '\ufeffvalid \ufffd\n'); assert.equal(valid.modified, '\ufeffchanged \ufffd\n');
  write('invalid.txt', Buffer.from([0xc0, 0x80]));
  const invalid = await readDiff(dir, 'invalid.txt', working); assert.equal(invalid.error, undefined); if (refused(invalid)) return;
  assert(invalid.notice);
});

test('symbolic link entries show their link text without reading the target', { skip: process.platform === 'win32' }, async () => {
  const { dir, write } = repo();
  write('outside.txt', 'private');
  fs.symlinkSync('../outside.txt', path.join(dir, 'src', 'link'));
  const diff = await readDiff(path.join(dir, 'src'), 'link', working); assert.equal(diff.error, undefined); if (refused(diff)) return;
  assert.equal(diff.modified, '../outside.txt');
});

test('a summary feeds a bulk patch request without rescanning Git or reading complete blobs', async () => {
  const { dir, write, commit } = repo();
  for (let i = 0; i < 80; i++) write(`file-${String(i).padStart(2, '0')}.txt`, `before ${i}\n`);
  commit();
  for (let i = 0; i < 80; i++) write(`file-${String(i).padStart(2, '0')}.txt`, `after ${i}\n`);
  write('untracked.txt', 'untracked\n');
  const summary = await listDiff(dir, working); assert(!refused(summary)); if (refused(summary)) return;
  assert.equal(summary.files.length, 81);
  const trace = path.join(root, 'batch-trace.log'), prior = process.env.GIT_TRACE;
  process.env.GIT_TRACE = trace.replaceAll('\\', '/');
  try {
    for (let offset = 0; offset < summary.files.length; offset += 32) {
      const files = summary.files.slice(offset, offset + 32);
      const review = await readReview(dir, summary.revision, files);
      assert(!refused(review)); if (refused(review)) return;
      assert.deepEqual(review.diffs.map((d) => d.path), files.map((f) => f.path));
      for (const entry of review.diffs) {
        assert(!refused(entry.result)); if (refused(entry.result)) return;
        assert(entry.result.version);
      }
    }
    const commands = fs.readFileSync(trace, 'utf8');
    assert(!commands.includes('cat-file'));
    assert(!commands.includes('for-each-ref'));
    assert(!commands.includes('merge-base'));
    assert(!commands.includes('ls-files'));
    assert(!commands.includes('--numstat'));
    assert.equal(commands.split('\n').filter((line) => line.includes('built-in: git ')).length, 6);
  } finally {
    if (prior === undefined) delete process.env.GIT_TRACE; else process.env.GIT_TRACE = prior;
  }
  assert((await readReview(dir, summary.revision, summary.files)).error);
  assert((await readReview(dir, '--output=unsafe', [])).error);
  assert((await readReview(dir, summary.revision, [{ path: '../outside', status: 'M', additions: 1, deletions: 1 }])).error);
});

test('branch choices are independent of the comparison summary', async () => {
  const { dir } = repo();
  run(dir, 'branch', 'other');
  const summary = await listDiff(dir, working); assert(!refused(summary)); if (refused(summary)) return;
  assert(!summary.branches.includes('other'));
  const targets = await listDiffTargets(dir); assert(!refused(targets)); if (refused(targets)) return;
  assert(targets.branches.includes('other'));
});

test('large diffs defer patch generation until explicitly loaded', async () => {
  const { dir, write, commit } = repo();
  const content = 'unchanged context line\n'.repeat(10000);
  write('large.txt', content); commit();
  write('large.txt', content.replace('unchanged', 'changed'));
  write('new-large.txt', content);
  const summary = await listDiff(dir, working); assert(!refused(summary)); if (refused(summary)) return;
  const review = await readReview(dir, summary.revision, summary.files);
  assert(!refused(review)); if (refused(review)) return;
  assert(review.diffs.every(({ result }) => !refused(result) && !result.patch));
  for (const { result } of review.diffs) {
    assert(!refused(result)); if (refused(result)) return;
    assert(result.deferred); assert.equal(result.addition, undefined);
  }
  const loaded = await readReview(dir, summary.revision, summary.files, ['large.txt', 'new-large.txt']);
  assert(!refused(loaded)); if (refused(loaded)) return;
  assert(loaded.diffs.some(({ result }) => !refused(result) && result.patch?.includes('+changed context line')));
  const addition = loaded.diffs.find((diff) => diff.path === 'new-large.txt')?.result;
  assert(addition && !refused(addition)); if (!addition || refused(addition)) return;
  assert.equal(addition.addition, content);
});

test('patch versions retain unaffected files and distinguish additions from modifications', async () => {
  const { dir, write, commit } = repo();
  const read = async () => {
    const summary = await listDiff(dir, working); if (refused(summary)) throw new Error(summary.error);
    const review = await readReview(dir, summary.revision, summary.files); if (refused(review)) throw new Error(review.error);
    return review.diffs.map((d) => { if (refused(d.result)) throw new Error(d.result.error); return d.result; });
  };
  write('new.txt', 'new contents\n');
  const [addition] = await read(); assert.equal(addition?.addition, 'new contents\n');
  write('new.txt', ''); commit();
  write('new.txt', 'new contents\n');
  const [modification] = await read(); assert.notEqual(modification?.version, addition?.version);
  write('src/a.ts', 'changed\n');
  const next = await read(); assert.equal(next[1]?.version, modification?.version);
});

test('a patch batch preserves renames and deletions and isolates invalid encoding', async () => {
  const { dir, write, commit } = repo();
  write('gone/nested.txt', 'deleted\n'); write('invalid.txt', 'valid\n'); commit();
  fs.rmSync(path.join(dir, 'gone'), { recursive: true });
  write('invalid.txt', Buffer.from([0xc0, 0x80]));
  run(dir, 'mv', 'src/a.ts', 'src/renamed file.ts');
  write('__proto__', 'literal name\n');
  if (process.platform !== 'win32') {
    write('tab\tand\nnewline.txt', 'before\n'); run(dir, 'add', 'tab\tand\nnewline.txt');
  }
  const summary = await listDiff(dir, working); assert(!refused(summary)); if (refused(summary)) return;
  const review = await readReview(dir, summary.revision, summary.files); assert(!refused(review)); if (refused(review)) return;
  assert(review.diffs.some(({ result }) => !refused(result) && result.patch?.includes('-deleted')));
  assert(review.diffs.some(({ result }) => !refused(result) && result.patch?.includes('rename to src/renamed file.ts')));
  const invalid = review.diffs.find((d) => d.path === 'invalid.txt')?.result;
  assert(invalid && !refused(invalid)); if (!invalid || refused(invalid)) return;
  assert(invalid.notice);
  assert(review.diffs.filter((d) => d.path !== 'invalid.txt').every((d) => !refused(d.result) && d.result.version));
});

test('a complete review defers the automatic overflow and includes an explicitly requested file', async () => {
  const { dir, write } = repo();
  for (let i = 0; i < 40; i++) write(`new-${String(i).padStart(2, '0')}.txt`, `new ${i}\n`);
  const review = await loadReview(dir, working);
  assert(!refused(review)); if (refused(review)) return;
  assert.equal(review.files.length, 40);
  assert.equal(review.diffs.filter((d) => !refused(d.result) && d.result.version).length, 32);
  const loaded = await loadReview(dir, working, undefined, ['new-39.txt']);
  assert(!refused(loaded)); if (refused(loaded)) return;
  const chosen = loaded.diffs.find((d) => d.path === 'new-39.txt')?.result;
  assert(chosen && !refused(chosen)); if (!chosen || refused(chosen)) return;
  assert.equal(chosen.addition, 'new 39\n');
});
