// A project loaded while a task of it is open in some window (app.ts, shell.open): its repositories or folders, and
// its tasks (tasks.ts), each with its code (a worktree of each repository, or a folder itself without git), profiles,
// grid and agent; each open task is a tab of a window (window.ts), of its own. What happens to a project's tasks whatever the windows show:
// making one, closing and opening it again, renaming, deleting, and removing a project's data for good. Nothing runs
// when it loads: a task loads when it is first shown.
import { app, nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';
import { Task } from './tasks.ts';
import { freeBranch, createWorktree, removeWorktree, merged, repoOf, changes, clone } from './worktrees.ts';
import { originKey } from './remotes.ts';
import { REVOKE } from '../github/ipc.ts';
import { nameError, repoName, slugOf } from '../shared/names.ts';
import { refused } from '../shared/result.ts';
import type { Result } from '../shared/result.ts';
import type { Shell } from './shell.ts';
import { worktreesOf, ownWorktree, folderOf, branchOf, homeOf } from './store.ts';
import type { ProjectEntry, TaskEntry, Copy, Worktree, Store } from './store.ts';
import type { StoredProfile } from './profile-store.ts';
import type { ProfileConfig } from './profiles.ts';
import type { AppWindow, Asker } from './window.ts';
import type { Question, ProjectAgent, ProjectGitHub, ProjectRepo, NewProjectSetup } from '../shared/types.ts';
import type { GitError } from './worktrees.ts';

type Git = 'ok' | 'no-commit' | 'none';
// What asks the window's human about a profile a project lets go: its name.
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
  // A new task, "New Task" until the agent or the human names it. It opens with no worktree: its terminal starts in
  // the project's folder (the human's), and its agent makes the task its own git worktree with task_worktree
  // (ensureWorktree) when it reaches code — or the human has it work right in the folder. A project without git works
  // in its folder as it is. Made from the project's configuration alone (the projects' manager), nothing from the task
  // on screen: its agent the project's default one; none: nothing starts, the island shows what can. No profile opens
  // by itself: all its project's are listed closed, and the agent (profile_open) or the human (a task tab's menu)
  // opens one when it is needed, a copy of its master made then. The new Task, or { error }.
  async createTask(): Promise<Result<Task>> {
    const agent = this.defaultAgent();
    await this.checkGit();
    const n = this.next;
    const entry: TaskEntry = { n, name: 'New Task', resources: [{ kind: 'maintree', folder: this.folder }] };
    const data = this.store.taskOf(this, n);
    data.saveProfiles(this.shell.profileStore.of(this.id).map((g) => ({ id: g.id, closed: true })));
    // null: the project has agents and none is the default; a project with none leaves it out: a shell starts.
    if (agent || this.agents().length) data.saveAgent({ agent });
    this.next = n + 1;
    const task = new Task(this.shell, this, entry);
    this.tasks.set(n, task);
    this.save();
    return task;
  }
  // The task's own worktree of the default repository, made on demand (the agent's task_worktree) when it reaches
  // code: a git worktree on a branch of a slug of the task's name (worktrees.ts), beside the repository
  // (<repo>@<branch>) for a single-repo project, else under the task's folder of copies
  // (<projects' home>/<project>@<branch>/<repo>/, so a repository added later goes beside it). Idempotent: the same copy
  // when it is there already (ownWorktree, where it works, whatever the default is now). It takes the main tree's place
  // as the task's first resource. The default repository must be in git with a commit; otherwise the task keeps
  // working in the project's folder. Its worktree, or { error }.
  async ensureWorktree(task: Task): Promise<Result<Worktree>> {
    const have = ownWorktree(task.entry);
    if (have) return have;
    await this.checkGit();
    if (this.git !== 'ok') return { error: this.git === 'no-commit' ? `${this.folder} has no git commit yet to branch from` : `${this.folder} is not in git` };
    const beside = this.repos().length === 1;
    // Named: a slug of the task's name; still "New Task": task-<n> (a later task_rename renames the branch).
    const label = task.entry.named ? task.name : `task-${task.n}`;
    const branch = await freeBranch([this.folder], label, { beside });
    const had = homeOf(task.entry), copies = worktreesOf(task.entry);
    const home = beside ? null : had ?? freeFolder(path.join(this.shell.projectsHome, `${slugOf(this.name, 'project')}@${branch}`));
    try {
      const c: Worktree = { kind: 'worktree', ...await createWorktree(this.folder, branch, home && path.join(home, copyName(copies, this.folder)), this.shell.agentFiles) };
      task.entry.resources = [c, ...copies];
      this.save();
      return c;
    } catch (e) {
      // Made for it, and empty after a failed git worktree add: nothing left behind. Not recursive: another task naming
      // its folder of copies the same at the same moment may have its worktree there.
      if (home && !had) try { fs.rmdirSync(home); } catch { /* not ours, or not empty */ }
      return { error: (e as GitError).stderr || (e as Error).message };
    }
  }
  // Another of its repositories added to a task that has its own worktree (Task.addRepository): copied on the task's
  // branch (or the next free name there) into its folder of copies (ensureWorktree), made now when its own worktree went
  // beside its repository, the project having had one repository then. The copy, or { error }.
  async addCopy(task: Task, repo: string): Promise<Result<Worktree>> {
    const { entry } = task, own = branchOf(entry)!, had = homeOf(entry);
    const home = had ?? freeFolder(path.join(this.shell.projectsHome, `${slugOf(this.name, 'project')}@${own}`));
    const branch = await freeBranch([repo], own);
    try {
      const c: Worktree = { kind: 'worktree', ...await createWorktree(repo, branch, path.join(home, copyName(worktreesOf(entry), repo)), this.shell.agentFiles) };
      entry.resources!.push(c);
      this.save();
      return c;
    } catch (e) {
      if (!had) try { fs.rmdirSync(home); } catch { /* not ours, or not empty */ }
      return { error: (e as GitError).stderr || (e as Error).message };
    }
  }
  // A copy taken out of a task again (Task.removeRepository: one added by mistake, or not needed
  // after all): asked first only when it holds work not in main and not pushed, which goes with it. True when it may go.
  async askRemoveCopy(task: Task, c: Copy) {
    const what = changesText(await changes(c));
    return !what || await this.shell.ask(deleteQuestion({ message: `Remove ${path.basename(c.repo)} from the task ${task.name}?`, ok: 'Remove',
      goes: [`its folder ${c.worktree}, its branch ${c.branch}`], notInMain: [what], stays: `The repository ${c.repo} stays in the project.` }), this.window);
  }
  // Its folder and branch gone as a deleted task's are (removeWorktree), and what the task's agents keep of it.
  async removeCopy(task: Task, c: Worktree) {
    const home = homeOf(task.entry);
    await removeWorktree(c);
    forgetFolder(this.shell, this.entry, task.entry, c.folder);
    task.entry.resources = task.entry.resources!.filter((x) => x !== c);
    if (home && !homeOf(task.entry)) try { fs.rmdirSync(home); } catch { /* not empty */ } // its last copy there
    this.save();
  }
  // A profile let go by the project (the editor's Delete, the agent's profile_delete): asked first (askDropProfile).
  askDropProfile(p: Named, by: 'human' | 'agent' = 'human') { return askDropProfile(this.shell, this.entry, p, by, this.window); }
  dropProfile(id: string) { return dropProfile(this.shell, this.entry, id); }
  // Two open tasks in the project's folder (no git: no copies) edit the same files: the human is told, and may go on.
  sharesFolder() { return this.git !== 'ok' && this.open().some((t) => !ownWorktree(t.entry) && t.folder === this.folder); }
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
      const copies = worktreesOf(t.entry);
      if (t.entry.merged || !copies.length) continue;
      if ((await Promise.all(copies.map((c) => merged(c)))).every(Boolean)) { t.entry.merged = true; found = true; }
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
  const copies = worktreesOf(entry);
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
  if (!await askDeleteTask(shell, entry, folderOf(entry, p.folder), w)) return { error: 'the human said no' };
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
      a?.forget?.({ folder, saved: folder === folderOf(entry, '') ? saved : { transcript: saved.transcript }, project, configDir: a.configDir });
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
  const copies = worktreesOf(entry), home = homeOf(entry);
  for (const c of copies) await removeWorktree(c);
  if (home) fs.rmSync(home, { recursive: true, force: true });
  for (const c of copies) forgetFolder(shell, p, entry, c.folder);
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
  const using = shell.store.tasksOf(p!).list.filter((e) => e.resources?.some((r) => (r.kind === 'worktree' ? r.repo : r.folder) === repo));
  if (using.length) return { error: `Tasks work in it: ${using.map((e) => e.name).join(', ')}. Delete them first (Delete Task… in a task's menu).` };
  const left = repos.filter((r) => r !== repo);
  // Its GitHub account goes with it, unless another of the project's repositories has the same remote.
  const remote = p!.github && await originKey(repo);
  if (remote && !(await Promise.all(left.map((r) => originKey(r)))).includes(remote)) bindGitHub(shell, p!, { [remote]: null });
  return changeRepos(shell, id, left);
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
async function dropProfile(shell: Shell, entry: ProjectEntry, id: string) {
  const open = shell.open.get(entry.id);
  if (open) for (const t of open.tasks.values()) await t.dropProfile(id);
  else for (const e of shell.store.tasksOf(entry).list) shell.store.taskOf(entry, e.n).dropProfile(id);
  shell.profileStore.removeFrom(id, entry.id);
  shell.profilesChanged();
}
// Deleting a profile (Settings → Profiles), after a question: its copies in every project's tasks, then its master
// (its window first) with its sign-ins, for good. { ok }, or { error: null } when the human says no.
async function deleteProfile(shell: Shell, id: string, w: Asker | null): Promise<{ ok: true; error?: undefined } | { error: string | null; ok?: undefined }> {
  const g = shell.profileStore.get(id);
  if (!g) return { error: `no profile ${id}` };
  const projects = shell.store.projectsWith('profiles', id);
  if (!await shell.ask({ message: `Delete the profile ${g.name}?`, ok: 'Delete', danger: true,
    detail: ['Its sign-ins, cookies, storage and tabs are removed for good, here and in every task.',
      projects.length && `The projects ${projects.map((p) => p.name).join(', ')} let go of it.`].filter(Boolean).join(' ') }, w)) return { error: null };
  for (const p of projects) await dropProfile(shell, p, id);
  await shell.closeMaster(id);
  shell.cookieSync.forget(id);
  shell.profileStore.delete(id);
  shell.profilesChanged();
  shell.sendProjects(); // the last of all: nothing left for Settings
  return { ok: true };
}

// The agents' accounts a project's tasks run (the projects' manager), whether it is open or not: added, made the
// default (+ runs it) or none the default (its tasks start with the island's buttons), removed.
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
// Each with its agent and email apart, for their columns (Settings' tables).
const agentsInfo = (shell: Shell, p: ProjectEntry): ProjectAgent[] => agentsOf(shell, p).map((a) => {
  const acc = shell.accounts.find(a)!;
  return { id: a, name: acc.name, agent: acc.agent.name, cli: acc.agent.id, email: acc.email ?? null, default: a === defaultOf(shell, p) };
});
function addAgent(shell: Shell, id: string, agent: string): Result<{ agents: ProjectAgent[] }> {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  if (!shell.agentFor(agent) || shell.agentFor(agent)!.custom) return { error: `no agent ${agent}` };
  if (p.agents?.includes(agent)) return { error: `${shell.agentFor(agent)!.name} is in the project already` };
  return changeAgents(shell, id, [...(p.agents || []), agent]);
}
// agent null: none is the default.
function defaultAgent(shell: Shell, id: string, agent: string | null): Result<{ agents: ProjectAgent[] }> {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  if (agent === null) return changeAgents(shell, id, p.agents || [], true);
  if (!p.agents?.includes(agent)) return { error: `${agent} is not in the project` };
  return changeAgents(shell, id, [agent, ...p.agents.filter((a) => a !== agent)], false);
}
// New Project (docs/tasks.md, Projects), as JetBrains': its code first (the code is often on the
// disk or at a URL already), one repository or several (a frontend and a backend): from
// 'new', <location>/<name>, the location the projects' home (shell.projectsHome) unless the human picks another, so they know where the agent's files
// are; 'folder', the folders given, nothing made, the first the project's; 'clone', one repository cloned into
// <location>/<name>, several into <location>/<name>/<repo> each. git init when asked, with an empty first commit:
// tasks get copies of their own (worktrees) from it. Then its agents (accounts, the first the default) and profiles
// (made in it, or taken from the others), as New Project's steps chose them: what could not be done of those is logged
// and said (problems), the rest done, the project being there already.
type NewProject = { from?: string; name?: string; location?: string; folders?: string[]; urls?: string[] } & NewProjectSetup;
async function createProject(shell: Shell, { from = 'new', name, location, folders = [], urls = [], agents = [], profiles = [] }: NewProject): Promise<Result<{ id: string; problems?: string[] }>> {
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
    }
  }
  let entry = shell.store.projectFor(folder, name);
  if (repos) entry = shell.store.updateProject(entry.id, { repos })!;
  const problems: string[] = [];
  for (const agent of agents) { const r = addAgent(shell, entry.id, agent); if (refused(r)) problems.push(r.error); }
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
// Let go by the project, at once, nothing asked: an account stays in the store (accounts.ts), and a task of the project
// running it keeps it, as one running an agent without accounts does.
function removeAgent(shell: Shell, id: string, agent: string): Result<{ agents: ProjectAgent[] }> {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p?.agents?.includes(agent)) return { error: `${agent} is not in the project` };
  return changeAgents(shell, id, p.agents.filter((x) => x !== agent));
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

