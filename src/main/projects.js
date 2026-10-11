// A project open in a window (a group of tabs there; window.js shows it): its repositories or folders, and its tasks
// (tasks.js), each with its code (a worktree of each repository, or a folder itself without git), profiles, grid and
// agent. What happens to
// a project's tasks whatever the window shows: making one, closing and opening it again, renaming, deleting, moving
// to another window, and removing a project's data for good. Nothing runs when it opens: a task loads when it is first
// shown.
const fs = require('fs');
const path = require('path');
const { Task } = require('./tasks');
const worktrees = require('./worktrees');

class Project {
  // entry: the project in projects.json (store.js): { id, name, folder, repos, color, icon, agents }. shell: the app
  // (app.js), as Task takes it. window: the window it is open in (window.js, add).
  constructor(shell, entry) {
    this.shell = shell; this.store = shell.store; this.window = null;
    this.id = entry.id; this.update(entry);
    this.git = null; // its default repository's: 'ok', 'no-commit' (no copies before a first commit), 'none'
    this.tasks = new Map(); // by number, open and closed
    const { next, current, collapsed, list } = this.store.tasksOf(entry);
    this.next = next; this.collapsed = !!collapsed;
    for (const e of list) this.tasks.set(e.n, new Task(shell, this, e));
    this.task = this.open().find((t) => t.n === current) || this.open()[0] || null; // the one it shows
  }
  // Its name, color, icon, agents and repositories, as the projects' manager left them (store.js, updateProject).
  // folder: its default repository (or folder), where its tasks' agents start.
  update(entry) { this.entry = entry; this.name = entry.name; this.color = entry.color; this.folder = reposOf(entry)[0]; }
  repos() { return reposOf(this.entry); }
  // The agents' accounts its tasks run, the default first.
  agents() { return agentsOf(this.shell, this.entry); }
  // Its open tasks, in the order they were made (the bar's); the closed ones, the one closed last first.
  open() { return [...this.tasks.values()].filter((t) => !t.entry.closed); }
  closedTasks() { return [...this.tasks.values()].filter((t) => t.entry.closed).sort((a, b) => b.entry.closedAt - a.entry.closedAt); }
  // Its task with this key ("<project id>/<n>", tasks.js), or null.
  taskByKey(key) { return [...this.tasks.values()].find((t) => t.key === key) || null; }
  // An agent.json of one of its tasks with a transcript: where its agents keep their data (agents.js: Claude's config).
  agentData() { return [...this.tasks.values()].map((t) => t.store.agent()).find((a) => a.transcript) || {}; }
  async checkGit() { this.git = await gitOf(this.folder); }
  save() {
    this.store.saveTasksOf(this, { next: this.next, current: this.task?.n ?? null, ...(this.collapsed && { collapsed: true }),
      list: [...this.tasks.values()].map((t) => t.entry) });
  }
  // The task it shows, kept for the next time it opens.
  select(task) { this.task = task; this.save(); }
  // Its group in the bar folded to its label (the shown task's tab stays), as Chrome's tab groups.
  collapse(on) { this.collapsed = !!on; this.save(); }

