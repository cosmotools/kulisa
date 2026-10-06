// The code of a workspace (ROADMAP, "Workspaces"): a git worktree with its own branch next to the project,
// `<repo>@<name>/`, made as Claude Code's --worktree makes one. Git only: a project without git has no workspaces.
// Runs the user's git (a program on every OS), never a shell.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { slugOf } = require('./names');

// Files outside git that a fork needs and the project has: its environment and the agent's local settings. The
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
const slug = (name) => slugOf(name, 'workspace');

// Where a new branch starts, as Claude Code's --worktree: the remote's default branch after a fetch, else HEAD.
async function startPoint(top) {
  const remote = await git(top, ['rev-parse', '--abbrev-ref', 'origin/HEAD']).catch(() => null); // origin/main
  if (remote) {
    await git(top, ['fetch', '--quiet', 'origin', remote.replace(/^origin\//, '')], { timeout: 20000 }).catch((e) => console.warn('[worktrees] fetch:', e.stderr || e.message));
    if (await ok(git(top, ['rev-parse', '--verify', `${remote}^{commit}`]))) return remote;
  }
  return 'HEAD';
}

// A new worktree for a workspace named `name`, next to the repository: { worktree, branch, base (the commit it starts
// from), folder (the project's folder inside it) }. Uncommitted changes of the project are not carried; files outside
// git that it needs are copied (COPIED, .worktreeinclude).
async function createWorktree(folder, name) {
  const repo = await repoOf(folder);
  if (!repo?.commit) throw new Error(repo ? 'the repository has no commit yet' : 'the project is not in git');
  const base = await git(repo.top, ['rev-parse', await startPoint(repo.top)]);
  const s = slug(name);
  let branch = s, n = 2;
  const taken = async (b) => fs.existsSync(`${repo.top}@${b}`) || ok(git(repo.top, ['rev-parse', '--verify', '--quiet', `refs/heads/${b}`]));
  while (await taken(branch)) branch = `${s}-${n++}`;
  const worktree = `${repo.top}@${branch}`;
  // --no-track: the branch is the fork's own; pushing it does not go to the default branch it started from.
  await git(repo.top, ['worktree', 'add', '--no-track', '-b', branch, worktree, base]);
  const copied = await copyIgnored(repo.top, worktree);
  await allowEnvrc(repo.top, worktree, copied);
  return { worktree, branch, base, folder: path.join(worktree, repo.sub) };
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

// direnv runs a folder's .envrc only once the human has allowed it there, and the fork is a new folder: without this,
// a project's environment (e.g. CLAUDE_CONFIG_DIR, another Claude account) would be missing in the fork, and its agent
// would run as someone else. A copied .envrc is allowed in the fork when main's, the same content, is allowed.
const run = (cmd, args, cwd) => new Promise((resolve) =>
  execFile(cmd, args, { cwd, timeout: 10000, windowsHide: true }, (e) => resolve(!e)));
async function allowEnvrc(top, worktree, copied) {
  if (!copied.includes('.envrc')) return;
  if (await run('direnv', ['exec', top, 'true'], top)) await run('direnv', ['allow', worktree], worktree);
}

// What a fork has that main has not: commits of its own (since it started, not merged into main's HEAD) and
// uncommitted files. mainFolder: the project's folder.
async function changes(mainFolder, { worktree, branch, base }) {
  const head = await git(mainFolder, ['rev-parse', 'HEAD']).catch(() => null);
  const commits = Number(await git(mainFolder, ['rev-list', '--count', branch, `^${base}`, ...(head ? [`^${head}`] : [])]).catch(() => 0));
  const dirty = fs.existsSync(worktree) ? (await git(worktree, ['status', '--porcelain']).catch(() => '')).split('\n').filter(Boolean).length : 0;
  return { commits, dirty };
}

// direnv's records allowing the fork's .envrc (allowEnvrc), removed: one file per content it was allowed with, in
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
async function removeWorktree(mainFolder, { worktree, branch }) {
  forgetEnvrc(worktree);
  await git(mainFolder, ['worktree', 'remove', '--force', '--force', worktree]).catch(async (e) => {
    console.warn('[worktrees] remove:', e.stderr || e.message);
    fs.rmSync(worktree, { recursive: true, force: true });
    await git(mainFolder, ['worktree', 'prune']).catch(() => {});
  });
  await git(mainFolder, ['branch', '-D', branch]).catch((e) => console.warn('[worktrees] branch:', e.stderr || e.message));
}

// git init in the project's folder: only when the human asks for it (it commits nothing).
const initRepo = (folder) => git(folder, ['init']);

module.exports = { repoOf, createWorktree, changes, removeWorktree, initRepo, copyIgnored, slug, git };
