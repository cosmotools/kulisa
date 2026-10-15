// A project loaded while a task of it is open in some window (app.ts, shell.open): its repositories or folders, and
// its tasks (tasks.ts), each with its code (a worktree of each repository, or a folder itself without git), profiles,
// grid and agent; each open task is a tab of a window (window.ts), of its own, since 2026-10-14 (until then a
// project's open tasks were a group in one window). What happens to a project's tasks whatever the windows show:
// making one, closing and opening it again, renaming, deleting, and removing a project's data for good. Nothing runs
// when it loads: a task loads when it is first shown.
import { nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';
import { Task } from './tasks.ts';
import { freeBranch, createWorktree, removeWorktree, merged, repoOf, changes, clone } from './worktrees.ts';
import { repoName } from '../shared/names.ts';
import type { Result } from '../shared/result.ts';
import type { Shell } from './shell.ts';
import type { ProjectEntry, TaskEntry, Copy, Store } from './store.ts';
import type { StoredProfile } from './profile-store.ts';
import type { ProfileConfig } from './profiles.ts';
import type { AppWindow } from './window.ts';
import type { Question, ProjectRepo } from '../renderer/types.ts';
import type { GitError } from './worktrees.ts';

type Git = 'ok' | 'no-commit' | 'none';
// What asks the window's human about a profile a project lets go: its name and folder.
type Named = Pick<StoredProfile | ProfileConfig, 'name'>;

class Project {
  shell: Shell; store: Store; id: string; entry!: ProjectEntry; name!: string; folder!: string;
  git: Git | null; gits: Map<string, Git>; tasks: Map<number, Task>; next: number;
  // entry: the project in projects.json (store.ts): { id, name, folder, repos, color, agents }. shell: the app
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
  // Its name, agents and repositories, as the projects' manager left them (store.ts, updateProject).
  // folder: its default repository (or folder), where its tasks' agents start.
  update(entry: ProjectEntry) { this.entry = entry; this.name = entry.name; this.folder = reposOf(entry)[0]!; }
  repos() { return reposOf(this.entry); }
  // The agents' accounts its tasks run, the default first.
  agents() { return agentsOf(this.shell, this.entry); }
  // The one a new task starts; none: its tasks start with nothing open (the island's buttons, Terminals.vue).
  defaultAgent() { return defaultOf(this.shell, this.entry); }
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
  }
  save() {
    this.store.saveTasksOf(this, { next: this.next, list: [...this.tasks.values()].map((t) => t.entry) });
  }
  // A new task, named task-<n> until the agent or the human renames it. Its code: a worktree of the default repository
  // on a branch of the task's name (worktrees.ts), the others added when its work needs them (addCopy; the author,
  // 2026-10-13): next to its repository when the project has one, else in one folder for them all,
  // ~/Kulisa/<project>@task-<n>/<repo>/, so that one added later goes beside it; with a port offset no other task
  // has (100, 200, …: the project's own folder keeps the usual ports). A folder without git is used as it is: the
  // task works right in it. Made from the project's configuration alone (the projects' manager), nothing from the
  // task on screen: its agent the project's default one; none: nothing starts, the island shows what can. No profile opens by itself: all its project's are listed closed, and the agent (profile_open)
  // or the human (a task tab's menu) opens one when it is needed, a copy of its master made then. The new Task, or { error }.
  async createTask(): Promise<Result<Task>> {
    const agent = this.defaultAgent();
    await this.checkGit();
    const n = this.next, name = `task-${n}`, repos = this.repos();
    const gits = this.git === 'ok' ? [this.folder] : [];
    let entry: TaskEntry = { n, name, offset: 0, folder: this.folder };
    if (gits.length) {
      const beside = repos.length === 1;
      const branch = await freeBranch(gits, name, { beside });
      const home = beside ? null : freeFolder(path.join(this.shell.projectsHome, `${this.id}@${name}`));
      const copies: Copy[] = [];
      try {
        for (const r of gits) copies.push(await createWorktree(r, branch, home && path.join(home, copyName(copies, r)), this.shell.agentFiles));
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
    // null: the project has agents and none is the default; a project with none leaves it out: a shell starts.
    if (agent || this.agents().length) data.saveAgent({ agent });
    this.next = n + 1;
    const task = new Task(this.shell, this, entry);
    this.tasks.set(n, task);
    this.save();
    return task;
  }
  // Another of its repositories added to a task (Task.addRepository): copied on the task's branch (or the next free
  // name there) into its folder of copies, ~/Kulisa/<project>@task-<n>/. The copy, or { error }.
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
async function askDeleteTask(shell: Shell, entry: TaskEntry, folder: string, w: AppWindow | null) {
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
  const entry = shell.store.updateProject(id, { repos: repos.length ? repos : null })!;
  const open = shell.open.get(id);
  if (open) {
    open.update(entry);
    await open.checkGit();
    shell.sendProjects(); // what its tasks may add
  }
  return { repos: reposOf(entry) };
}
// Cloned from a URL with the user's git (worktrees.ts, clone): into the project's own folder when it has no git
// (~/Kulisa/<project>/<repo>), else next to it, never inside a repository.
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
function askDropProfile(shell: Shell, entry: ProjectEntry, p: Named, by: 'human' | 'agent', w?: AppWindow | null) {
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
async function deleteProfile(shell: Shell, id: string, w: AppWindow | null): Promise<{ ok: true; error?: undefined } | { error: string | null; ok?: undefined }> {
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
  return { ok: true };
}

// The agents' accounts a project's tasks run (the projects' manager), whether it is open or not: added, made the
// default (+ runs it) or none the default (the author, 2026-10-12: its tasks start with the island's buttons), removed.
// The default is the first, unless noDefaultAgent; with no agents left, the next one added is the default. A task keeps
// the agent it started with. The accounts' store (accounts.ts) lists the projects each is in. { agents } or { error }.
function changeAgents(shell: Shell, id: string, list: string[], noDefault?: boolean) {
  const noDefaultAgent = !list.length ? null : noDefault === undefined ? undefined : noDefault || null;
  const entry = shell.store.updateProject(id, { agents: list.length ? list : null, ...(noDefaultAgent !== undefined && { noDefaultAgent }) })!;
  shell.open.get(id)?.update(entry);
  shell.sendProjects(); // +'s right-click menu has them
  return { agents: agentsInfo(shell, entry) };
}
// One no longer known (an agent not offered any more) is left out.
const agentsOf = (shell: Shell, p: ProjectEntry) => (p.agents || []).filter((a) => shell.agentFor(a));
const defaultOf = (shell: Shell, p: ProjectEntry) => (p.noDefaultAgent ? null : agentsOf(shell, p)[0] ?? null);
const agentsInfo = (shell: Shell, p: ProjectEntry) => agentsOf(shell, p).map((a) => ({ id: a, name: shell.agentFor(a)!.name, default: a === defaultOf(shell, p) }));
function addAgent(shell: Shell, id: string, agent: string): Result<{ agents: { id: string; name: string }[] }> {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  if (!shell.agentFor(agent) || shell.agentFor(agent)!.custom) return { error: `no agent ${agent}` };
  if (p.agents?.includes(agent)) return { error: `${shell.agentFor(agent)!.name} is in the project already` };
  shell.accounts.addTo(agent, id);
  return changeAgents(shell, id, [...(p.agents || []), agent]);
}
// agent null: none is the default.
function defaultAgent(shell: Shell, id: string, agent: string | null): Result<{ agents: { id: string; name: string }[] }> {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  if (agent === null) return changeAgents(shell, id, p.agents || [], true);
  if (!p.agents?.includes(agent)) return { error: `${agent} is not in the project` };
  return changeAgents(shell, id, [agent, ...p.agents.filter((a) => a !== agent)], false);
}
// Let go by the project, at once, nothing asked: an account stays in the store (accounts.ts), and a task of the project
// running it keeps it, as one running an agent without accounts does.
function removeAgent(shell: Shell, id: string, agent: string): Result<{ agents: { id: string; name: string }[] }> {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p?.agents?.includes(agent)) return { error: `${agent} is not in the project` };
  const r = changeAgents(shell, id, p.agents.filter((x) => x !== agent));
  shell.accounts.removeFrom(agent, id);
  return r;
}
// Delete Account… (Settings → Agents): only while no task, of any project, open or closed, runs it (its conversation is
// in its folder); asked first, naming the projects it is in; let go by them, signed out with its agent's own command,
// its folder gone. w: the window that asks. { ok } or { error }.
async function deleteAccount(shell: Shell, agent: string, w: AppWindow | null): Promise<{ ok: true; error?: undefined } | { error: string | null; ok?: undefined }> {
  const a = shell.accounts.find(agent);
  if (!a || a.own) return { error: `no account ${agent}` };
  const using = shell.store.projects().flatMap((p) => shell.store.tasksOf(p).list
    .filter((e) => shell.store.taskOf(p, e.n).agent().conversations?.some((c) => c.agent === agent && c.terminal !== undefined)).map((e) => `${e.name} (${p.name})`));
  if (using.length) return { error: `Tasks run it: ${using.join(', ')}. Close its tabs there first, or delete the tasks (Delete Task… in a task's menu).` };
  const projects = shell.store.projects().filter((p) => p.agents?.includes(agent));
  if (!await shell.ask({ message: `Delete the account ${a.name}?`, ok: 'Delete', danger: true,
    detail: [`Its folder ${a.dir} goes, with its sign-in, settings and conversations.`,
      projects.length && `The projects ${projects.map((p) => p.name).join(', ')} let go of it.`].filter(Boolean).join(' ') }, w)) return { error: null };
  for (const p of projects) changeAgents(shell, p.id, p.agents!.filter((x) => x !== agent));
  shell.accounts.drop(agent);
  await shell.dropAccount(a);
  return { ok: true };
}

// What the projects' manager shows of them: each with whether it is in git, and the former folder while it is there:
// one tasks worked in before a repository came, not one that holds the project's repositories (New Project's clones).
async function reposInfo(p: ProjectEntry): Promise<{ repos: ProjectRepo[]; former: string | null }> {
  const repos = await Promise.all(reposOf(p).map(async (folder): Promise<ProjectRepo> => ({ folder, git: await gitOf(folder) })));
  const holds = p.repos?.some((r) => { const rel = path.relative(p.folder, r); return rel && !rel.startsWith('..') && !path.isAbsolute(rel); });
  const former = p.repos?.length && !p.repos.includes(p.folder) && !holds && fs.existsSync(p.folder) ? p.folder : null;
  return { repos, former };
}

// Removing a project: the question first, told what goes and which tasks have work not in main (the window closes the
// project if it is open in between), then each of its tasks deleted and what is the project's as a whole (store.ts:
// its entry, its data folder). Never the project's own folder. p: its entry; w: the window that asks.
async function askDeleteProject(shell: Shell, p: ProjectEntry, w: AppWindow | null) {
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

export { Project, askDeleteProject, deleteClosedTask, deleteProjectData, pictureOf, addRepo, cloneRepo, defaultRepo, removeRepo, reposInfo,
  askDropProfile, dropProfile, deleteProfile, agentsInfo, addAgent, defaultAgent, removeAgent, deleteAccount };
