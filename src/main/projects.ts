// A project loaded while a task of it is open in some window (app.ts, shell.open): its repositories or folders, and
// its tasks (tasks.ts), each with its code (a worktree of each repository, or a folder itself without git), profiles,
// grid and agent; each open task is a tab of a window (window.ts), of its own, since 2026-10-14 (until then a
// project's open tasks were a group in one window). What happens to a project's tasks whatever the windows show:
// making one, closing and opening it again, renaming, deleting, and removing a project's data for good. Nothing runs
// when it loads: a task loads when it is first shown.
import { app, nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';
import { Task } from './tasks.ts';
import { freeBranch, createWorktree, adoptWorktree, branches, removeWorktree, merged, repoOf, remoteOf, changes, clone, initRepo } from './worktrees.ts';
import { nameError, repoName } from '../shared/names.ts';
import { refused } from '../shared/result.ts';
import type { Result } from '../shared/result.ts';
import type { Shell } from './shell.ts';
import type { ProjectEntry, Role, TaskEntry, Copy, Store } from './store.ts';
import type { StoredProfile } from './profile-store.ts';
import type { ProfileConfig } from './profiles.ts';
import type { AppWindow, Asker } from './window.ts';
import type { Os, Question, ProjectRole, ProjectRepo, NewProjectSetup, NewRole } from '../shared/types.ts';
import type { GitError } from './worktrees.ts';
import type { GithubRepo } from '../github/main/index.ts';
import { leave, thisOs } from './partners.ts';
import { OSES, teamIn, writeTeam, hasProjectFile, newId, projectFile } from '../project-file/main/index.ts';
import type { FileRole } from '../project-file/main/index.ts';

type Git = 'ok' | 'no-commit' | 'none';
// What asks the window's human about a profile a project lets go: its name and folder.
type Named = Pick<StoredProfile | ProfileConfig, 'name'>;

class Project {
  shell: Shell; store: Store; id: string; entry!: ProjectEntry; name!: string; folder!: string;
  git: Git | null; gits: Map<string, Git>; tasks: Map<number, Task>; next: number;
  github: GithubRepo[] = []; // its repositories on GitHub, each with its account, as last found (githubRepos)
  // entry: the project in projects.json (store.ts): { id, name, folder, repos, color, team }. shell: the app
  // (app.ts), as Task takes it.
  constructor(shell: Shell, entry: ProjectEntry) {
    this.shell = shell; this.store = shell.store;
    this.id = entry.id; this.update(entry);
    this.git = null; // its default repository's: 'ok', 'no-commit' (no copies before a first commit), 'none'
    this.gits = new Map(); // each of its repositories', for what a task may add (Task.addable)
    this.tasks = new Map(); // by number, open and closed
    const { next, list } = this.store.tasksOf(entry);
    this.next = next;
    for (const e of list) this.tasks.set(e.n, new Task(shell, this, e));
  }
  // A window of one of its open tasks, for a question about the project (none: the app's first).
  get window(): AppWindow | null { return this.open().find((t) => t.window)?.window ?? null; }
  // Its name, team and repositories, as the projects' manager left them (store.ts, updateProject).
  // folder: its default repository (or folder), where its tasks' agents start.
  update(entry: ProjectEntry) { this.entry = entry; this.name = entry.name; this.folder = reposOf(entry)[0]!; }
  repos() { return reposOf(this.entry); }
  // Its team (docs/tasks.md, The team): its roles, the default first; the accounts they play, each once.
  team() { return teamOf(this.shell, this.entry); }
  agents() { return [...new Set(this.team().map((r) => r.account))]; }
  role(id: string | undefined) { return this.team().find((r) => r.id === id) ?? null; }
  // A role of its repository's file played here for the first time: who plays it, kept on this computer.
  keepPlayer(r: Role) { keepPlayer(this.shell, this.entry, r); }
  // The role a new task starts; none: its tasks start with nothing open (the island's buttons, Terminals.vue).
  defaultRole() { return defaultOf(this.shell, this.entry); }
  // Its open tasks, in the order they were made (the bar's); the closed ones, the one closed last first.
  open() { return [...this.tasks.values()].filter((t) => !t.entry.closed); }
  closedTasks() { return [...this.tasks.values()].filter((t) => t.entry.closed).sort((a, b) => (b.entry.closedAt ?? 0) - (a.entry.closedAt ?? 0)); }
  // Its task with this key ("<project id>/<n>", tasks.ts), or null.
  taskByKey(key: string) { return [...this.tasks.values()].find((t) => t.key === key) || null; }
  // A conversation of one of its tasks with a transcript: where its agents keep their data (agents/: Claude's config).
  agentData() { return [...this.tasks.values()].flatMap((t) => t.conversations()).find((c) => c.transcript) || {}; }
  async checkGit() {
    this.gits = new Map(await Promise.all(this.repos().map(async (r) => [r, await gitOf(r)] as const)));
    this.git = this.gits.get(this.folder)!;
    await this.githubRepos();
  }
  // Its repositories on GitHub and the account each goes as (src/github: GitHub's tools for its agents), found again:
  // a remote, an account chosen or signed in may have changed.
  async githubRepos() { return (this.github = githubList(await Promise.all(this.repos().map((f) => githubOf(this.shell, this.entry, f))))); }
  save() {
    this.store.saveTasksOf(this, { next: this.next, list: [...this.tasks.values()].map((t) => t.entry) });
  }
  // A new task, named task-<n> until the agent or the human renames it. Its code: a worktree of the default repository
  // on a branch of the task's name (worktrees.ts), the others added when its work needs them (addCopy; the author,
  // 2026-10-13): next to its repository when the project has one, else in one folder for them all,
  // <projects' home>/<project>@task-<n>/<repo>/ (shell.projectsHome), so that one added later goes beside it; with a port offset no other task
  // has (100, 200, …: the project's own folder keeps the usual ports). A folder without git is used as it is: the
  // task works right in it. Made from the project's configuration alone (the projects' manager), nothing from the
  // task on screen: its agent the project's default one; none: nothing starts, the island shows what can. No profile opens by itself: all its project's are listed closed, and the agent (profile_open)
  // or the human (a task tab's menu) opens one when it is needed, a copy of its master made then. The new Task, or { error }.
  // on: a branch there is already (New Task from a Branch…, docs/tasks.md): its copy works on it (adoptWorktree), the
  // task named after it, as named by the human (its agents do not rename it).
  // join: the task of another of the human's computers on that branch (partners.ts): the role for this computer's OS,
  // else the default.
  async createTask({ on, join }: { on?: string; join?: boolean } = {}): Promise<Result<Task>> {
    const role = (join && this.team().find((r) => r.os === thisOs())) || this.defaultRole();
    await this.checkGit();
    const n = this.next, repos = this.repos();
    const name = (on && on.replace(/[^\p{L}\p{N}@._+-]+/gu, '-').replace(/^[^\p{L}\p{N}]+/u, '').slice(0, 64)) || `task-${n}`;
    const gits = this.git === 'ok' ? [this.folder] : [];
    if (on && !gits.length) return { error: `${this.folder} is not in git: a task there has no branch` };
    let entry: TaskEntry = { n, name, offset: 0, folder: this.folder };
    if (gits.length) {
      const beside = repos.length === 1;
      const branch = on ?? await freeBranch(gits, name, { beside });
      const home = beside ? null : freeFolder(path.join(this.shell.projectsHome, `${this.id}@${name}`));
      const copies: Copy[] = [];
      try {
        for (const r of gits) {
          const at = home && path.join(home, copyName(copies, r));
          copies.push(await (on ? adoptWorktree(r, on, at, this.shell.agentFiles) : createWorktree(r, branch, at, this.shell.agentFiles)));
        }
      } catch (e) {
        for (const c of copies) await removeWorktree(c);
        if (home) fs.rmSync(home, { recursive: true, force: true });
        return { error: (e as GitError).stderr || (e as Error).message };
      }
      let offset = 100;
      while ([...this.tasks.values()].some((t) => t.offset === offset)) offset += 100;
      entry = { n, name, branch, offset, copies, ...(home && { home }), folder: copies.find((c) => c.repo === this.folder)?.folder };
    }
    const data = this.store.taskOf(this, n);
    data.saveProfiles(this.shell.profileStore.of(this.id).map((g) => ({ folder: g.folder, id: g.id, closed: true })));
    // null: the project has a team and no role is the default; a project with none leaves it out: a shell starts.
    if (role) data.saveAgent({ agent: role.account, role: role.id });
    else if (this.team().length) data.saveAgent({ agent: null });
    this.next = n + 1;
    const task = new Task(this.shell, this, entry);
    this.tasks.set(n, task);
    this.save();
    return task;
  }
  // Another of its repositories added to a task (Task.addRepository): copied on the task's branch (or the next free
  // name there) into its folder of copies, <projects' home>/<project>@task-<n>/. The copy, or { error }.
  async addCopy(task: Task, repo: string): Promise<Result<Copy>> {
    const { entry } = task;
    entry.home ??= freeFolder(path.join(this.shell.projectsHome, `${this.id}@task-${task.n}`));
    const branch = await freeBranch([repo], entry.branch ?? `task-${task.n}`);
    try {
      const c = await createWorktree(repo, branch, path.join(entry.home, copyName(entry.copies!, repo)), this.shell.agentFiles);
      entry.copies!.push(c);
      this.save();
      return c;
    } catch (e) { return { error: (e as GitError).stderr || (e as Error).message }; }
  }
  // A copy taken out of a task again (Task.removeRepository; the author, 2026-10-13: one added by mistake, or not needed
  // after all): asked first only when it holds work not in main and not pushed, which goes with it. True when it may go.
  async askRemoveCopy(task: Task, c: Copy) {
    const what = changesText(await changes(c));
    return !what || await this.shell.ask(deleteQuestion({ message: `Remove ${path.basename(c.repo)} from the task ${task.name}?`, ok: 'Remove',
      goes: [`its folder ${c.worktree}, its branch ${c.branch}`], notInMain: [what], stays: `The repository ${c.repo} stays in the project.` }), this.window);
  }
  // Its folder and branch gone as a deleted task's are (removeWorktree), and what the task's agents keep of it.
  async removeCopy(task: Task, c: Copy) {
    await removeWorktree(c);
    forgetFolder(this.shell, this.entry, task.entry, c.folder);
    task.entry.copies = task.entry.copies!.filter((x) => x !== c);
    this.save();
  }
  // A profile let go by the project (the editor's Delete, the agent's profile_delete): asked first (askDropProfile).
  askDropProfile(p: Named, by: 'human' | 'agent' = 'human') { return askDropProfile(this.shell, this.entry, p, by, this.window); }
  dropProfile(folder: string) { return dropProfile(this.shell, this.entry, folder); }
  // Two open tasks in the project's folder (no git: no copies) edit the same files: the human is told, and may go on.
  sharesFolder() { return this.git !== 'ok' && this.open().some((t) => !t.entry.copies && t.folder === this.folder); }
  // × on its tab: its agent stops and its tabs close; everything else stays, and it is listed as closed. Once it is
  // not shown.
  async closeTask(task: Task) {
    task.entry.closed = true; task.entry.closedAt = Date.now();
    this.save();
    await task.unload();
  }
  // Its closed tasks whose PR is merged (worktrees.ts, merged: each copy's commits all in its remote's default branch,
  // nothing uncommitted): marked, for its menu to offer deleting them (nothing is lost). Checked as a task of it is
  // shown and as one is closed, in the background (a fetch takes a moment). True when one was found.
  async checkMerged() {
    let found = false;
    for (const t of this.closedTasks()) {
      if (t.entry.merged || !t.entry.copies?.length) continue;
      if ((await Promise.all(t.entry.copies.map((c) => merged(c)))).every(Boolean)) { t.entry.merged = true; found = true; }
    }
    if (found) this.save();
    return found;
  }
  // A closed task opened again (the bar's +), to be shown: it loads then, its agent resumed.
  reopen(task: Task) {
    delete task.entry.closed; delete task.entry.closedAt; delete task.entry.merged;
    this.save();
  }
  askDeleteTask(task: Task) { return askDeleteTask(this.shell, task.entry, task.folder, task.window || this.window); }
  // Once it is not shown.
  async deleteTask(task: Task) {
    await task.unload();
    this.tasks.delete(task.n);
    this.save();
    await deleteTask(this.shell, this.entry, task.entry);
  }
}

// A project's repositories or folders, the default one first: those added in Project Settings…, else its own folder.
const reposOf = (entry: ProjectEntry) => (entry.repos?.length ? entry.repos : [entry.folder]);
const gitOf = async (folder: string): Promise<Git> => { const r = await repoOf(folder).catch((): null => null); return r?.commit ? 'ok' : r ? 'no-commit' : 'none'; };
// A copy's folder name in a task's folder of copies: its repository's, -2 when another copy has it.
function copyName(copies: Copy[], repo: string) {
  const base = path.basename(repo);
  let name = base, n = 2;
  while (copies.some((c) => path.basename(c.worktree) === name)) name = `${base}-${n++}`;
  return name;
}
// A folder not there yet: this one, else -2, -3 ….
function freeFolder(f: string) {
  let free = f, n = 2;
  while (fs.existsSync(free)) free = `${f}-${n++}`;
  return free;
}
const changesOf = async (copies: Copy[]) => (await Promise.all(copies.map((c) => changes(c))))
  .reduce((a, b) => ({ commits: a.commits + b.commits, dirty: a.dirty + b.dirty }), { commits: 0, dirty: 0 });

// Deleting a task asks first, told what goes for good, with the work not in its repositories' main branches and not
// pushed that goes with it. folder: where it works (Task.folder).
async function askDeleteTask(shell: Shell, entry: TaskEntry, folder: string, w: Asker | null) {
  const copies = entry.copies || [];
  const what = changesText(await changesOf(copies));
  const goes = [...copies.map((c) => `its folder ${c.worktree}, its branch ${c.branch}`), 'its profiles with their sign-ins',
    ...(copies.length ? ["its agent's conversations in its folder"] : [])];
  return shell.ask(deleteQuestion({ message: `Delete the task ${entry.name}?`, ok: 'Delete', goes, notInMain: what ? [what] : [],
    stays: !copies.length && `It worked in ${folder}: its files stay, and so does its agent's conversation there.` }), w);
}
// A closed task of a project not loaded (the bar's + lists them): nothing of it is loaded, its entry is all there is.
async function deleteClosedTask(shell: Shell, p: ProjectEntry, n: number, w: AppWindow): Promise<Result<{ n: number }>> {
  const entry = shell.store.tasksOf(p).list.find((e) => e.n === n && e.closed);
  if (!entry) return { error: `no closed task ${n}` };
  if (!await askDeleteTask(shell, entry, entry.folder || p.folder, w)) return { error: 'the human said no' };
  await deleteTask(shell, p, entry);
  const file = shell.store.tasksOf(p);
  shell.store.saveTasksOf(p, { ...file, list: file.list.filter((e) => e.n !== n) });
  return { n };
}

// What the agents that worked in a task keep of a folder of its copies (agents/, forget): its conversations there, its
// trust. In its own folder each conversation goes; in another copy's, nothing of a conversation (its session's files
// are not that folder's), only what the agent keeps of the folder.
function forgetFolder(shell: Shell, p: ProjectEntry, entry: TaskEntry, folder: string) {
  const { store } = shell;
  // Each of its conversations: the agents that worked in it, each its account's (tasks.ts).
  const conversations = (e: TaskEntry) => store.taskOf(p, e.n).agent().conversations || [];
  const project = { folder: reposOf(p)[0], ...store.tasksOf(p).list.flatMap(conversations).find((c) => c.transcript) };
  for (const saved of conversations(entry)) {
    try {
      const a = shell.agentFor(saved.agent, { any: true });
      a?.forget?.({ folder, saved: folder === entry.folder ? saved : { transcript: saved.transcript }, project, configDir: a.configDir });
    } catch (e) { console.warn('[agents] forget:', (e as Error).message); }
  }
}

// A task deleted for good, the one way it is done (Delete, removing a project), once it is not running: each copy's
// worktree folder and branch (worktrees.ts), its folder of copies, and all its agent keeps of its folder (agents/,
// forget); its data folder, profiles with their sign-ins included. A task without copies worked in a folder of the
// project: its data only; the folder, and what its agent keeps of it, are the human's, as without Kulisa. p: the
// project's entry (open or not).
async function deleteTask(shell: Shell, p: ProjectEntry, entry: TaskEntry) {
  const { store } = shell;
  const data = store.taskOf(p, entry.n);
  await leave(shell, entry).catch((e: Error) => console.warn('[partners]', e.message)); // its card: this computer off it
  for (const c of entry.copies || []) await removeWorktree(c);
  if (entry.home) fs.rmSync(entry.home, { recursive: true, force: true });
  for (const c of entry.copies || []) forgetFolder(shell, p, entry, c.folder);
  // Its profiles' sessions stay open in Electron until Kulisa quits: whatever cannot go now goes at the next start.
  store.markDeleted(data.dir);
  try { fs.rmSync(data.dir, { recursive: true, force: true }); } catch (e) { console.warn('[tasks]', (e as Error).message); }
}

// A project's repositories or folders (Project Settings…), whether it is open or not: added, cloned, made the
// default, removed. Its own folder stays one of them while it is in git; one without git becomes its former folder
// once a repository is added: new tasks work in copies of the repositories, those working in it go on there. A task
// gets a copy of one added only when it adds it (Task.addRepository). { repos } or { error }.
async function addRepo(shell: Shell, id: string, folder: string): Promise<Result<{ repos: string[] }>> {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  folder = path.resolve(folder);
  if (!fs.statSync(folder, { throwIfNoEntry: false })?.isDirectory()) return { error: `${folder} is not a folder` };
  const repos = p.repos?.length ? p.repos : (await gitOf(p.folder)) === 'none' ? [] : [p.folder];
  if (repos.includes(folder)) return { error: `${folder} is in the project already` };
  return changeRepos(shell, id, [...repos, folder]);
}
async function changeRepos(shell: Shell, id: string, repos: string[]) {
  const chosen = Object.entries(shell.store.projects().find((x) => x.id === id)?.github || {}).filter(([f]) => repos.includes(f)); // a removed one's goes
  const entry = shell.store.updateProject(id, { repos: repos.length ? repos : null, github: chosen.length ? Object.fromEntries(chosen) : null })!;
  const open = shell.open.get(id);
  if (open) {
    open.update(entry);
    await open.checkGit();
    shell.sendProjects(); // what its tasks may add
  }
  return { repos: reposOf(entry) };
}
// Cloned from a URL with the user's git (worktrees.ts, clone): into the project's own folder when it has no git
// (<projects' home>/<project>/<repo>), else next to it, never inside a repository.
async function cloneRepo(shell: Shell, id: string, url: string): Promise<Result<{ repos: string[] }>> {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  const name = repoName(url);
  if (!name) return { error: 'not a repository URL' };
  const into = path.join((await gitOf(p.folder)) === 'none' ? p.folder : path.dirname(p.folder), name);
  if (fs.existsSync(into)) return { error: `${into} is already there` };
  try { await clone(url.trim(), into); } catch (e) { fs.rmSync(into, { recursive: true, force: true }); return { error: (e as GitError).stderr || (e as Error).message }; }
  return addRepo(shell, id, into);
}
// Made the default (new tasks' agents start in its copy), or removed: only when no task has a copy of it or works in
// it, as that would delete or strand their work; the error names them.
async function defaultRepo(shell: Shell, id: string, repo: string): Promise<Result<{ repos: string[] }>> {
  const p = shell.store.projects().find((x) => x.id === id);
  const repos = p && reposOf(p);
  if (!repos?.includes(repo)) return { error: `${repo} is not in the project` };
  return changeRepos(shell, id, [repo, ...repos.filter((r) => r !== repo)]);
}
async function removeRepo(shell: Shell, id: string, repo: string): Promise<Result<{ repos: string[] }>> {
  const p = shell.store.projects().find((x) => x.id === id);
  const repos = p && reposOf(p);
  if (!repos?.includes(repo)) return { error: `${repo} is not in the project` };
  if (repos.length === 1) return { error: 'a project needs a folder: add another one first' };
  const using = shell.store.tasksOf(p!).list.filter((e) => e.copies?.some((c) => c.repo === repo) || (!e.copies && e.folder === repo));
  if (using.length) return { error: `Tasks work in it: ${using.map((e) => e.name).join(', ')}. Delete them first (Delete Task… in a task's menu).` };
  return changeRepos(shell, id, repos.filter((r) => r !== repo));
}
// A profile a project lets go (− on its page, the agent's profile_delete), whether it is open or not: asked first,
// saying what goes: its copies in the project's tasks. The profile stays, with its master (its sign-ins): Settings →
// Profiles deletes it (deleteProfile). w: the window that asks.
function askDropProfile(shell: Shell, entry: ProjectEntry, p: Named, by: 'human' | 'agent', w?: Asker | null) {
  const agent = by === 'agent';
  return shell.ask({ ok: 'Remove', danger: true, message: `${agent ? 'The agent asks to remove' : 'Remove'} the profile ${p.name} from ${entry.name}${agent ? '.' : '?'}`,
    detail: "Its copies in this project's tasks go, with their tabs and what was signed in only there. The profile stays, with its sign-ins: Settings → Profiles deletes it." }, w);
}
// Its copy goes from each of the project's tasks: a loaded one closes it, the others lose it from their files.
async function dropProfile(shell: Shell, entry: ProjectEntry, folder: string) {
  const g = shell.profileStore.byFolder(folder), open = shell.open.get(entry.id);
  if (open) for (const t of open.tasks.values()) await t.dropProfile(folder);
  else for (const e of shell.store.tasksOf(entry).list) shell.store.taskOf(entry, e.n).dropProfile(folder);
  if (g) shell.profileStore.removeFrom(g.id, entry.id);
  shell.profilesChanged();
}
// Deleting a profile (Settings → Profiles), after a question: its copies in every project's tasks, then its master
// (its window first) with its sign-ins, for good. { ok }, or { error: null } when the human says no.
async function deleteProfile(shell: Shell, id: string, w: Asker | null): Promise<{ ok: true; error?: undefined } | { error: string | null; ok?: undefined }> {
  const g = shell.profileStore.get(id);
  if (!g) return { error: `no profile ${id}` };
  const projects = shell.store.projects().filter((p) => g.projects.includes(p.id));
  if (!await shell.ask({ message: `Delete the profile ${g.name}?`, ok: 'Delete', danger: true,
    detail: ['Its sign-ins, cookies, storage and tabs are removed for good, here and in every task.',
      projects.length && `The projects ${projects.map((p) => p.name).join(', ')} let go of it.`].filter(Boolean).join(' ') }, w)) return { error: null };
  for (const p of projects) await dropProfile(shell, p, g.folder);
  await shell.closeMaster(g.folder);
  shell.cookieSync.forget(g.folder);
  shell.profileStore.delete(id);
  shell.profilesChanged();
  shell.sendProjects(); // the last of all: nothing left for Settings
  return { ok: true };
}

// A project's team (the projects' manager; docs/tasks.md, The team), whether it is open or not: a role added (an account
// and the human's words: an account may play several roles, the author, 2026-10-20), its words changed, made the
// default (a new task starts it) or none the default (the author, 2026-10-12: its tasks start with the island's
// buttons), moved, removed. Each role has a place (issue #112): Project, in the repository's file (src/project-file:
// .kulisa/project.json, the same on every computer, its account each computer's own: roleAccounts), or This computer
// (projects.json's team). The file is read once the human trusted it (repoTeam: its words are instructions to agents,
// and a cloned repository's are someone else's). The default: the one chosen on this computer (defaultRole), else
// the file's, else the first; none with noDefaultAgent. A task keeps the role it started with. The accounts' store
// (accounts.ts) lists the projects each plays a role in. { team } or { error }.
type TeamAnswer = Result<{ team: ProjectRole[] }>;
// The default repository, where the file is, when it is in git.
const fileRepo = async (p: ProjectEntry) => { const r = reposOf(p)[0]; return r && (await gitOf(r)) === 'ok' ? r : null; };
const fileRoles = (p: ProjectEntry) => (p.repoTeam && reposOf(p)[0] ? teamIn(reposOf(p)[0]!) : []);
// Who plays a role of the file here: the account chosen once, else the one account of its agent on this computer;
// none: the human chooses (Settings → the role's Played by), or signs one in.
function playerOf(shell: Shell, p: ProjectEntry, r: FileRole) {
  const chosen = p.roleAccounts?.[r.id];
  if (chosen && shell.accounts.find(chosen)?.agent.id === r.agent) return chosen;
  const of = shell.accounts.all().filter((a) => !a.own && a.agent.id === r.agent);
  return of.length === 1 ? of[0]!.id : null;
}
// Every role, the file's first, each with its place; account '' for one of the file nobody plays here yet.
function rolesOf(shell: Shell, p: ProjectEntry): Role[] {
  return [...fileRoles(p).map((r): Role => ({ id: r.id, account: playerOf(shell, p, r) ?? '', place: 'project', agent: r.agent,
    ...(r.name && { name: r.name }), ...(r.about && { about: r.about }), ...(r.model && { model: r.model }), ...(r.os && { os: r.os }), ...(r.default && { fileDefault: true }) })),
  ...(p.team || [])];
}
// The roles a task can play (an account known), the default first. One whose account is no longer known (an agent not
// offered any more) is left out.
function teamOf(shell: Shell, p: ProjectEntry) {
  const list = rolesOf(shell, p).filter((r) => r.account && shell.agentFor(r.account)), d = pickDefault(p, list);
  return d ? [d, ...list.filter((r) => r !== d)] : list;
}
const pickDefault = (p: ProjectEntry, list: Role[]) => (p.noDefaultAgent ? null
  : list.find((r) => r.id === p.defaultRole) ?? list.find((r) => r.fileDefault) ?? list[0] ?? null);
const defaultOf = (shell: Shell, p: ProjectEntry) => (p.noDefaultAgent ? null : teamOf(shell, p)[0] ?? null);
// Each with its account's agent and email apart, for their columns (Settings' tables); one of the file nobody plays
// here with the accounts of its agent that may.
const teamInfo = (shell: Shell, p: ProjectEntry): ProjectRole[] => {
  const roles = rolesOf(shell, p), d = pickDefault(p, roles.filter((r) => r.account && shell.agentFor(r.account)));
  return (d ? [d, ...roles.filter((r) => r !== d)] : roles).flatMap((r) => { // the default first, as a new task takes it
    const acc = r.account ? shell.accounts.find(r.account) : null, a = r.account ? shell.agentFor(r.account) : null;
    const agent = acc?.agent ?? shell.accounts.all().find((x) => x.own && x.agent.id === r.agent)?.agent;
    if (!agent || (r.account && !a)) return [];
    return [{ id: r.id, role: r.name ?? '', about: r.about ?? '', account: r.account, name: acc?.name ?? '', agent: agent.name, cli: agent.id,
      email: acc?.email ?? null, default: r === d, model: r.model ?? null, models: a?.model?.list(a.configDir) ?? [], place: r.place ?? 'computer',
      players: r.place ? shell.accounts.all().filter((x) => !x.own && x.agent.id === agent.id).map((x) => ({ id: x.id, name: x.email || x.id })) : [], os: r.os ?? null }];
  });
};
// Whether a role may go into the file: the default repository in git, and the file the human's (trusted, or not
// there yet: the first role written makes it).
async function fileOpen(p: ProjectEntry) {
  const repo = await fileRepo(p);
  return { repo, can: !!repo && p.repoTeam !== false && (p.repoTeam === true || !hasProjectFile(repo)) };
}
// What Settings shows of the file: where it is, whether a role may go there, whether it is used.
async function repoTeamOf(p: ProjectEntry) {
  const { repo, can } = await fileOpen(p);
  return { file: repo ? projectFile(repo) : null, exists: !!repo && hasProjectFile(repo), can, used: p.repoTeam ?? null };
}
// A change: the roles of this computer, the file's (written at once: the human commits it), the choices of this
// computer; then the accounts' projects, the open project, the windows.
function saveTeam(shell: Shell, p: ProjectEntry, change: { local?: Role[]; file?: FileRole[]; fields?: Partial<{ [K in keyof ProjectEntry]: ProjectEntry[K] | null }> }): TeamAnswer {
  const before = new Set(rolesOf(shell, p).map((r) => r.account).filter(Boolean));
  if (change.file) {
    const w = writeTeam(reposOf(p)[0]!, change.file);
    if (w.error) return { error: w.error };
  }
  const local = change.local?.map(({ place: _p, agent: _a, fileDefault: _d, ...r }) => r);
  const entry = shell.store.updateProject(p.id, { ...(local && { team: local.length ? local : null }), ...(change.file && { repoTeam: true }), ...change.fields })!;
  const after = new Set(rolesOf(shell, entry).map((r) => r.account).filter(Boolean));
  for (const a of after) if (!before.has(a)) shell.accounts.addTo(a, p.id);
  for (const a of before) if (!after.has(a)) shell.accounts.removeFrom(a, p.id);
  shell.open.get(p.id)?.update(entry);
  shell.sendProjects(); // the island's + has them
  return { team: teamInfo(shell, entry) };
}
// A role as the file keeps it (its agent set: a role of the file, or one moved there).
const toFile = (r: Role, isDefault: boolean): FileRole => ({ id: r.id, agent: r.agent!, ...(r.name && { name: r.name }), ...(r.about && { about: r.about }),
  ...(r.model && { model: r.model }), ...(r.os && { os: r.os }), ...(isDefault && { default: true }) });
const ROLE_MAX = 40, ABOUT_MAX = 500; // a role's name (a tab's), what it does (as a profile's description)
// A role's words as the human typed them: trimmed, a name on one line; too long, refused.
function words({ role, about }: { role?: string; about?: string }): Result<{ name?: string; about?: string }> {
  const name = role?.replace(/\s+/g, ' ').trim(), what = about?.trim();
  if (name && name.length > ROLE_MAX) return { error: `a role's name of at most ${ROLE_MAX} characters` };
  if (what && what.length > ABOUT_MAX) return { error: `what a role does in at most ${ABOUT_MAX} characters` };
  return { ...(name && { name }), ...(what && { about: what }) };
}
const projectOf = (shell: Shell, id: string) => shell.store.projects().find((x) => x.id === id) ?? null;
// A new role, in the file when it can go there (the default: described once for every computer), unless the human
// chose This computer.
async function addRole(shell: Shell, id: string, { account, place, ...said }: NewRole): Promise<TeamAnswer> {
  const p = projectOf(shell, id);
  if (!p) return { error: `no project ${id}` };
  const a = shell.agentFor(account);
  if (!a || a.custom) return { error: `no agent ${account}` };
  const w = words(said);
  if (refused(w)) return w;
  const taken = new Set(rolesOf(shell, p).map((r) => r.id));
  if (place !== 'computer' && (await fileOpen(p)).can) {
    const r: FileRole = { id: newId(taken), agent: a.agentId, ...w };
    return saveTeam(shell, p, { file: [...fileRoles(p), r], fields: { roleAccounts: { ...p.roleAccounts, [r.id]: account } } });
  }
  if (place === 'project') return { error: `${p.name}'s repository cannot keep its team: ${(await fileRepo(p)) ? 'its team file is not used (Settings, the project\'s Team)' : 'its code is not in git'}` };
  const n = Math.max(0, ...(p.team || []).map((r) => Number(r.id.slice(1)) || 0)) + 1;
  return saveTeam(shell, p, { local: [...(p.team || []), { id: `r${n}`, account, ...w }] });
}
// Its name, what it does, the model it starts with ('': the agent's own), who plays it here (one of the file's), its
// place (moved into the file or out of it), as the human changed them; what is left out stays.
async function updateRole(shell: Shell, id: string, role: string, said: { role?: string; about?: string; model?: string; os?: Os | ''; account?: string; place?: 'project' | 'computer' }): Promise<TeamAnswer> {
  const p = projectOf(shell, id), r = p && rolesOf(shell, p).find((x) => x.id === role);
  if (!p || !r) return { error: `no role ${role} in the project` };
  const w = words(said);
  if (refused(w)) return w;
  const changed: Role = { id: r.id, account: r.account, ...(r.place && { place: r.place, agent: r.agent }) };
  const name = said.role === undefined ? r.name : w.name, about = said.about === undefined ? r.about : w.about;
  const model = said.model === undefined ? r.model : said.model.trim();
  if (model && model.length > 100) return { error: 'a model of at most 100 characters' };
  if (name) changed.name = name;
  if (about) changed.about = about;
  if (model) changed.model = model;
  const os = said.os === undefined ? r.os : said.os || undefined;
  if (os && !OSES.includes(os)) return { error: `no OS ${os}` };
  if (os) changed.os = os;
  if (said.account !== undefined) {
    if (!r.place) return { error: 'a role of this computer keeps its account: Change Agent in a task hands it over' };
    if (shell.accounts.find(said.account)?.agent.id !== r.agent) return { error: `${said.account} is no account of its agent` };
    changed.account = said.account;
  }
  const place = said.place ?? r.place ?? 'computer', isDefault = !!r.fileDefault;
  const file = fileRoles(p), local = p.team || [];
  const players = (acc: string) => ({ roleAccounts: { ...p.roleAccounts, [r.id]: acc } });
  if (place === 'project' && !r.place) { // into the file
    if (!(await fileOpen(p)).can) return { error: `${p.name}'s repository cannot keep its team: ${(await fileRepo(p)) ? 'its team file is not used' : 'its code is not in git'}` };
    const moved = { ...changed, agent: shell.agentFor(r.account)!.agentId };
    return saveTeam(shell, p, { file: [...file, toFile(moved, false)], local: local.filter((x) => x.id !== r.id), fields: players(r.account) });
  }
  if (place === 'computer' && r.place) { // out of it, to this computer
    if (!changed.account) return { error: 'choose who plays it on this computer first (Played by)' };
    const { place: _p, agent: _a, ...kept } = changed;
    return saveTeam(shell, p, { file: file.filter((x) => x.id !== r.id), local: [...local, kept] });
  }
  if (r.place) return saveTeam(shell, p, { file: file.map((x) => (x.id === r.id ? toFile(changed, isDefault) : x)), ...(changed.account !== r.account && { fields: players(changed.account) }) });
  return saveTeam(shell, p, { local: local.map((x) => (x.id === r.id ? changed : x)) });
}
// An account signed in to on the project's page (agents.ts, account:signin): a role of its own; one it plays a role
// already is said (another role of it is + on its team).
async function joinTeam(shell: Shell, id: string, account: string): Promise<TeamAnswer> {
  const p = projectOf(shell, id);
  return p && rolesOf(shell, p).some((r) => r.account === account) ? { error: `${shell.agentFor(account)?.name} is in the project already` } : addRole(shell, id, { account });
}
// role null: none is the default. One of the file: the file's default (every computer's), unless this one chose its own.
function defaultRole(shell: Shell, id: string, role: string | null): TeamAnswer {
  const p = projectOf(shell, id);
  if (!p) return { error: `no project ${id}` };
  if (role === null) return saveTeam(shell, p, { fields: { noDefaultAgent: true } });
  const r = rolesOf(shell, p).find((x) => x.id === role);
  if (!r) return { error: `no role ${role} in the project` };
  if (!r.place) return saveTeam(shell, p, { fields: { defaultRole: r.id, noDefaultAgent: null } });
  return saveTeam(shell, p, { file: fileRoles(p).map((x) => ({ ...x, default: x.id === r.id || undefined })), fields: { defaultRole: null, noDefaultAgent: null } });
}
// The file's team used or not (the question on its first sight, or the project's Settings).
function useRepoTeam(shell: Shell, id: string, use: boolean): TeamAnswer {
  const p = projectOf(shell, id);
  return p ? saveTeam(shell, p, { fields: { repoTeam: use } }) : { error: `no project ${id}` };
}
// The first time a project's file with a team is seen here (a new task of it): asked whether to use it, its roles
// shown, the answer kept. w: the window that asks.
const asking = new Map<string, Promise<void>>();
function askRepoTeam(shell: Shell, id: string, w: Asker | null) {
  const p = projectOf(shell, id), repo = p && reposOf(p)[0];
  if (!p || p.repoTeam !== undefined || !repo || !hasProjectFile(repo)) return Promise.resolve();
  const roles = teamIn(repo);
  if (!roles.length) return Promise.resolve();
  if (!asking.has(id)) {
    asking.set(id, shell.ask({ message: `Use the team from ${p.name}'s repository?`, ok: 'Use It', cancel: 'Not Now',
      detail: `${projectFile(repo)} describes its roles; their words go to its agents as what they do:\n` +
        roles.map((r) => `${r.name || r.agent} (${r.agent})${r.about ? `: ${r.about}` : ''}`).join('\n') +
        '\nUse it only if you trust who wrote it. Settings changes this, on the project\'s Team.' }, w)
      .then((yes) => { useRepoTeam(shell, id, yes); }).finally(() => asking.delete(id)));
  }
  return asking.get(id)!;
}
// A role of the file played on this computer for the first time (Task.openRole): its account kept here.
function keepPlayer(shell: Shell, p: ProjectEntry, r: Role) {
  if (r.place && r.account && p.roleAccounts?.[r.id] !== r.account) shell.store.updateProject(p.id, { roleAccounts: { ...p.roleAccounts, [r.id]: r.account } });
}
// New Project (docs/tasks.md, Projects), as JetBrains': its code first (the author, 2026-10-11: a folder made in ~/Kulisa
// was in the way of code already on the disk or at a URL), one repository or several (a frontend and a backend): from
// 'new', <location>/<name>, the location the projects' home (shell.projectsHome) unless the human picks another, so they know where the agent's files
// are; 'folder', the folders given, nothing made, the first the project's; 'clone', one repository cloned into
// <location>/<name>, several into <location>/<name>/<repo> each. git init when asked, with an empty first commit:
// tasks get copies of their own (worktrees) from it. Then its team (roles, the first the default) and profiles
// (made in it, or taken from the others), as New Project's steps chose them: what could not be done of those is logged
// and said (problems), the rest done, the project being there already.
type NewProject = { from?: string; name?: string; location?: string; folders?: string[]; urls?: string[]; git?: boolean } & NewProjectSetup;
async function createProject(shell: Shell, { from = 'new', name, location, folders = [], urls = [], git, team = [], profiles = [] }: NewProject): Promise<Result<{ id: string; problems?: string[] }>> {
  name = name?.trim();
  const bad = nameError(name);
  if (bad) return { error: bad };
  let folder: string, repos: string[] | null = null;
  if (from === 'folder') {
    const given = [...new Set(folders.map((f) => full(f)))];
    if (!given.length || given.includes(null)) return { error: given.length ? 'each folder must be a full path' : 'no folder' };
    const states = await Promise.all(given.map((f) => folderState(shell, f!)));
    for (const [i, f] of given.entries()) {
      const s = states[i]!;
      if (s.state === 'new') return { error: `${f} is not there` };
      const no = refusal(f!, s);
      if (no) return { error: no };
    }
    for (const [i, f] of given.entries()) {
      if (git && states[i]!.state !== 'repo') await initRepo(f!).catch((err: GitError) => console.error('[git]', err.stderr || err.message));
    }
    folder = given[0]!;
    if (given.length > 1) repos = given as string[];
  } else {
    const made = newFolder({ location, name });
    if (!made) return { error: 'the location must be the full path of a folder' };
    folder = made;
    const there = await folderState(shell, folder);
    const no = refusal(folder, there);
    if (no) return { error: no };
    if (from === 'clone') {
      urls = [...new Set(urls.map((u) => u?.trim()).filter((u) => !!u))];
      if (!urls.length) return { error: 'no repository URL' };
      if (!['new', 'empty'].includes(there.state)) return { error: `${folder} is there already: choose another name or location` };
      const intos = urls.length === 1 ? [folder] : urls.map((u) => path.join(folder, repoName(u)));
      if (intos.includes(folder) && urls.length > 1 || new Set(intos).size < intos.length) return { error: 'two repositories of the same name' };
      fs.mkdirSync(urls.length === 1 ? path.dirname(folder) : folder, { recursive: true }); // git runs there
      for (const [i, u] of urls.entries()) {
        try { await clone(u, intos[i]!); } catch (e) {
          const err = e as GitError;
          // None of it kept: a project with half its code would look made.
          for (const f of intos.slice(0, i + 1)) if (f !== folder || there.state === 'new') fs.rmSync(f, { recursive: true, force: true });
          if (there.state === 'new') fs.rmSync(folder, { recursive: true, force: true });
          return { error: `${u}: ${err.stderr || err.message}` };
        }
      }
      if (urls.length > 1) repos = intos;
    } else {
      fs.mkdirSync(folder, { recursive: true });
      if (git && there.state !== 'repo') await initRepo(folder).catch((err: GitError) => console.error('[git]', err.stderr || err.message));
    }
  }
  let entry = shell.store.projectFor(folder, name);
  if (repos) entry = shell.store.updateProject(entry.id, { repos })!;
  const problems: string[] = [];
  for (const role of team) { const r = await addRole(shell, entry.id, role); if (refused(r)) problems.push(r.error); }
  for (const p of profiles) {
    const r = 'id' in p ? shell.profileStore.addTo(p.id, entry.id) : shell.profileStore.create(entry.id, p);
    if (refused(r)) problems.push('id' in p ? r.error : `${p.name}: ${r.error}`);
  }
  if (profiles.length) shell.profilesChanged();
  if (problems.length) console.error(`[project] ${entry.id} made, but: ${problems.join('; ')}`);
  return { id: entry.id, ...(problems.length && { problems }) };
}
// What a new project's folder is now (New Project says it as it is typed): not there, there (taken as it is, its
// files kept), a repository (git init skipped), or a project's already (refused).
async function folderState(shell: Shell, folder: string): Promise<{ state: string; project?: string }> {
  if (!fs.existsSync(folder)) return { state: 'new' };
  if (!fs.statSync(folder).isDirectory()) return { state: 'file' };
  const of = shell.store.projectOf(folder);
  if (of) return { state: 'project', project: of.name };
  return { state: (await repoOf(folder)) ? 'repo' : fs.readdirSync(folder).length ? 'files' : 'empty' };
}
const full = (f: string | undefined): string | null => {
  f = f?.trim().replace(/^~(?=$|[\\/])/, app.getPath('home'));
  return f && path.isAbsolute(f) ? path.normalize(f) : null;
};
const newFolder = ({ from, location, name, folder }: { from?: string; location?: string; name?: string; folder?: string }) => (from === 'folder' ? full(folder)
  : full(location) && name?.trim() ? path.join(full(location)!, name.trim()) : null);
const refusal = (folder: string, there: { state: string; project?: string }) => ({ file: `${folder} is a file, not a folder`, project: `${folder} is the project ${there.project}'s already` } as Record<string, string>)[there.state];
// The folder a new project's form names (folders on disk: the one typed; else <location>/<name>), and what it is.
async function folderStateOf(shell: Shell, args: { from?: string; location?: string; name?: string; folder?: string }) {
  const folder = newFolder(args);
  return folder ? { folder, ...await folderState(shell, folder) } : null;
}
// Taken out of the team, at once, nothing asked: its account stays in the store (accounts.ts), and a task of the
// project running it keeps it, as one running an agent without accounts does. One of the file goes from the file:
// from every computer, once committed.
function removeRole(shell: Shell, id: string, role: string): TeamAnswer {
  const p = projectOf(shell, id), r = p && rolesOf(shell, p).find((x) => x.id === role);
  if (!p || !r) return { error: `no role ${role} in the project` };
  if (r.place) return saveTeam(shell, p, { file: fileRoles(p).filter((x) => x.id !== role) });
  return saveTeam(shell, p, { local: p.team!.filter((x) => x.id !== role) });
}
// Delete Account… (Settings → Agents): only while no task, of any project, open or closed, runs it (its conversation is
// in its folder); asked first, naming the projects it is in; let go by them, signed out with its agent's own command,
// its folder gone. w: the window that asks. { ok } or { error }.
async function deleteAccount(shell: Shell, agent: string, w: Asker | null): Promise<{ ok: true; error?: undefined } | { error: string | null; ok?: undefined }> {
  const a = shell.accounts.find(agent);
  if (!a || a.own) return { error: `no account ${agent}` };
  const using = shell.store.projects().flatMap((p) => shell.store.tasksOf(p).list
    .filter((e) => shell.store.taskOf(p, e.n).agent().conversations?.some((c) => c.agent === agent && c.terminal !== undefined)).map((e) => `${e.name} (${p.name})`));
  if (using.length) return { error: `Tasks run it: ${using.join(', ')}. Close its tabs there first, or delete the tasks (Delete Task… in a task's menu).` };
  const projects = shell.store.projects().filter((p) => rolesOf(shell, p).some((r) => r.account === agent));
  if (!await shell.ask({ message: `Delete the account ${a.name}?`, ok: 'Delete', danger: true,
    detail: [`Its folder ${a.dir} goes, with its sign-in, settings and conversations.`,
      projects.length && `The projects ${projects.map((p) => p.name).join(', ')} let go of it.`].filter(Boolean).join(' ') }, w)) return { error: null };
  for (const p of projects) {
    saveTeam(shell, p, { local: (p.team || []).filter((r) => r.account !== agent),
      fields: { roleAccounts: Object.fromEntries(Object.entries(p.roleAccounts || {}).filter(([, a]) => a !== agent)) } });
  }
  shell.accounts.drop(agent);
  await shell.dropAccount(a);
  return { ok: true };
}

// A repository's GitHub account (issue #48; src/github): the one chosen for it on its row, else the one that reaches
// it; none for a remote not on GitHub.
async function githubOf(shell: Shell, p: ProjectEntry, folder: string): Promise<Pick<ProjectRepo, 'github'>> {
  const { repo, suggested } = shell.github.forRemote(await remoteOf(folder));
  if (!repo) return {};
  const chosen = p.github?.[folder], account = chosen ?? suggested;
  return { github: { repo, account, login: account && shell.github.login(account), chosen: !!chosen } };
}
const githubList = (repos: Pick<ProjectRepo, 'github'>[]): GithubRepo[] => repos.flatMap(({ github: g }) => (g ? [{ repo: g.repo, account: g.account }] : []));
// The account chosen on a repository's row; null: the one Kulisa suggests.
function chooseGithub(shell: Shell, id: string, folder: string, account: string | null): Result {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p || !reposOf(p).includes(folder)) return { error: `${folder} is not in the project` };
  if (account && !shell.github.login(account)) return { error: `no GitHub account ${account}` };
  const github = { ...p.github };
  if (account) github[folder] = account; else delete github[folder];
  const entry = shell.store.updateProject(id, { github: Object.keys(github).length ? github : null })!;
  shell.open.get(id)?.update(entry);
  return {};
}
// The projects whose repositories go as the account (Settings → GitHub), and those that let go of it when it is deleted.
const githubUsers = (shell: Shell, account: string) => shell.store.projects().filter((p) => Object.values(p.github || {}).includes(account));
function forgetGithub(shell: Shell, account: string) {
  for (const p of githubUsers(shell, account)) {
    const github = Object.fromEntries(Object.entries(p.github!).filter(([, a]) => a !== account));
    shell.open.get(p.id)?.update(shell.store.updateProject(p.id, { github: Object.keys(github).length ? github : null })!);
  }
}

