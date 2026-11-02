// Git repositories and the task Git client (worktrees.ts).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { git, gitBuffer, repoOf } from '../../src/main/worktrees.ts';

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
