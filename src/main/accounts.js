// The agents' catalog (☰ → Agents…; tasks.md, "Agents and their accounts"): each agent CLI with its accounts. An
// account is the agent with a config folder of its own, where it keeps its sign-in and settings, given to it by its
// variable (agents.js, config: CLAUDE_CONFIG_DIR, CODEX_HOME), so one human can use a work and a personal Claude
// side by side. The human's own folder (~/.claude, ~/.codex, or what their variable names) is the first account,
// its id the agent's: taken over as it is, never signed in again, never deleted. Accounts added here have their folder
// in Kulisa's data (agents/<id>/), made empty: the agent asks to sign in at its first start in a task, with its own
// login, in that task's terminal. Removing one deletes its folder. Plain Node (no Electron): unit-tested.
//   accounts.json   [{ id, agent, name }]: the accounts added
const fs = require('fs');
const path = require('path');
const { slugOf, nameError } = require('./names');
const { writeFileAtomic } = require('./store');

class Accounts {
  // dir: Kulisa's data folder; agents: the agent CLIs (agents.js entries); markDeleted: a folder for the next start
  // to remove when it cannot go now (store.js).
  constructor(dir, agents, markDeleted = () => {}) {
    this.dir = dir; this.agents = agents; this.markDeleted = markDeleted;
    this.file = path.join(dir, 'accounts.json');
  }
  added() { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return []; } }
  folderOf(id) { return path.join(this.dir, 'agents', id); }
  // Every agent to choose from, its accounts after it: the agent itself (its own account: the human's folder, or none
  // yet), then those added. { id, agent (its entry), name (shown), dir, own }.
  all() {
    const added = this.added();
    return this.agents.flatMap((a) => [
      { id: a.id, agent: a, name: a.name, dir: a.config?.home() ?? null, own: true },
      ...added.filter((x) => x.agent === a.id).map((x) => ({ id: x.id, agent: a, name: `${a.name} · ${x.name}`, dir: this.folderOf(x.id), own: false })),
    ]);
  }
  find(id) { return this.all().find((x) => x.id === id) || null; }
  // A new account of an agent that has accounts (config): its empty folder, signed in at its first start.
  add(agentId, name) {
    name = name?.trim();
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent?.config) return { error: `${agent?.name || agentId} has no accounts` };
    const bad = nameError(name);
    if (bad) return { error: bad };
    const list = this.added();
    if (list.some((x) => x.agent === agentId && x.name.toLowerCase() === name.toLowerCase())) return { error: `${agent.name} has an account ${name} already` };
    const base = `${agentId}-${slugOf(name, 'account')}`;
    let id = base, n = 2;
    while (this.agents.some((a) => a.id === id) || list.some((x) => x.id === id) || fs.existsSync(this.folderOf(id))) id = `${base}-${n++}`;
    fs.mkdirSync(this.folderOf(id), { recursive: true });
    writeFileAtomic(this.file, JSON.stringify([...list, { id, agent: agentId, name }], null, 2));
    return this.find(id);
  }
  // One added here, gone with its folder (its sign-in, settings, conversations). The human's own is not removed.
  remove(id) {
    const list = this.added();
    if (!list.some((x) => x.id === id)) return { error: this.agents.some((a) => a.id === id) ? 'your own account stays: it is yours, not Kulisa\'s' : `no account ${id}` };
    writeFileAtomic(this.file, JSON.stringify(list.filter((x) => x.id !== id), null, 2));
    const dir = this.folderOf(id);
    this.markDeleted(dir);
    fs.rmSync(dir, { recursive: true, force: true });
    return { id };
  }
}

module.exports = { Accounts };
