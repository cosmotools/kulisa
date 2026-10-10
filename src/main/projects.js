// A project open in a window (a group of tabs there; window.js shows it): a folder with its tasks (tasks.js), each
// with its code (a worktree of its own, or the folder itself without git), profiles, grid and agent. What happens to
// a project's tasks whatever the window shows: making one, closing and opening it again, renaming, deleting, moving
// to another window, and removing a project's data for good. Nothing runs when it opens: a task loads when it is first
// shown.
const fs = require('fs');
const { Task } = require('./tasks');
const worktrees = require('./worktrees');

class Project {
  // entry: the project in projects.json (store.js): { id, name, folder, color }. shell: the app (app.js), as
  // Task takes it. window: the window it is open in (window.js, add).
  constructor(shell, entry) {
    this.shell = shell; this.store = shell.store; this.entry = entry; this.window = null;
    this.id = entry.id; this.name = entry.name; this.folder = entry.folder; this.color = entry.color;
    this.git = null; // 'ok', 'no-commit' (no copies before a first commit), 'none'
    this.tasks = new Map(); // by number, open and closed
    const { next, current, collapsed, list } = this.store.tasksOf(entry);
    this.next = next; this.collapsed = !!collapsed;
    for (const e of list) this.tasks.set(e.n, new Task(shell, this, e));
    this.task = this.open().find((t) => t.n === current) || this.open()[0] || null; // the one it shows
  }
  // Its open tasks, in the order they were made (the bar's); the closed ones, the one closed last first.
  open() { return [...this.tasks.values()].filter((t) => !t.entry.closed); }
  closedTasks() { return [...this.tasks.values()].filter((t) => t.entry.closed).sort((a, b) => b.entry.closedAt - a.entry.closedAt); }
  // Its task with this key ("<project id>/<n>", tasks.js), or null.
  taskByKey(key) { return [...this.tasks.values()].find((t) => t.key === key) || null; }
  // An agent.json of one of its tasks with a transcript: where its agents keep their data (agents.js: Claude's config).
  agentData() { return [...this.tasks.values()].map((t) => t.store.agent()).find((a) => a.transcript) || {}; }
  async checkGit() {
    const repo = await worktrees.repoOf(this.folder);
    this.git = repo?.commit ? 'ok' : repo ? 'no-commit' : 'none';
  }
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
  // A new task, named task-<n> until the agent or the human renames it. With git (and a first commit) its code is a
  // worktree of its own on a branch of the same name next to the project (worktrees.js), with a port offset no other
  // task has (100, 200, …: the project's own folder keeps the usual ports); without, it works right in the project's
  // folder. Its profiles and agent are those of the task from (the project's on screen), copied, until profiles have
  // masters (ROADMAP, "Projects and tasks", step 4); the first task has none. The new Task, or { error }.
  async createTask(from = this.task) {
    await this.checkGit();
    const n = this.next, name = `task-${n}`;
    let entry = { n, name, offset: 0 };
    if (this.git === 'ok') {
      let wt;
      try { wt = await worktrees.createWorktree(this.folder, name); } catch (e) { return { error: e.stderr || e.message }; }
      let offset = 100;
      while ([...this.tasks.values()].some((t) => t.offset === offset)) offset += 100;
      entry = { n, name, branch: wt.branch, worktree: wt.worktree, folder: wt.folder, base: wt.base, offset };
    }
    const data = this.store.taskOf(this, n);
    if (from) {
      await from.copyProfilesInto(data, entry.offset - from.offset);
      data.saveAgent({ agent: from.store.agent().agent });
    }
    this.next = n + 1;
    const task = new Task(this.shell, this, entry);
    this.tasks.set(n, task);
    this.save();
    return task;
  }
  // Two open tasks in the project's folder (no git: no copies) edit the same files: the human is told, and may go on.
  sharesFolder() { return this.git !== 'ok' && this.open().some((t) => !t.entry.worktree); }
  // × on its tab: its agent stops and its tabs close; everything else stays, and it is listed as closed. Once it is
  // not shown.
  async closeTask(task) {
    task.entry.closed = true; task.entry.closedAt = Date.now();
    if (this.task === task) this.task = this.open()[0] || null;
    this.save();
    await task.unload();
  }
  // A closed task listed again in the bar (its project's menu), to be shown: it loads then, its agent resumed.
  reopen(task) {
    delete task.entry.closed; delete task.entry.closedAt;
    this.save();
  }
  // Deleting a task asks first, told what goes for good, with the work not in the project's main branch and not
  // pushed that goes with it.
  async askDeleteTask(task) {
    const { entry } = task;
    const what = entry.worktree && changesText(await worktrees.changes(this.folder, entry));
    const goes = entry.worktree
      ? [`its folder ${entry.worktree}`, `its branch ${entry.branch}`, 'its profiles with their sign-ins', "its agent's conversations in that folder"]
      : ['its profiles with their sign-ins'];
    return this.shell.ask(deleteQuestion({ message: `Delete the task ${task.name}?`, ok: 'Delete', goes, notInMain: what && [what],
      stays: !entry.worktree && `It worked in the project's folder ${this.folder}: its files stay, and so does its agent's conversation there.` }), this.window);
  }
  // Once it is not shown.
  async deleteTask(task) {
    await task.unload();
    this.tasks.delete(task.n);
    if (this.task === task) this.task = this.open()[0] || null;
    this.save();
    await deleteTask(this.shell, this.entry, task.entry);
  }
  // Its agents stopped, its profiles saved and closed (its tab closes).
  async unload() { for (const task of this.tasks.values()) await task.unload(); }
  // Into another window (app.js, Move to New Window), running: its profiles' pages go there, hidden until that window
  // lays them out; its agents' output goes there (tasks.js).
  moveTo(w) {
    for (const task of this.tasks.values()) for (const p of task.profiles.values()) p.moveTo(w.win);
  }
}

