// The code of a task (tasks.md): a git worktree with its own branch next to the project, `<repo>@<name>/`, made as
// Claude Code's --worktree makes one. A project without git (or before its first commit) has no copies: its tasks work
// in its folder.
// Runs the user's git (a program on every OS), never a shell.
import { execFile } from 'child_process';
import { simpleGit } from 'simple-git';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { removeTree } from './remove.ts';
import { slugOf } from '../shared/names.ts';
import type { Copy } from './store.ts';

// Files outside git that a task's copy needs and the project has: its environment, and the agents' own local settings
// (each agent's localFiles: agents/). The project's .worktreeinclude (gitignore syntax, as Claude Code reads it) adds more.
const COPIED = ['/.env*'];

// A failed git command: its error with what git said.
type GitError = Error & { stderr?: string };

type GitOptions = { timeout?: number; input?: string; maxBuffer?: number };
async function runGit(cwd: string, args: string[], { timeout = 30000, input, maxBuffer = 64 << 20 }: GitOptions, binary: boolean) {
  const abort = new AbortController(), output: Buffer[] = [], errors: Buffer[] = [];
  let failure: Error | undefined;
  // Git runs without an interactive pager or editor; terminal agents keep their own shell environment.
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  for (const key of ['GIT_PAGER', 'PAGER', 'GIT_EDITOR', 'GIT_SEQUENCE_EDITOR', 'EDITOR', 'VISUAL']) delete env[key];
  const client = simpleGit({ baseDir: cwd, trimmed: false, abort: abort.signal,
    allowEnvironment: [...Object.keys(process.env), 'GIT_TERMINAL_PROMPT'],
    // Quiet Git checks signal a missing ref through the exit code alone.
    errors: (error, { exitCode }) => error ?? (exitCode ? new Error(`Git exited with code ${exitCode}.`) : undefined),
    // The input plugin skips an empty string; a zero-byte buffer still closes stdin.
    input: () => input === '' ? Buffer.alloc(0) : input,
    timeout: { block: timeout, stdOut: false, stdErr: false },
  }).env(env);
  client.outputHandler((_command, stdout, stderr) => {
    const collect = (stream: NodeJS.ReadableStream, chunks: Buffer[] | null) => {
      let size = 0;
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBuffer) {
          failure ??= new Error('Git output exceeds the configured limit.');
          abort.abort();
        } else chunks?.push(chunk);
      });
    };
    // Byte buffers preserve Git's NUL records and blob encodings; text commands use the library's result.
    collect(stdout, binary ? output : null); collect(stderr, errors);
  });
  try {
    const text = await (args[0] === 'diff' ? client.diff(args.slice(1)) : client.raw(args));
    if (failure) throw failure;
    return binary ? Buffer.concat(output) : text;
  } catch (e) {
    throw Object.assign(failure ?? (e as Error), { stderr: Buffer.concat(errors).toString('utf8').trim() });
  }
}
async function gitBuffer(cwd: string, args: string[], options: GitOptions = {}) {
  return await runGit(cwd, args, options, true) as Buffer;
}
async function git(cwd: string, args: string[], { trim = true, ...options }: GitOptions & { trim?: boolean } = {}) {
  const out = await runGit(cwd, args, options, false) as string;
  return trim ? out.trim() : out;
}
const ok = (p: Promise<unknown>) => p.then(() => true, () => false);
// A folder's real path as the OS gives it, as git's is: Node's own keeps a Windows short name (C:\Users\COSMOT~1),
// which git writes long.
const realpath = (p: string) => new Promise<string>((resolve, reject) => fs.realpath.native(p, (e, r) => (e ? reject(e) : resolve(r))));

// The repository the folder is in: { top (its root), sub (the folder inside it), commit (has one) }; null without git.
// git answers with the real path, and the folder may be named through a symlink (macOS's /var and /tmp are
// /private's): the sub is the real folder's, and the top named as the folder is, so a task's copy goes next to it under
// the name the human knows (with the two mixed, a task would get the project's own folder). Only when that name
// is the top's: going up from a link into the repository (a monorepo's app) reached a folder outside it.
async function repoOf(folder: string) {
  const out = await git(folder, ['rev-parse', '--show-toplevel']).catch((): null => null);
  if (!out) return null;
  const top = path.resolve(out), real = await realpath(folder).catch(() => path.resolve(folder));
  const named = path.resolve(folder, path.relative(real, top));
  const same = await realpath(named).then((r) => r === top, () => false);
  return { top: same ? named : top, sub: path.relative(top, real), commit: await ok(git(folder, ['rev-parse', '--verify', 'HEAD^{commit}'])) };
}

// A name for the branch and the folder: lower case, letters (any language), digits and dashes.
const slug = (name: string) => slugOf(name, 'task');