  // Something to show as it opens: its open task, else the one closed last opened again, else a new one.
  async ensureTask() {
    if (this.task) return this.task;
    const last = this.closedTasks()[0];
    if (last) { this.reopen(last); this.select(last); return last; }
    const task = await this.createTask();
    if (task.error) throw new Error(task.error);
    this.select(task);
    return task;
  }
  // A new task, named task-<n> until the agent or the human renames it. Its code: a worktree of each of the project's
  // repositories with a commit, all on one branch of the task's name (worktrees.js): next to its repository when the
  // project has one, else all in one folder, ~/Kulisa/<project>@task-<n>/<repo>/; with a port offset no other task
  // has (100, 200, …: the project's own folder keeps the usual ports). A folder without git is used as it is: the
  // task works right in it. Made from the project's configuration alone (the projects' manager), nothing from the
  // task on screen: its agent the project's default one, or the one asked for (New Task with); none: the window asks
  // as the task starts. No profile opens by itself: all its project's are listed closed, and the agent (profile_open)
  // or the human (👥) opens one when it is needed, a copy of its master made then. The new Task, or { error }.
  async createTask(agent = null) {
    agent ??= this.agents()[0];
    await this.checkGit();
    const n = this.next, name = `task-${n}`, repos = this.repos();
    const gits = (await Promise.all(repos.map(async (r) => ((await gitOf(r)) === 'ok' ? r : null)))).filter(Boolean);
    let entry = { n, name, offset: 0, folder: this.folder };
    if (gits.length) {
      const beside = repos.length === 1;
      const branch = await worktrees.freeBranch(gits, name, { beside });
      const home = beside ? null : freeFolder(path.join(this.shell.projectsHome, `${this.id}@${name}`));
      const copies = [];
      try {
        for (const r of gits) copies.push(await worktrees.createWorktree(r, branch, home && path.join(home, copyName(copies, r))));
      } catch (e) {
        for (const c of copies) await worktrees.removeWorktree(c);
        if (home) fs.rmSync(home, { recursive: true, force: true });
        return { error: e.stderr || e.message };
      }
      let offset = 100;
      while ([...this.tasks.values()].some((t) => t.offset === offset)) offset += 100;
      entry = { n, name, branch, offset, copies, ...(home && { home }), folder: copies.find((c) => c.repo === this.folder)?.folder };
    }
    const data = this.store.taskOf(this, n);
    data.saveProfiles(this.shell.profileStore.of(this.id).map((g) => ({ folder: g.folder, id: g.id, closed: true })));
    if (agent) data.saveAgent({ agent });
    this.next = n + 1;
    const task = new Task(this.shell, this, entry);
    this.tasks.set(n, task);
    this.save();
    return task;
  }
  // A repository the project got after the task was made (Project Settings…), copied for it on the task's branch (or
  // the next free name there) into its folder of copies, ~/Kulisa/<project>@task-<n>/. The copies made.
  async addCopies(task) {
    const { entry } = task, made = [];
    if (!entry.copies) return made; // a task in a folder without git stays as it is
    for (const r of this.repos()) {
      if (entry.copies.some((c) => c.repo === r) || (await gitOf(r)) !== 'ok') continue;
      entry.home ??= freeFolder(path.join(this.shell.projectsHome, `${this.id}@task-${task.n}`));
      const branch = await worktrees.freeBranch([r], entry.branch);
      try {
        const c = await worktrees.createWorktree(r, branch, path.join(entry.home, copyName(entry.copies, r)));
        entry.copies.push(c); made.push(c);
      } catch (e) { console.warn('[tasks] copy:', e.stderr || e.message); }
    }
    if (made.length) this.save();
    return made;
  }
  // A profile let go by the project (the editor's Delete, the agent's profile_delete): asked first (askDropProfile).
  askDropProfile(p, by = 'human') { return askDropProfile(this.shell, this.entry, p, by, this.window); }
  dropProfile(folder) { return dropProfile(this.shell, this.entry, folder); }
  // Two open tasks in the project's folder (no git: no copies) edit the same files: the human is told, and may go on.
  sharesFolder() { return this.git !== 'ok' && this.open().some((t) => !t.entry.copies && t.folder === this.folder); }
  // × on its tab: its agent stops and its tabs close; everything else stays, and it is listed as closed. Once it is
  // not shown.
  async closeTask(task) {
    task.entry.closed = true; task.entry.closedAt = Date.now();
    if (this.task === task) this.task = this.open()[0] || null;
    this.save();
    await task.unload();
  }
  // Its closed tasks whose PR is merged (worktrees.js, merged: each copy's commits all in its remote's default branch,
  // nothing uncommitted): marked, for its group's menu to offer deleting them (nothing is lost). Checked as the
  // project is shown and a task is closed, in the background (a fetch takes a moment). True when one was found.
  async checkMerged() {
    let found = false;
    for (const t of this.closedTasks()) {
      if (t.entry.merged || !t.entry.copies?.length) continue;
      if ((await Promise.all(t.entry.copies.map((c) => worktrees.merged(c)))).every(Boolean)) { t.entry.merged = true; found = true; }
    }
    if (found) this.save();
    return found;
  }
  // A closed task listed again in the bar (its project's menu), to be shown: it loads then, its agent resumed.
  reopen(task) {
    delete task.entry.closed; delete task.entry.closedAt; delete task.entry.merged;
    this.save();
  }
  // Deleting a task asks first, told what goes for good, with the work not in its repositories' main branches and not
  // pushed that goes with it.
  async askDeleteTask(task) {
    const copies = task.entry.copies || [];
    const what = changesText(await changesOf(copies));
    const goes = [...copies.map((c) => `its folder ${c.worktree}, its branch ${c.branch}`), 'its profiles with their sign-ins',
      ...(copies.length ? ["its agent's conversations in its folder"] : [])];
    return this.shell.ask(deleteQuestion({ message: `Delete the task ${task.name}?`, ok: 'Delete', goes, notInMain: what && [what],
      stays: !copies.length && `It worked in ${task.folder}: its files stay, and so does its agent's conversation there.` }), this.window);
  }
  // Once it is not shown.
  async deleteTask(task) {
    await task.unload();
    this.tasks.delete(task.n);
    if (this.task === task) this.task = this.open()[0] || null;
    this.save();
    await deleteTask(this.shell, this.entry, task.entry);
  }
  // Its group closed (Close Group, a window's ×): its open tasks closed as × on each would, the shown one last (the one
  // closed last is listed first). Then unload.
  closeAll() {
    const now = Date.now(), open = this.open();
    for (const t of [...open.filter((t) => t !== this.task), ...open.filter((t) => t === this.task)]) {
      t.entry.closed = true; t.entry.closedAt = now + (t === this.task ? 1 : 0);
    }
    this.task = null;
    this.save();
  }
  // Its agents stopped, its profiles saved and closed (its tab closes).
  async unload() { for (const task of this.tasks.values()) await task.unload(); }
  // Into another window (app.js, Move to New Window), running: its profiles' pages go there, hidden until that window
  // lays them out; its agents' output goes there (tasks.js).
  moveTo(w) {
    for (const task of this.tasks.values()) for (const p of task.profiles.values()) p.moveTo(w.win);
  }
}