// The branches a new task of the project can work on (New Task from a Branch…): its default repository's.
async function branchesOf(shell: Shell, id: string) {
  const p = projectOf(shell, id);
  if (!p) return { error: `no project ${id}` };
  if (!(await repoOf(reposOf(p)[0]!))?.commit) return { error: `${p.name}'s code is not in git: its tasks have no branches` };
  return { branches: await branches(reposOf(p)[0]!) };
}

// What the projects' manager shows of them: each with whether it is in git, and the former folder while it is there:
// one tasks worked in before a repository came, not one that holds the project's repositories (New Project's clones).
async function reposInfo(shell: Shell, p: ProjectEntry): Promise<{ repos: ProjectRepo[]; former: string | null }> {
  const repos = await Promise.all(reposOf(p).map(async (folder): Promise<ProjectRepo> => ({ folder, git: await gitOf(folder), ...await githubOf(shell, p, folder) })));
  const open = shell.open.get(p.id);
  if (open) open.github = githubList(repos); // as found now: what its agents are told
  const holds = p.repos?.some((r) => { const rel = path.relative(p.folder, r); return rel && !rel.startsWith('..') && !path.isAbsolute(rel); });
  const former = p.repos?.length && !p.repos.includes(p.folder) && !holds && fs.existsSync(p.folder) ? p.folder : null;
  return { repos, former };
}