// Its repositories' GitHub accounts (src/github/README.md, A repository's account), whether it is open or not: each
// repository's origin by its key (remotes.ts), its account the one bound to that remote in projects.json (github),
// else the first account that reaches it, which is then bound: the account a repository's work goes as stays the
// same, whatever accounts come later, until the human chooses another on its row.
async function githubOf(shell: Shell, id: string): Promise<Result<ProjectGitHub>> {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  const repos = await Promise.all(reposOf(p).map(async (folder) => {
    const remote = await originKey(folder);
    return { folder, remote, ...(await shell.github.repo(remote, (remote && p.github?.[remote]) || null)) };
  }));
  const suggested = Object.fromEntries(repos.filter((r) => r.suggested && r.remote && r.account).map((r) => [r.remote!, r.account!]));
  if (Object.keys(suggested).length) shell.store.updateProject(id, { github: { ...p.github, ...suggested } });
  return { repos, accounts: shell.github.accounts.list().map(({ id, login, kind }) => ({ id, login, kind })) };
}
// The human's choice on a repository's row: an account for its remote, or none (null: Kulisa suggests one again).
async function setGitHub(shell: Shell, id: string, remote: string, account: string | null): Promise<Result<ProjectGitHub>> {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  if (account && !shell.github.accounts.get(account)) return { error: `no GitHub account ${account}` };
  bindGitHub(shell, p, { [remote]: account });
  return githubOf(shell, id);
}
// A project's bindings changed: a remote to an account, or let go (null).
function bindGitHub(shell: Shell, p: ProjectEntry, changes: Record<string, string | null>) {
  const github = Object.fromEntries(Object.entries({ ...p.github, ...changes }).filter((e): e is [string, string] => !!e[1]));
  shell.store.updateProject(p.id, { github: Object.keys(github).length ? github : null });
}
// The projects bound to a GitHub account (their names).
const githubUsers = (shell: Shell, account: string) => shell.store.projects().filter((p) => Object.values(p.github || {}).includes(account)).map((p) => p.name);
// A GitHub account deleted (Settings → GitHub), after a question: its tokens forgotten, its projects let go of it. GitHub's
// API to revoke them needs the App's secret, which Kulisa has not, so the question links the page where the human
// revokes it (src/github/README.md, Deleting). w: the window that asks.
async function deleteGitHub(shell: Shell, id: string, w: Asker | null): Promise<Result<{ ok: true }, string | null>> {
  const a = shell.github.accounts.get(id);
  if (!a) return { error: `no account ${id}` };
  const projects = shell.store.projects().filter((p) => Object.values(p.github || {}).includes(id));
  if (!await shell.ask({ message: `Delete the GitHub account ${a.login}?`, ok: 'Delete', danger: true,
    detail: [`Kulisa forgets its sign-in${projects.length ? `, and the projects ${projects.map((p) => p.name).join(', ')} let go of it` : ''}.`,
      a.kind === 'app' ? 'GitHub keeps the sign-in until it ends (8 hours, or 6 months for its refresh): revoke Kulisa App on GitHub to end it now.'
        : 'The token stays on GitHub until it ends: delete it there to end it now.'].join(' '),
    link: { url: REVOKE[a.kind], label: a.kind === 'app' ? 'Revoke on GitHub' : 'Your tokens on GitHub' } }, w)) return { error: null };
  for (const p of projects) bindGitHub(shell, p, Object.fromEntries(Object.entries(p.github!).filter(([, x]) => x === id).map(([r]): [string, null] => [r, null])));
  shell.github.accounts.delete(id);
  return { ok: true };
}