// A project's repositories or folders, the default one first: those added in Project Settings…, else its own folder.
const reposOf = (entry) => (entry.repos?.length ? entry.repos : [entry.folder]);
const gitOf = async (folder) => { const r = await worktrees.repoOf(folder).catch(() => null); return r?.commit ? 'ok' : r ? 'no-commit' : 'none'; };
// A copy's folder name in a task's folder of copies: its repository's, -2 when another copy has it.
function copyName(copies, repo) {
  const base = path.basename(repo);
  let name = base, n = 2;
  while (copies.some((c) => path.basename(c.worktree) === name)) name = `${base}-${n++}`;
  return name;
}
// A folder not there yet: this one, else -2, -3 ….
function freeFolder(f) {
  let free = f, n = 2;
  while (fs.existsSync(free)) free = `${f}-${n++}`;
  return free;
}
const changesOf = async (copies) => (await Promise.all(copies.map((c) => worktrees.changes(c))))
  .reduce((a, b) => ({ commits: a.commits + b.commits, dirty: a.dirty + b.dirty }), { commits: 0, dirty: 0 });

// A task deleted for good, the one way it is done (Delete, removing a project), once it is not running: each copy's
// worktree folder and branch (worktrees.js), its folder of copies, and all its agent keeps of its folder (agents.js,
// forget); its data folder, profiles with their sign-ins included. A task without copies worked in a folder of the
// project: its data only; the folder, and what its agent keeps of it, are the human's, as without Kulisa. p: the
// project's entry (open or not).
async function deleteTask(shell, p, entry) {
  const { store } = shell;
  const data = store.taskOf(p, entry.n);
  for (const c of entry.copies || []) await worktrees.removeWorktree(c);
  if (entry.home) fs.rmSync(entry.home, { recursive: true, force: true });
  if (entry.copies?.length) {
    const saved = data.agent();
    const project = { folder: reposOf(p)[0], ...store.tasksOf(p).list.map((e) => store.taskOf(p, e.n).agent()).find((a) => a.transcript) };
    try { const a = shell.agentFor(saved.agent, { any: true }); a?.forget?.({ folder: entry.folder, saved, project, configDir: a.configDir }); } catch (e) { console.warn('[agents] forget:', e.message); }
  }
  // Its profiles' sessions stay open in Electron until Kulisa quits: whatever cannot go now goes at the next start.
  store.markDeleted(data.dir);
  try { fs.rmSync(data.dir, { recursive: true, force: true }); } catch (e) { console.warn('[tasks]', e.message); }
}

