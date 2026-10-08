// A project open in a window (a tab of its own there; window.js shows it): a folder with its workspaces
// (workspaces.js), main and its forks, each with its profiles, grid and agent. What happens to a project's workspaces
// whatever the window shows: making a fork, deleting one, moving to another window, and removing a project's data for
// good. Nothing runs when it opens: a workspace loads when it is first shown.
const fs = require('fs');
const { Workspace } = require('./workspaces');
const worktrees = require('./worktrees');
const { nameError } = require('./names');

class Project {
  // entry: the project in projects.json (store.js): { id, name, folder, color }. shell: the app (app.js), as
  // Workspace takes it. window: the window it is open in (window.js, add).
  constructor(shell, entry) {
    this.shell = shell; this.store = shell.store; this.entry = entry; this.window = null;
    this.id = entry.id; this.name = entry.name; this.folder = entry.folder; this.color = entry.color;
    this.git = null; // 'ok', 'no-commit' (forks wait for a first commit), 'none'
    this.workspaces = new Map(); // by number; main is 1
    const { list, current } = this.store.workspacesOf(entry);
    for (const e of list) this.workspaces.set(e.n, new Workspace(shell, this, e));
    this.ws = this.workspaces.get(current) || this.main; // the one it shows
  }
  get main() { return this.workspaces.get(1); }
  // Its workspace with this key ("<project id>/<n>", workspaces.js), or null.
  workspace(key) { return [...this.workspaces.values()].find((w) => w.key === key) || null; }
  async checkGit() {
    const repo = await worktrees.repoOf(this.folder);
    this.git = repo?.commit ? 'ok' : repo ? 'no-commit' : 'none';
  }
  // The workspace it shows, kept for the next time it opens.
  select(ws) {
    this.ws = ws;
    this.store.saveWorkspacesOf(this, { ...this.store.workspacesOf(this), current: ws.n });
  }

  // A fork of main: a worktree with its own branch, copies of main's profiles, a new agent session in its folder; a
  // port offset no other workspace of the project has. The new Workspace, or { error }.
  async createFork(name, agent) {
    name = name?.trim();
    const bad = nameError(name);
    if (bad) return { error: bad };
    const { store, main } = this;
    let wt;
    try { wt = await worktrees.createWorktree(main.folder, name); } catch (e) { return { error: e.stderr || e.message }; }
    const w = store.workspacesOf(this);
    const n = w.next;
    let offset = 100;
    while (w.list.some((e) => (e.offset || 0) === offset)) offset += 100;
    const entry = { n, name, branch: wt.branch, worktree: wt.worktree, folder: wt.folder, base: wt.base, offset };
    await main.forkProfilesInto(store.workspaceOf(this, n), offset);
    store.workspaceOf(this, n).saveAgent({ agent: agent || main.store.agent().agent });
    store.saveWorkspacesOf(this, { ...w, next: n + 1, list: [...w.list, entry] });
    const ws = new Workspace(this.shell, this, entry);
    this.workspaces.set(n, ws);
    return ws;
  }
  // Closing a fork deletes it: its worktree, branch, profile copies and conversation. The human confirms first, told
  // what goes and what work not in main goes with it.
  async askDeleteFork(ws) {
    const what = changesText(await worktrees.changes(this.folder, ws.entry));
    return this.shell.ask(deleteQuestion({ message: `Delete the workspace ${ws.name}?`, ok: 'Delete', goes: [
      `its folder ${ws.entry.worktree}`, `its branch ${ws.entry.branch}`, 'its profiles (copies of main\'s) with their sign-ins',
      "its agent's conversations in that folder"], notInMain: what && [what] }), this.window);
  }
  // Once it is not shown.
  async deleteFork(ws) {
    await ws.unload();
    this.workspaces.delete(ws.n);
    const w = this.store.workspacesOf(this);
    this.store.saveWorkspacesOf(this, { ...w, current: this.ws.n, list: w.list.filter((e) => e.n !== ws.n) });
    await deleteWorkspace(this.shell, this.entry, ws.entry);
  }
  // Its agents stopped, its profiles saved and closed (its tab closes).
  async unload() { for (const ws of this.workspaces.values()) await ws.unload(); }
  // Into another window (app.js, Move to New Window), running: its profiles' pages go there, hidden until that window
  // lays them out; its agents' output goes there (workspaces.js).
  moveTo(w) {
    for (const ws of this.workspaces.values()) for (const p of ws.profiles.values()) p.moveTo(w.win);
  }
}