// Removing a project: the question first, told what goes and which tasks have work not in main (the window closes the
// project if it is open in between), then each of its tasks deleted and what is the project's as a whole (store.ts:
// its entry, its data folder). Never the project's own folder. p: its entry; w: the window that asks.
async function askDeleteProject(shell: Shell, p: ProjectEntry, w: Asker | null) {
  const withCopies = shell.store.tasksOf(p).list.filter((e) => worktreesOf(e).length);
  const changed = [];
  for (const e of withCopies) {
    const what = changesText(await changesOf(worktreesOf(e)));
    if (what) changed.push(`${e.name}: ${what}`);
  }
  return shell.ask(deleteQuestion({ message: `Delete the project ${p.name}?`, ok: 'Delete', goes: [
    "its tasks' copies of its profiles, and its layouts",
    ...withCopies.map((e) => `its task ${e.name}: ${worktreesOf(e).map((c) => `the folder ${c.worktree}`).join(', ')}, the branch ${branchOf(e)}, its agent's conversations`)],
  notInMain: changed, stays: `Its folders stay as they are: ${[...new Set([p.folder, ...reposOf(p)])].join(', ')}. Its profiles stay, with their sign-ins (Settings → Profiles).` }), w);
}
async function deleteProjectData(shell: Shell, p: ProjectEntry) {
  for (const e of shell.store.tasksOf(p).list) await deleteTask(shell, p, e);
  // Its profiles and its agents' accounts stay, in no project maybe (Settings → Profiles and → Agents delete them).
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
  askDropProfile, dropProfile, deleteProfile, agentsInfo, addAgent, defaultAgent, removeAgent, deleteAccount, createProject, folderStateOf,
  githubOf, setGitHub, githubUsers, deleteGitHub };