// A project's repositories or folders (Project Settings…), whether it is open or not: added, cloned, made the
// default, removed. Its own folder stays one of them while it is in git; one without git becomes its former folder
// once a repository is added: new tasks work in copies of the repositories, those working in it go on there. Open
// tasks get a copy of a repository added while they run (Task.reposChanged). { repos } or { error }.
async function addRepo(shell, id, folder) {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  folder = path.resolve(folder);
  if (!fs.statSync(folder, { throwIfNoEntry: false })?.isDirectory()) return { error: `${folder} is not a folder` };
  const repos = p.repos?.length ? p.repos : (await gitOf(p.folder)) === 'none' ? [] : [p.folder];
  if (repos.includes(folder)) return { error: `${folder} is in the project already` };
  return changeRepos(shell, id, [...repos, folder]);
}
async function changeRepos(shell, id, repos) {
  const entry = shell.store.updateProject(id, { repos: repos.length ? repos : null });
  const open = shell.open.get(id);
  if (open) {
    open.update(entry);
    for (const t of open.tasks.values()) await t.reposChanged();
  }
  return { repos: reposOf(entry) };
}
// Cloned from a URL with the user's git (worktrees.js, clone): into the project's own folder when it has no git
// (~/Kulisa/<project>/<repo>), else next to it, never inside a repository.
async function cloneRepo(shell, id, url) {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  const name = (url || '').trim().replace(/[\/]+$/, '').split(/[\/:]/).pop().replace(/\.git$/, '');
  if (!name) return { error: 'not a repository URL' };
  const into = path.join((await gitOf(p.folder)) === 'none' ? p.folder : path.dirname(p.folder), name);
  if (fs.existsSync(into)) return { error: `${into} is already there` };
  try { await worktrees.clone(url.trim(), into); } catch (e) { fs.rmSync(into, { recursive: true, force: true }); return { error: e.stderr || e.message }; }
  return addRepo(shell, id, into);
}
// Made the default (new tasks' agents start in its copy), or removed: only when no task has a copy of it or works in
// it, as that would delete or strand their work; the error names them.
async function defaultRepo(shell, id, repo) {
  const p = shell.store.projects().find((x) => x.id === id);
  const repos = p && reposOf(p);
  if (!repos?.includes(repo)) return { error: `${repo} is not in the project` };
  return changeRepos(shell, id, [repo, ...repos.filter((r) => r !== repo)]);
}
async function removeRepo(shell, id, repo) {
  const p = shell.store.projects().find((x) => x.id === id);
  const repos = p && reposOf(p);
  if (!repos?.includes(repo)) return { error: `${repo} is not in the project` };
  if (repos.length === 1) return { error: 'a project needs a folder: add another one first' };
  const using = shell.store.tasksOf(p).list.filter((e) => e.copies?.some((c) => c.repo === repo) || (!e.copies && e.folder === repo));
  if (using.length) return { error: `Tasks work in it: ${using.map((e) => e.name).join(', ')}. Delete them first (Delete Task… in a task's menu).` };
  return changeRepos(shell, id, repos.filter((r) => r !== repo));
}
// A profile a project lets go (the editor's Delete, the agent's profile_delete, × in the projects' manager), whether it
// is open or not: asked first, saying what goes: its copies in the project's tasks; and its master, when no other
// project has it. w: the window that asks.
function askDropProfile(shell, entry, p, by, w) {
  const g = shell.profileStore.byFolder(p.folder);
  const others = (g?.projects || []).filter((x) => x !== entry.id).map((x) => shell.store.projects().find((e) => e.id === x)?.name || x);
  const agent = by === 'agent', end = agent ? '.' : '?';
  return shell.ask(others.length
    ? { ok: 'Remove', danger: true, message: `${agent ? 'The agent asks to remove' : 'Remove'} the profile ${p.name} from ${entry.name}${end}`,
      detail: `Its copies in this project's tasks go, with their tabs and what was signed in only there. It stays in ${others.join(', ')}, with its sign-ins.` }
    : { ok: 'Delete', danger: true, message: `${agent ? 'The agent asks to delete' : 'Delete'} the profile ${p.name}${end}`,
      detail: 'It is in no other project: its sign-ins, cookies, storage and tabs are removed for good.' }, w);
}
// Its copy goes from each of the project's tasks: a loaded one closes it, the others lose it from their files.
async function dropProfile(shell, entry, folder) {
  const g = shell.profileStore.byFolder(folder), open = shell.open.get(entry.id);
  if (g?.projects.length === 1) { await shell.closeMaster(folder); shell.cookieSync.forget(folder); } // its master goes: its window first
  if (open) for (const t of open.tasks.values()) await t.dropProfile(folder);
  else for (const e of shell.store.tasksOf(entry).list) shell.store.taskOf(entry, e.n).dropProfile(folder);
  if (g) shell.profileStore.removeFrom(g.id, entry.id);
  shell.profilesChanged();
}