// Removing a project: the question first, told what goes and which tasks have work not in main (the window closes the
// project if it is open in between), then each of its tasks deleted and what is the project's as a whole (store.ts:
// its entry, its data folder). Never the project's own folder. p: its entry; w: the window that asks.
async function askDeleteProject(shell: Shell, p: ProjectEntry, w: Asker | null) {
  const withCopies = shell.store.tasksOf(p).list.filter((e) => e.copies?.length);
  const changed = [];
  for (const e of withCopies) {
    const what = changesText(await changesOf(e.copies!));
    if (what) changed.push(`${e.name}: ${what}`);
  }
  return shell.ask(deleteQuestion({ message: `Delete the project ${p.name}?`, ok: 'Delete', goes: [
    "its tasks' copies of its profiles, and its layouts",
    ...withCopies.map((e) => `its task ${e.name}: ${e.copies!.map((c) => `the folder ${c.worktree}`).join(', ')}, the branch ${e.branch}, its agent's conversations`)],
  notInMain: changed, stays: `Its folders stay as they are: ${[...new Set([p.folder, ...reposOf(p)])].join(', ')}. Its profiles stay, with their sign-ins (Settings → Profiles).` }), w);
}
async function deleteProjectData(shell: Shell, p: ProjectEntry) {
  for (const e of shell.store.tasksOf(p).list) await deleteTask(shell, p, e);
  // Its profiles and its agents' accounts stay, let go of (Settings → Profiles and → Agents delete them).
  for (const g of shell.profileStore.of(p.id)) shell.profileStore.removeFrom(g.id, p.id);
  for (const a of shell.accounts.all().filter((x) => !x.own && x.projects!.includes(p.id))) shell.accounts.removeFrom(a.id, p.id);
  shell.store.removeProject(p);
}

