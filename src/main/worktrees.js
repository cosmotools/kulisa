// The code of a task (tasks.md): a git worktree with its own branch next to the project, `<repo>@<name>/`, made as
// Claude Code's --worktree makes one. A project without git (or before its first commit) has no copies: its tasks work
// in its folder.
// Runs the user's git (a program on every OS), never a shell.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { slugOf } = require('./names');

// Files outside git that a task's copy needs and the project has: its environment and the agent's local settings. The
// project's .worktreeinclude (gitignore syntax, as Claude Code reads it) adds more.
const COPIED = ['/.env*', '/.claude/settings.local.json'];

function git(cwd, args, { timeout = 30000, input } = {}) {
  return new Promise((resolve, reject) => {
    const c = execFile('git', args, { cwd, timeout, maxBuffer: 64 << 20, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (e, out, err) => (e ? reject(Object.assign(e, { stderr: String(err).trim() })) : resolve(String(out).trim())));
    if (input !== undefined) c.stdin.end(input);
  });
}
const ok = (p) => p.then(() => true, () => false);

// The repository the folder is in: { top (its root), sub (the folder inside it), commit (has one) }; null without git.
async function repoOf(folder) {
  const top = await git(folder, ['rev-parse', '--show-toplevel']).catch(() => null);
  if (!top) return null;
  return { top: path.resolve(top), sub: path.relative(path.resolve(top), path.resolve(folder)), commit: await ok(git(folder, ['rev-parse', '--verify', 'HEAD^{commit}'])) };
}

// A name for the branch and the folder: lower case, letters (any language), digits and dashes.
const slug = (name) => slugOf(name, 'task');

// Where a new branch starts, as Claude Code's --worktree: the remote's default branch after a fetch, else HEAD.
async function startPoint(top) {
  const remote = await git(top, ['rev-parse', '--abbrev-ref', 'origin/HEAD']).catch(() => null); // origin/main
  if (remote) {
    await git(top, ['fetch', '--quiet', 'origin', remote.replace(/^origin\//, '')], { timeout: 20000 }).catch((e) => console.warn('[worktrees] fetch:', e.stderr || e.message));
    if (await ok(git(top, ['rev-parse', '--verify', `${remote}^{commit}`]))) return remote;
  }
  return 'HEAD';
}

// A branch for a task, free in each of its repositories (folders: folders in them): the name's slug, else -2, -3 …;
// beside: its copies go next to their repositories (<repo>@<branch>), so those folders must be free too. keep: the
// branch the task has now, free for it.
async function freeBranch(folders, name, { beside = false, keep } = {}) {
  const tops = (await Promise.all(folders.map(repoOf))).filter(Boolean).map((r) => r.top);
  const taken = async (b) => b !== keep && (await Promise.all(tops.map(async (t) => (beside && fs.existsSync(`${t}@${b}`))
    || ok(git(t, ['rev-parse', '--verify', '--quiet', `refs/heads/${b}`]))))).some(Boolean);
  const s = slug(name);
  let branch = s, n = 2;
  while (await taken(branch)) branch = `${s}-${n++}`;
  return branch;
}

// A copy of a repository for a task: a new worktree on a new branch (free: freeBranch), at `at` or next to the
// repository (<repo>@<branch>). { repo (the folder it copies), worktree, branch, base (the commit it starts from),
// folder (that folder inside it) }. Uncommitted changes of the project are not carried; files outside git that it
// needs are copied (COPIED, .worktreeinclude).
async function createWorktree(folder, branch, at) {
  const repo = await repoOf(folder);
  if (!repo?.commit) throw new Error(repo ? `${folder}: the repository has no commit yet` : `${folder} is not in git`);
  const base = await git(repo.top, ['rev-parse', await startPoint(repo.top)]);
  const worktree = at || `${repo.top}@${branch}`;
  fs.mkdirSync(path.dirname(worktree), { recursive: true });
  // --no-track: the branch is the task's own; pushing it does not go to the default branch it started from.
  await git(repo.top, ['worktree', 'add', '--no-track', '-b', branch, worktree, base]);
  const copied = await copyIgnored(repo.top, worktree);
  await allowEnvrc(repo.top, worktree, copied);
  return { repo: folder, worktree, branch, base, folder: path.join(worktree, repo.sub) };
}

// Untracked files that git ignores and the patterns name, copied from the repository into the worktree.
async function copyIgnored(top, worktree) {
  const include = path.join(top, '.worktreeinclude');
  const listed = await git(top, ['ls-files', '--others', '--ignored', '-z', ...COPIED.map((p) => `--exclude=${p}`),
    ...(fs.existsSync(include) ? [`--exclude-from=${include}`] : [])]).catch(() => '');
  const files = listed.split('\0').filter(Boolean);
  if (!files.length) return [];
  // Only what the project's own ignore rules keep out of git: a file meant to be committed is not copied.
  const ignored = (await git(top, ['check-ignore', '--stdin', '-z'], { input: files.join('\0') + '\0' }).catch(() => '')).split('\0').filter(Boolean);
  for (const f of ignored) {
    try {
      fs.mkdirSync(path.dirname(path.join(worktree, f)), { recursive: true });
      fs.copyFileSync(path.join(top, f), path.join(worktree, f));
    } catch (e) { console.error('[worktrees] not copied:', f, e.message); }
  }
  return ignored;
}

// direnv runs a folder's .envrc only once the human has allowed it there, and the task's is a new folder: without this,
// a project's environment (e.g. CLAUDE_CONFIG_DIR, another Claude account) would be missing in the copy, and its agent
// would run as someone else. A copied .envrc is allowed in the copy when the project's, the same content, is allowed.
const run = (cmd, args, cwd) => new Promise((resolve) =>
  execFile(cmd, args, { cwd, timeout: 10000, windowsHide: true }, (e) => resolve(!e)));
async function allowEnvrc(top, worktree, copied) {
  if (!copied.includes('.envrc')) return;
  if (await run('direnv', ['exec', top, 'true'], top)) await run('direnv', ['allow', worktree], worktree);
}

// What a task's copy has that its repository's main has not: commits of its own (since it started, not merged into
// main's HEAD, not on any remote: pushed ones stay there) and uncommitted files.
async function changes({ repo, worktree, branch, base }) {
  const head = await git(repo, ['rev-parse', 'HEAD']).catch(() => null);
  const commits = Number(await git(repo, ['rev-list', '--count', branch, `^${base}`, ...(head ? [`^${head}`] : []), '--not', '--remotes']).catch(() => 0));
  const dirty = fs.existsSync(worktree) ? (await git(worktree, ['status', '--porcelain']).catch(() => '')).split('\n').filter(Boolean).length : 0;
  return { commits, dirty };
}

// A task's copy merged on its remote (its PR merged): it has commits of its own, all of them in the remote's default
// branch (origin/HEAD, fetched first), and no uncommitted files; deleting it then loses nothing. A squash merge makes
// new commits, so it is not seen.
async function merged({ repo, worktree, branch, base }) {
  const remote = await git(repo, ['rev-parse', '--abbrev-ref', 'origin/HEAD']).catch(() => null); // origin/main
  if (!remote) return false;
  await git(repo, ['fetch', '--quiet', 'origin', remote.replace(/^origin\//, '')], { timeout: 20000 }).catch(() => {});
  const count = async (...a) => Number(await git(repo, ['rev-list', '--count', ...a]).catch(() => -1));
  if ((await count(branch, `^${base}`)) < 1 || (await count(branch, `^${remote}`)) !== 0) return false;
  return !fs.existsSync(worktree) || !(await git(worktree, ['status', '--porcelain']).catch(() => 'x'));
}

// direnv's records allowing the task's .envrc (allowEnvrc), removed: one file per content it was allowed with, in
// <XDG data>/direnv/allow/, holding the .envrc's path. Not `direnv deny`: newer direnv keeps a record of that too.
function forgetEnvrc(worktree) {
  const dir = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'direnv', 'allow');
  const envrc = path.join(worktree, '.envrc');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    try { if (fs.readFileSync(path.join(dir, f), 'utf8').trim() === envrc) fs.rmSync(path.join(dir, f)); } catch {}
  }
}

// The worktree and its branch, gone, and whatever was made for them (direnv's permission). A copy of the branch
// already pushed stays on the remote.
async function removeWorktree({ repo, worktree, branch }) {
  forgetEnvrc(worktree);
  await git(repo, ['worktree', 'remove', '--force', '--force', worktree]).catch(async (e) => {
    console.warn('[worktrees] remove:', e.stderr || e.message);
    fs.rmSync(worktree, { recursive: true, force: true });
    await git(repo, ['worktree', 'prune']).catch(() => {});
  });
  await git(repo, ['branch', '-D', branch]).catch((e) => console.warn('[worktrees] branch:', e.stderr || e.message));
}

// A task renamed (its name is the agent's or the human's): the branch of each of its copies takes the name, one
// free in all of them (freeBranch); the folders stay, an agent may be working in them. The new branch; each copy's
// branch is set to it.
async function renameBranch(copies, name) {
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
const clone = (url, into) => git(path.dirname(into), ['clone', '--quiet', '--', url, into], { timeout: 10 * 60_000 });

// git init in the project's folder, only when the human asks for it (New Project), with an empty first commit: a
// worktree needs one. Nothing of the folder is committed. Without the user's name and email set in git, no commit.
async function initRepo(folder) {
  await git(folder, ['init']);
  await git(folder, ['commit', '--allow-empty', '-m', 'Initial commit']);
}

module.exports = { repoOf, freeBranch, createWorktree, changes, merged, renameBranch, removeWorktree, clone, initRepo, copyIgnored, slug, git };