// The agents' accounts a project's tasks run (the projects' manager), whether it is open or not: added, made the
// default (+ runs it), removed. A task keeps the agent it started with. The accounts' store (accounts.js) lists the
// projects each is in. { agents } or { error }.
function changeAgents(shell, id, list) {
  const entry = shell.store.updateProject(id, { agents: list.length ? list : null });
  shell.open.get(id)?.update(entry);
  shell.sendProjects(); // +'s right-click menu has them
  return { agents: agentsInfo(shell, entry) };
}
// One no longer known (an agent not offered any more) is left out.
const agentsOf = (shell, p) => (p.agents || []).filter((a) => shell.agentFor(a));
const agentsInfo = (shell, p) => agentsOf(shell, p).map((a) => ({ id: a, name: shell.agentFor(a).name }));
function addAgent(shell, id, agent) {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p) return { error: `no project ${id}` };
  if (!shell.agentFor(agent) || shell.agentFor(agent).custom) return { error: `no agent ${agent}` };
  if (p.agents?.includes(agent)) return { error: `${shell.agentFor(agent).name} is in the project already` };
  shell.accounts.addTo(agent, id);
  return changeAgents(shell, id, [...(p.agents || []), agent]);
}
function defaultAgent(shell, id, agent) {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p?.agents?.includes(agent)) return { error: `${agent} is not in the project` };
  return changeAgents(shell, id, [agent, ...p.agents.filter((a) => a !== agent)]);
}
// Let go by the project, at once, nothing asked: an account stays in the store (accounts.js), and a task of the project
// running it keeps it, as one running an agent without accounts does.
function removeAgent(shell, id, agent) {
  const p = shell.store.projects().find((x) => x.id === id);
  if (!p?.agents?.includes(agent)) return { error: `${agent} is not in the project` };
  const r = changeAgents(shell, id, p.agents.filter((x) => x !== agent));
  shell.accounts.removeFrom(agent, id);
  return r;
}
// Delete Account… (Settings → Agents): only while no task, of any project, open or closed, runs it (its conversation is
// in its folder); asked first, naming the projects it is in; let go by them, signed out with its agent's own command,
// its folder gone. w: the window that asks. { ok } or { error }.
async function deleteAccount(shell, agent, w) {
  const a = shell.accounts.find(agent);
  if (!a || a.own) return { error: `no account ${agent}` };
  const using = shell.store.projects().flatMap((p) => shell.store.tasksOf(p).list
    .filter((e) => shell.store.taskOf(p, e.n).agent().agent === agent).map((e) => `${e.name} (${p.name})`));
  if (using.length) return { error: `Tasks run it: ${using.join(', ')}. Delete them first (Delete Task… in a task's menu), or choose another agent there (Change agent…).` };
  const projects = shell.store.projects().filter((p) => p.agents?.includes(agent));
  if (!await shell.ask({ message: `Delete the account ${a.name}?`, ok: 'Delete', danger: true,
    detail: [`Its folder ${a.dir} goes, with its sign-in, settings and conversations.`,
      projects.length && `The projects ${projects.map((p) => p.name).join(', ')} let go of it.`].filter(Boolean).join(' ') }, w)) return { error: null };
  for (const p of projects) changeAgents(shell, p.id, p.agents.filter((x) => x !== agent));
  shell.accounts.drop(agent);
  await shell.dropAccount(a);
  return { ok: true };
}

// What the projects' manager shows of them: each with whether it is in git, and the former folder while it is there.
async function reposInfo(p) {
  const repos = await Promise.all(reposOf(p).map(async (folder) => ({ folder, git: await gitOf(folder) })));
  const former = p.repos?.length && !p.repos.includes(p.folder) && fs.existsSync(p.folder) ? p.folder : null;
  return { repos, former };
}

