// git for tasks (worktrees.ts): what a folder's repository is.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { repoOf } from '../../src/main/worktrees.ts';

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
