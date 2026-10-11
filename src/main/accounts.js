// The agents' accounts, one store as the profiles' (tasks.md, "Choosing the agent", Accounts): an account is an agent
// CLI with a config folder of its own, where it keeps its sign-in, settings and conversations, given to it by its
// variable (agents.js, config: CLAUDE_CONFIG_DIR, CODEX_HOME), so one human can use a work and a personal Claude side
// by side. Each is made with the agent's own sign-in, as /login (app.js), in Settings → Agents or in a project, and
// listed in the projects that have it. It stays when its last project lets it go (a sign-in is the human's, made again
// only by signing in again; the author, 2026-10-11): it goes only when the human deletes it (Settings → Agents, Delete
// Account…). Its folder has a fixed id
// (agents/claude-<n>/), never renamed: Claude Code names its macOS Keychain entry after a hash of the folder's path, so
// a folder renamed after the sign-in would lose it; the email it signed in to is kept here and shown. The human's own
// folder (~/.claude, ~/.codex) is no account: every one is made in Kulisa, each a clean agent (the author's decision,
// 2026-10-11). An agent without accounts (the terminal only) is chosen as itself. Plain Node (no Electron): unit-tested.
//   agents.json     { next, list: [{ id, agent, email, folder, projects: [project id] }] }: next, the number of the
//                   next folder, never one used before (a removed one's folder may wait for the next start to go)
//   agents/<folder>/  an account's config folder
const fs = require('fs');
const path = require('path');
const { writeFileAtomic } = require('./store');

class Accounts {
  // dir: Kulisa's data folder; agents: the agent CLIs (agents.js entries); markDeleted: a folder for the next start
  // to remove when it cannot go now (store.js).
  constructor(dir, agents, markDeleted = () => {}) {
    this.dir = dir; this.agents = agents; this.markDeleted = markDeleted;
    this.file = path.join(dir, 'agents.json');
  }
  read() { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return { next: 1, list: [] }; } }
  stored() { return this.read().list; }
  save(list, next = this.read().next) { writeFileAtomic(this.file, JSON.stringify({ next, list }, null, 2)); }
  folderOf(folder) { return path.join(this.dir, 'agents', folder); }
  // Every agent with its accounts after it: the agent itself (own: what is installed, Install; chosen for a task only
  // when it has no accounts: choosable), then its accounts. { id, agent (its entry), name (shown), email, dir, own,
  // choosable, projects }.
  all() {
    const stored = this.stored();
    return this.agents.flatMap((a) => [
      { id: a.id, agent: a, name: a.name, dir: null, own: true, choosable: !a.config },
      ...stored.filter((x) => x.agent === a.id).map((x) => ({ id: x.id, agent: a, name: `${a.name} · ${x.email || x.id}`, email: x.email,
        dir: this.folderOf(x.folder), own: false, choosable: true, projects: x.projects })),
    ]);
  }
  // The agents and accounts a task or a project may run.
  choosable() { return this.all().filter((x) => x.choosable); }
  find(id) { return this.all().find((x) => x.id === id) || null; }
  // The stored one of an agent signed in to this email, if any.
  byEmail(agentId, email) { return (email && this.all().find((x) => !x.own && x.agent.id === agentId && x.email === email)) || null; }
  // Before a sign-in: the folder a new account of the agent gets, empty, numbered as profiles are, never a number used
  // before. { id, dir } or { error }.
  prepare(agentId) {
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent?.config) return { error: `${agent?.name || agentId} has no accounts` };
    const { next, list } = this.read();
    let n = next;
    while (fs.existsSync(this.folderOf(`${agentId}-${n}`))) n++;
    const id = `${agentId}-${n}`, dir = this.folderOf(id);
    fs.mkdirSync(dir, { recursive: true });
    this.save(list, n + 1);
    return { id, dir };
  }
  // Signed in (email: as its status says it, or null when it does not say): stored, in the project it was made in
  // (none: made in Settings → Agents).
  create(project, id, agentId, email) {
    this.save([...this.stored().filter((x) => x.id !== id), { id, agent: agentId, email: email || null, folder: id, projects: project ? [project] : [] }]);
    return this.find(id);
  }
  // Listed in another project too (the Agents' + on a project's page). The own ones are not stored.
  addTo(id, project) {
    const list = this.stored(), x = list.find((a) => a.id === id);
    if (!x) return this.find(id);
    if (!x.projects.includes(project)) { x.projects.push(project); this.save(list); }
    return this.find(id);
  }
  // Let go by a project; it stays in the store, in no project maybe.
  removeFrom(id, project) {
    const list = this.stored(), x = list.find((a) => a.id === id);
    if (x?.projects.includes(project)) { x.projects = x.projects.filter((p) => p !== project); this.save(list); }
  }
  // Deleted by the human: out of the store (its folder: remove, once its agent signed out of it).
  drop(id) { this.save(this.stored().filter((x) => x.id !== id)); }
  // Its folder gone: its sign-in (its agent signed out of it first: app.js), settings and conversations.
  remove(dir) {
    this.markDeleted(dir);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { console.warn('[accounts]', e.message); }
  }
  // At start: what no account stores goes: a folder of a sign-in that did not end (Kulisa quit meanwhile), and the
  // accounts of the format before (accounts.json, named by hand; no migration: old data is deleted).
  clean() {
    const keep = new Set(this.stored().map((x) => x.folder));
    fs.rmSync(path.join(this.dir, 'accounts.json'), { force: true });
    let folders = [];
    try { folders = fs.readdirSync(path.join(this.dir, 'agents')); } catch {}
    for (const f of folders) if (!keep.has(f)) this.remove(this.folderOf(f));
  }
}

module.exports = { Accounts };