// A task deleted for good, the one way it is done (Delete, removing a project), once it is not running: its worktree
// folder and branch (worktrees.js) and all its agent keeps of that folder (agents.js, forget); its data folder,
// profiles with their sign-ins included. A task without a worktree worked in the project's folder: its data only; the
// folder, and what its agent keeps of it, are the human's, as without Kulisa. p: the project's entry (open or not).
async function deleteTask(shell, p, entry) {
  const { store } = shell;
  const data = store.taskOf(p, entry.n);
  if (entry.worktree) {
    await worktrees.removeWorktree(p.folder, entry);
    const saved = data.agent();
    const project = { folder: p.folder, ...store.tasksOf(p).list.map((e) => store.taskOf(p, e.n).agent()).find((a) => a.transcript) };
    try { shell.agentFor(saved.agent)?.forget?.({ folder: entry.folder, saved, project }); } catch (e) { console.warn('[agents] forget:', e.message); }
  }
  // Its profiles' sessions stay open in Electron until Kulisa quits: whatever cannot go now goes at the next start.
  store.markDeleted(data.dir);
  try { fs.rmSync(data.dir, { recursive: true, force: true }); } catch (e) { console.warn('[tasks]', e.message); }
}

// Removing a project: the question first, told what goes and which tasks have work not in main (the window closes the
// project if it is open in between), then each of its tasks deleted and what is the project's as a whole (store.js:
// its entry, its data folder). Never the project's own folder. p: its entry; w: the window that asks.
async function askRemoveProject(shell, p, w) {
  const list = shell.store.tasksOf(p).list, copies = list.filter((e) => e.worktree);
  const changed = [];
  for (const e of copies) {
    const what = changesText(await worktrees.changes(p.folder, e));
    if (what) changed.push(`${e.name}: ${what}`);
  }
  return shell.ask(deleteQuestion({ message: `Remove the project ${p.name}?`, ok: 'Remove', goes: [
    'its profiles with their sign-ins, and its layouts',
    ...copies.map((e) => `its task ${e.name}: the folder ${e.worktree}, the branch ${e.branch}, its agent's conversations`)],
  notInMain: changed, stays: `The project's folder ${p.folder} stays as it is.` }), w);
}
async function removeProjectData(shell, p) {
  for (const e of shell.store.tasksOf(p).list) await deleteTask(shell, p, e);
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

module.exports = { Project, askRemoveProject, removeProjectData };