// Where a new branch starts, as Claude Code's --worktree: the remote's default branch after a fetch, else HEAD.
async function startPoint(top: string) {
  const remote = await git(top, ['rev-parse', '--abbrev-ref', 'origin/HEAD']).catch((): null => null); // origin/main
  if (remote) {
    await git(top, ['fetch', '--quiet', 'origin', remote.replace(/^origin\//, '')], { timeout: 20000 }).catch((e: GitError) => console.warn('[worktrees] fetch:', e.stderr || e.message));
    if (await ok(git(top, ['rev-parse', '--verify', `${remote}^{commit}`]))) return remote;
  }
  return 'HEAD';
}

// A branch for a task, free in each of its repositories (folders: folders in them): the name's slug, else -2, -3 …;
// beside: its copies go next to their repositories (<repo>@<branch>), so those folders must be free too. keep: the
// branch the task has now, free for it.
async function freeBranch(folders: string[], name: string, { beside = false, keep }: { beside?: boolean; keep?: string } = {}) {
  const tops = (await Promise.all(folders.map(repoOf))).filter((r) => !!r).map((r) => r.top);
  const taken = async (b: string) => b !== keep && (await Promise.all(tops.map(async (t) => (beside && fs.existsSync(`${t}@${b}`))
    || ok(git(t, ['rev-parse', '--verify', '--quiet', `refs/heads/${b}`]))))).some(Boolean);
  const s = slug(name);
  let branch = s, n = 2;
  while (await taken(branch)) branch = `${s}-${n++}`;
  return branch;
}

// A copy of a repository for a task: a new worktree on a new branch (free: freeBranch), at `at` or next to the
// repository (<repo>@<branch>). { repo (the folder it copies), worktree, branch, base (the commit it starts from),
// folder (that folder inside it) }. Uncommitted changes of the project are not carried; files outside git that it
// needs are copied (COPIED, the agents' local files, .worktreeinclude).
async function createWorktree(folder: string, branch: string, at: string | null | undefined, agentFiles: string[]): Promise<Copy> {
  const repo = await repoOf(folder);
  if (!repo?.commit) throw new Error(repo ? `${folder}: the repository has no commit yet` : `${folder} is not in git`);
  const base = await git(repo.top, ['rev-parse', await startPoint(repo.top)]);
  const worktree = at || `${repo.top}@${branch}`;
  fs.mkdirSync(path.dirname(worktree), { recursive: true });
  // --no-track: the branch is the task's own; pushing it does not go to the default branch it started from.
  await git(repo.top, ['worktree', 'add', '--no-track', '-b', branch, worktree, base]);
  const copied = await copyIgnored(repo.top, worktree, agentFiles);
  await allowEnvrc(repo.top, worktree, copied);
  return { repo: folder, worktree, branch, base, folder: path.join(worktree, repo.sub) };
}

// Untracked files that git ignores and the patterns name, copied from the repository into the worktree.
async function copyIgnored(top: string, worktree: string, agentFiles: string[]) {
  const include = path.join(top, '.worktreeinclude');
  const listed = await git(top, ['ls-files', '--others', '--ignored', '-z', ...[...COPIED, ...agentFiles].map((p) => `--exclude=${p}`),
    ...(fs.existsSync(include) ? [`--exclude-from=${include}`] : [])]).catch(() => '');
  const files = listed.split('\0').filter(Boolean);
  if (!files.length) return [];
  // Only what the project's own ignore rules keep out of git: a file meant to be committed is not copied.
  const ignored = (await git(top, ['check-ignore', '--stdin', '-z'], { input: files.join('\0') + '\0' }).catch(() => '')).split('\0').filter(Boolean);
  for (const f of ignored) {
    try {
      fs.mkdirSync(path.dirname(path.join(worktree, f)), { recursive: true });
      fs.copyFileSync(path.join(top, f), path.join(worktree, f));
    } catch (e) { console.error('[worktrees] not copied:', f, (e as Error).message); }
  }
  return ignored;
}

// direnv runs a folder's .envrc only once the human has allowed it there, and the task's is a new folder: without this,
// a project's environment (e.g. CLAUDE_CONFIG_DIR, another Claude account) would be missing in the copy, and its agent
// would run as someone else. A copied .envrc is allowed in the copy when the project's, the same content, is allowed.
const run = (cmd: string, args: string[], cwd: string) => new Promise<boolean>((resolve) =>
  execFile(cmd, args, { cwd, timeout: 10000, windowsHide: true }, (e) => resolve(!e)));
async function allowEnvrc(top: string, worktree: string, copied: string[]) {
  if (!copied.includes('.envrc')) return;
  if (await run('direnv', ['exec', top, 'true'], top)) await run('direnv', ['allow', worktree], worktree);
}

// What a task's copy has that its repository's main has not: commits of its own (since it started, not merged into
// main's HEAD, not on any remote: pushed ones stay there) and uncommitted files.
async function changes({ repo, worktree, branch, base }: Copy) {
  const head = await git(repo, ['rev-parse', 'HEAD']).catch((): null => null);
  const commits = Number(await git(repo, ['rev-list', '--count', branch, `^${base}`, ...(head ? [`^${head}`] : []), '--not', '--remotes']).catch(() => 0));
  const dirty = fs.existsSync(worktree) ? (await git(worktree, ['status', '--porcelain']).catch(() => '')).split('\n').filter(Boolean).length : 0;
  return { commits, dirty };
}

// Where a task's copy stands, for the next agent (task_history): its commits since it started, files not committed,
// what changed against its start. Empty where git says nothing.
async function progress({ worktree, branch, base }: Copy) {
  const run = (args: string[]) => git(worktree, args).catch(() => '');
  const [log, status, stat] = await Promise.all([
    base ? run(['log', '--oneline', '--max-count=50', `${base}..${branch}`]) : '',
    run(['status', '--porcelain']),
    base ? run(['diff', '--stat', base]) : '',
  ]);
  return { log, status, stat };
}

// A task's copy merged on its remote (its PR merged): it has commits of its own, all of them in the remote's default
// branch (origin/HEAD, fetched first), and no uncommitted files; deleting it then loses nothing. A squash or a rebase
// merge makes new commits: they are told by their changes (git's patch ids), each commit's or the whole branch's in one.
async function merged({ repo, worktree, branch, base }: Copy) {
  const remote = await git(repo, ['rev-parse', '--abbrev-ref', 'origin/HEAD']).catch((): null => null); // origin/main
  if (!remote) return false;
  await git(repo, ['fetch', '--quiet', 'origin', remote.replace(/^origin\//, '')], { timeout: 20000 }).catch(() => {});
  const count = async (...a: string[]) => Number(await git(repo, ['rev-list', '--count', ...a]).catch(() => -1));
  if ((await count(branch, `^${base}`)) < 1) return false;
  if (fs.existsSync(worktree) && await git(worktree, ['status', '--porcelain']).catch(() => 'x')) return false;
  return (await count(branch, `^${remote}`)) === 0 || await rebased(repo, branch, base, remote) || await squashed(repo, branch, remote);
}
// Each of the branch's commits has one of the same change in the remote's branch ('-' in git cherry).
async function rebased(repo: string, branch: string, base: string | null, remote: string) {
  const out = await git(repo, ['cherry', remote, branch, ...(base ? [base] : [])]).catch(() => '+');
  return !!out && !/^\+/m.test(out);
}
// The branch's whole change since it parted from the remote's branch is one commit there. The user's diff settings
// (color, an external diff) are kept out: both patch ids come from the same plain diff.
async function squashed(repo: string, branch: string, remote: string) {
  const plain = ['--no-color', '--no-ext-diff'];
  const ids = async (patch: string) => new Set((await git(repo, ['patch-id', '--stable'], { input: patch }).catch(() => ''))
    .split('\n').filter(Boolean).map((l) => l.split(' ')[0]));
  const from = await git(repo, ['merge-base', branch, remote]).catch((): null => null);
  if (!from) return false;
  const [own] = await ids(await git(repo, ['diff', ...plain, from, branch]).catch(() => ''));
  if (!own) return false;
  return (await ids(await git(repo, ['log', '-p', ...plain, '--no-merges', `${from}..${remote}`]).catch(() => ''))).has(own);
}

// direnv's records allowing the task's .envrc (allowEnvrc), removed: one file per content it was allowed with, in
// <XDG data>/direnv/allow/, holding the .envrc's path. Not `direnv deny`: newer direnv keeps a record of that too.
function forgetEnvrc(worktree: string) {
  const dir = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'direnv', 'allow');
  const envrc = path.join(worktree, '.envrc');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    try { if (fs.readFileSync(path.join(dir, f), 'utf8').trim() === envrc) fs.rmSync(path.join(dir, f)); } catch {}
  }
}

// The worktree and its branch, gone, and whatever was made for them (direnv's permission). A copy of the branch
// already pushed stays on the remote.
async function removeWorktree({ repo, worktree, branch }: Copy) {
  forgetEnvrc(worktree);
  await git(repo, ['worktree', 'remove', '--force', '--force', worktree]).catch(async (e: GitError) => {
    console.warn('[worktrees] remove:', e.stderr || e.message);
    removeTree(worktree);
    await git(repo, ['worktree', 'prune']).catch(() => {});
  });
  await git(repo, ['branch', '-D', branch]).catch((e: GitError) => console.warn('[worktrees] branch:', e.stderr || e.message));
}

// A task renamed (its name is the agent's or the human's): the branch of each of its copies takes the name, one
// free in all of them (freeBranch); the folders stay, an agent may be working in them. The new branch; each copy's
// branch is set to it.
async function renameBranch(copies: Copy[], name: string) {
  const keep = copies[0]?.branch;
  const next = await freeBranch(copies.map((c) => c.worktree), name, { keep });
  for (const c of copies) {
    if (c.branch !== next) await git(c.worktree, ['branch', '-m', c.branch, next]);
    c.branch = next;
  }
  return next;
}

// A repository cloned from a URL into a folder (Project Settings…), with the user's git as it is: its credentials and
// keys; git asks for no password (GIT_TERMINAL_PROMPT=0), so a private repository it cannot reach fails with git's
// own words.
const clone = (url: string, into: string) => git(path.dirname(into), ['clone', '--quiet', '--', url, into], { timeout: 10 * 60_000 });

export type { GitError };
export { git, gitBuffer, repoOf, freeBranch, createWorktree, changes, progress, merged, renameBranch, removeWorktree, clone };
