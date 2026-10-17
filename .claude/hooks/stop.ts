// Claude Code's Stop hook (.claude/settings.json): before a session ends its turn, ESLint and the unit tests on what
// it changed and has not committed; a failure sends it back with the output. docs/testing.md, Claude Code's checks.
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const input = JSON.parse(fs.readFileSync(0, 'utf8')) as { cwd: string; stop_hook_active?: boolean };
const git = (...args: string[]) => execFileSync('git', args, { cwd: input.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

let root: string, gitDir: string;
try { root = git('rev-parse', '--show-toplevel').trim(); gitDir = git('rev-parse', '--absolute-git-dir').trim(); } catch { process.exit(0); }
// Only a checkout of Kulisa with its dependencies (a worktree's node_modules may not be linked yet).
if (!fs.existsSync(path.join(root, 'node_modules', '.bin')) || !fs.existsSync(path.join(root, 'eslint.config.ts'))) process.exit(0);

// The code changed and not committed: `XY path`, or `XY old -> new` when renamed.
const changed = git('status', '--porcelain', '-uall').split('\n').filter(Boolean)
  .map((line) => line.slice(3).split(' -> ').at(-1)!).filter((f) => /\.(ts|mts|vue)$/.test(f)).sort();
if (!changed.length) process.exit(0);

// Checked once per state of those files: a turn that changed none of them since costs nothing. The record is one file
// in the checkout's git folder, rewritten, gone with the worktree.
const hash = crypto.createHash('sha256');
for (const f of changed) { hash.update(f); try { hash.update(fs.readFileSync(path.join(root, f))); } catch { hash.update('gone'); } }
const state = hash.digest('hex'), record = path.join(gitDir, 'kulisa-stop-hook.json');
let last: { passed?: string; failed?: string } = {};
try { last = JSON.parse(fs.readFileSync(record, 'utf8')) as typeof last; } catch {}
if (last.passed === state) process.exit(0);
// Sent back once and nothing changed since: let it stop (it says why to the human), rather than send it back for ever.
if (input.stop_hook_active && last.failed === state) process.exit(0);

const run = (script: string) => spawnSync('npm', ['run', '--silent', script], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
const failures = ['lint', 'test:unit'].map((s) => ({ s, r: run(s) })).filter(({ r }) => r.status !== 0);
fs.writeFileSync(record, JSON.stringify(failures.length ? { ...last, failed: state } : { passed: state }));
if (!failures.length) process.exit(0);

const tail = (text: string) => text.trim().split('\n').slice(-60).join('\n');
console.log(JSON.stringify({
  decision: 'block',
  reason: failures.map(({ s, r }) => `npm run ${s} failed:\n${tail(`${r.stdout}\n${r.stderr}`)}`).join('\n\n')
    + '\n\nFix it before ending the turn, or tell the human why it cannot be fixed now.',
}));