// The question before deleting, the same for a task and a project: what goes for good, the work not in main that goes
// with it, what stays.
const deleteQuestion = ({ message, ok, goes, notInMain, stays }: { message: string; ok: string; goes: string[]; notInMain: string[]; stays: string | false }): Question => ({ message, ok, danger: true, detail: [
  `Deleted for good:\n${goes.map((g) => `• ${g}`).join('\n')}`,
  notInMain?.length && `Work not in main and not pushed, deleted with it:\n${notInMain.map((g) => `• ${g}`).join('\n')}`,
  stays,
].filter(Boolean).join('\n\n') });
// What a task has that main and the remote have not, in words; '' when nothing.
const changesText = ({ commits, dirty }: { commits: number; dirty: number }) => [commits && `${commits} commit${commits === 1 ? '' : 's'} of its own`,
  dirty && `${dirty} uncommitted file${dirty === 1 ? '' : 's'}`].filter(Boolean).join(' and ');

// A picture for the window, as a data URL; null when it is not there or not a picture. Up to 128 KB as it is; a larger
// PNG or JPEG made 64 px wide (nativeImage reads only those two on every OS).
const PICTURE_TYPES: Record<string, string> = { '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
function pictureOf(file: string) {
  const type = PICTURE_TYPES[path.extname(file).toLowerCase()];
  try {
    const size = fs.statSync(file).size;
    if (!type || !size) return null;
    if (size <= 128 * 1024) return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
    const image = ['image/png', 'image/jpeg'].includes(type) ? nativeImage.createFromPath(file) : null;
    return image && !image.isEmpty() ? image.resize({ width: 64 }).toDataURL() : null;
  } catch { return null; }
}

export { Project, reposOf, askDeleteProject, deleteClosedTask, deleteProjectData, pictureOf, addRepo, cloneRepo, defaultRepo, removeRepo, reposInfo, chooseGithub, githubUsers, forgetGithub,
  askDropProfile, dropProfile, deleteProfile, branchesOf, teamInfo, addRole, joinTeam, updateRole, defaultRole, removeRole, useRepoTeam, askRepoTeam, repoTeamOf, deleteAccount, createProject, folderStateOf };