// Removing a project: the question first, told what goes and which tasks have work not in main (the window closes the
// project if it is open in between), then each of its tasks deleted and what is the project's as a whole (store.js:
// its entry, its data folder). Never the project's own folder. p: its entry; w: the window that asks.
async function askDeleteProject(shell, p, w) {
  const withCopies = shell.store.tasksOf(p).list.filter((e) => e.copies?.length);
  const changed = [];
  for (const e of withCopies) {
    const what = changesText(await changesOf(e.copies));
    if (what) changed.push(`${e.name}: ${what}`);
  }
  return shell.ask(deleteQuestion({ message: `Delete the project ${p.name}?`, ok: 'Delete', goes: [
    ...(() => {
      const only = shell.profileStore.of(p.id).filter((g) => g.projects.length === 1).map((g) => g.name);
      return [only.length ? `its profiles ${only.join(', ')} (in no other project) with their sign-ins` : null, "its tasks' copies of its profiles, and its layouts"].filter(Boolean);
    })(),
    ...withCopies.map((e) => `its task ${e.name}: ${e.copies.map((c) => `the folder ${c.worktree}`).join(', ')}, the branch ${e.branch}, its agent's conversations`)],
  notInMain: changed, stays: `Its folders stay as they are: ${[...new Set([p.folder, ...reposOf(p)])].join(', ')}.` }), w);
}
async function deleteProjectData(shell, p) {
  for (const e of shell.store.tasksOf(p).list) await deleteTask(shell, p, e);
  for (const g of shell.profileStore.of(p.id)) shell.profileStore.removeFrom(g.id, p.id); // its own ones go with their masters
  // Its agents' accounts stay, let go of (Settings → Agents deletes one).
  for (const a of shell.accounts.all().filter((x) => !x.own && x.projects.includes(p.id))) shell.accounts.removeFrom(a.id, p.id);
  shell.store.removeProject(p);
}

// The question before deleting, the same for a task and a project: what goes for good, the work not in main that goes
// with it, what stays.
const deleteQuestion = ({ message, ok, goes, notInMain, stays }) => ({ message, ok, danger: true, detail: [
  `Deleted for good:\n${goes.map((g) => `• ${g}`).join('\n')}`,
  notInMain?.length && `Work not in main and not pushed, deleted with it:\n${notInMain.map((g) => `• ${g}`).join('\n')}`,
  stays,
].filter(Boolean).join('\n\n') });
// What a task has that main and the remote have not, in words; '' when nothing.
const changesText = ({ commits, dirty }) => [commits && `${commits} commit${commits === 1 ? '' : 's'} of its own`,
  dirty && `${dirty} uncommitted file${dirty === 1 ? '' : 's'}`].filter(Boolean).join(' and ');

// A project's own icon: its site's favicon, where web projects keep it (a framework's public or static folder, Next's
// app/), as a data URL for the window; null when there is none. Kulisa's own set (PROJECT_ICONS, the sprite's
// i-p-<name>) otherwise; logo: the app's curtain in the project's color.
const PROJECT_ICONS = ['logo', 'cart', 'briefcase', 'globe', 'flask', 'rocket', 'code', 'building', 'people', 'book', 'heart'];
const FAVICONS = ['favicon.svg', 'favicon.ico', 'favicon.png', 'icon.svg', 'icon.png'].flatMap((f) =>
  ['', 'public', 'static', 'app', 'src', 'src/app', 'assets', 'web', 'www'].map((d) => path.join(d, f)));
const IMAGE_TYPES = { '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
function faviconOf(folder) {
  for (const f of FAVICONS) {
    try {
      const file = path.join(folder, f), size = fs.statSync(file).size;
      if (size && size <= 128 * 1024) return `data:${IMAGE_TYPES[path.extname(f)]};base64,${fs.readFileSync(file).toString('base64')}`;
    } catch {}
  }
  return null;
}

module.exports = { Project, askDeleteProject, deleteProjectData, faviconOf, reposOf, gitOf, addRepo, cloneRepo, defaultRepo, removeRepo, reposInfo,
  askDropProfile, dropProfile, agentsInfo, addAgent, defaultAgent, removeAgent, deleteAccount, PROJECT_ICONS };