// A workspace deleted for good, the one way it is done (closing a fork, removing a project), once it is not running:
// a fork's worktree folder and branch (worktrees.js) and all its agent keeps of its folder (agents.js, forget); its data
// folder, profiles with their sign-ins included. Main: its data only; the project's folder stays, and so does what
// its agent keeps of the project (the human's own, as without Kulisa). p: the project's entry (open or not).
async function deleteWorkspace(shell, p, entry) {
  const { store } = shell;
  const data = store.workspaceOf(p, entry.n);
  if (entry.n !== 1) {
    if (entry.worktree) await worktrees.removeWorktree(p.folder, entry);
    const saved = data.agent();
    const main = { folder: p.folder, ...store.workspaceOf(p, 1).agent() };
    try { shell.agentFor(saved.agent)?.forget?.({ folder: entry.folder, saved, main }); } catch (e) { console.warn('[agents] forget:', e.message); }
  }
  // Its profiles' sessions stay open in Electron until Kulisa quits: whatever cannot go now goes at the next start.
  store.markDeleted(data.dir);
  try { fs.rmSync(data.dir, { recursive: true, force: true }); } catch (e) { console.warn('[workspaces]', e.message); }
}

// Removing a project: the question first, told what goes and which forks have work not in main (the window closes
// the project if it is open in between), then each of its workspaces deleted (forks first) and what is the project's
// as a whole (store.js: its entry, its data folder). Never the project's own folder. p: its entry; w: the window
// that asks.
async function askRemoveProject(shell, p, w) {
  const forks = shell.store.workspacesOf(p).list.filter((e) => e.n !== 1);
  const changed = [];
  for (const e of forks) {
    const what = changesText(await worktrees.changes(p.folder, e));
    if (what) changed.push(`${e.name}: ${what}`);
  }
  return shell.ask(deleteQuestion({ message: `Remove the project ${p.name}?`, ok: 'Remove', goes: [
    'its profiles with their sign-ins, and its layouts',
    ...forks.map((e) => `its workspace ${e.name}: the folder ${e.worktree}, the branch ${e.branch}, its profiles and its agent's conversations`)],
  notInMain: changed, stays: `The project's folder ${p.folder} stays as it is.` }), w);
}
async function removeProjectData(shell, p) {
  const all = shell.store.workspacesOf(p).list;
  for (const e of [...all.filter((x) => x.n !== 1), ...all.filter((x) => x.n === 1)]) await deleteWorkspace(shell, p, e);
  shell.store.removeProject(p);
}

// The question before deleting, the same for a workspace and a project: what goes for good, the work not in main
// that goes with it, what stays.
const deleteQuestion = ({ message, ok, goes, notInMain, stays }) => ({ message, ok, danger: true, detail: [
  `Deleted for good:\n${goes.map((g) => `• ${g}`).join('\n')}`,
  notInMain?.length && `Work not in main, deleted with it:\n${notInMain.map((g) => `• ${g}`).join('\n')}`,
  stays,
].filter(Boolean).join('\n\n') });
// What a fork has that main has not, in words; '' when nothing.
const changesText = ({ commits, dirty }) => [commits && `${commits} commit${commits === 1 ? '' : 's'} of its own`,
  dirty && `${dirty} uncommitted file${dirty === 1 ? '' : 's'}`].filter(Boolean).join(' and ');

module.exports = { Project, askRemoveProject, removeProjectData };
