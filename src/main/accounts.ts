// The agents' accounts, one store as the profiles' (tasks.md, "Choosing the agent", Accounts): an account is an agent
// CLI with a config folder of its own, where it keeps its sign-in, settings and conversations, given to it by its
// variable (agents/, config: CLAUDE_CONFIG_DIR, CODEX_HOME), so one human can use a work and a personal Claude side
// by side. Each is made with the agent's own sign-in, as /login (app.ts), in Settings → Agents or in a project, and
// listed in the projects that have it (projects.json's agents: store.ts). It stays when its last project lets it go (a sign-in is the human's, made again
// only by signing in again): it goes only when the human deletes it (Settings → Agents, Delete
// Account…). Its folder is its id
// (agents/<agent>-<six random>/, as claude-k3x9ab), never renamed: Claude Code names its macOS Keychain entry after a
// hash of the folder's path, so a folder renamed after the sign-in would lose it; the email it signed in to is kept here
// and shown. The human's own folder (~/.claude, ~/.codex) is no account: every one is made in Kulisa, each a clean
// agent. An agent without accounts (the terminal only) is chosen as itself. Plain Node (no Electron): unit-tested.
//   agents.json     { list: [{ id, agent, email, folder }] }
//   agents/<folder>/  an account's config folder
import fs from 'fs';
import path from 'path';
import { newId, writeFileAtomic } from './store.ts';
import type { Agent } from './agents/index.ts';

interface Stored { id: string; agent: string; email: string | null; folder: string }
// An agent itself (own) or one of its accounts, as all() lists them.
interface Account {
  id: string; agent: Agent; name: string; dir: string | null; own: boolean; choosable: boolean; email?: string | null;
}

class Accounts {
  dir: string; agents: Agent[]; markDeleted: (dir: string) => void; file: string;
  // dir: Kulisa's data folder; agents: the agent CLIs (agents/ entries); markDeleted: a folder for the next start
  // to remove when it cannot go now (store.ts).
  constructor(dir: string, agents: Agent[], markDeleted: (dir: string) => void = () => {}) {
    this.dir = dir; this.agents = agents; this.markDeleted = markDeleted;
    this.file = path.join(dir, 'agents.json');
  }
  stored(): Stored[] { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')).list || []; } catch { return []; } }
  save(list: Stored[]) { writeFileAtomic(this.file, JSON.stringify({ list }, null, 2)); }
  folderOf(folder: string) { return path.join(this.dir, 'agents', folder); }
  // Every agent with its accounts after it: the agent itself (own: what is installed, Install; chosen for a task only
  // when it has no accounts: choosable), then its accounts. { id, agent (its entry), name (shown), email, dir, own,
  // choosable }.
  all(): Account[] {
    const stored = this.stored();
    return this.agents.flatMap((a) => [
      { id: a.id, agent: a, name: a.name, dir: null as string | null, own: true, choosable: !a.config },
      ...stored.filter((x) => x.agent === a.id).map((x) => ({ id: x.id, agent: a, name: `${a.name} · ${x.email || x.id}`, email: x.email,
        dir: this.folderOf(x.folder), own: false, choosable: true })),
    ]);
  }
  // The agents and accounts a task or a project may run.
  choosable() { return this.all().filter((x) => x.choosable); }
  find(id: string | undefined): Account | null { return this.all().find((x) => x.id === id) || null; }
  // The stored one of an agent signed in to this email, if any.
  byEmail(agentId: string, email: string | null) { return (email && this.all().find((x) => !x.own && x.agent.id === agentId && x.email === email)) || null; }
  // Before a sign-in: the folder a new account of the agent gets, empty, its id random: one no account has and no folder
  // has (a removed account's folder may wait for the next start to go, and a new one must not find it). { id, dir } or
  // { error }.
  prepare(agentId: string): { id: string; dir: string; error?: undefined } | { error: string } {
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent?.config) return { error: `${agent?.name || agentId} has no accounts` };
    const list = this.stored(), taken = (id: string) => list.some((x) => x.id === id) || fs.existsSync(this.folderOf(id));
    const id = `${agentId}-${newId((s) => taken(`${agentId}-${s}`))}`, dir = this.folderOf(id);
    fs.mkdirSync(dir, { recursive: true });
    return { id, dir };
  }
  // Signed in (email: as its status says it, or null when it does not say): stored; a project it was made in lists it
  // (projects.ts, addAgent).
  create(id: string, agentId: string, email: string | null) {
    this.save([...this.stored().filter((x) => x.id !== id), { id, agent: agentId, email: email || null, folder: id }]);
    return this.find(id);
  }
  // Deleted by the human: out of the store (its folder: remove, once its agent signed out of it).
  drop(id: string) { this.save(this.stored().filter((x) => x.id !== id)); }
  // Its folder gone: its sign-in (its agent signed out of it first: app.ts), settings and conversations.
  remove(dir: string) {
    this.markDeleted(dir);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { console.warn('[accounts]', (e as Error).message); }
  }
  // At start: what no account stores goes: a folder of a sign-in that did not end (Kulisa quit meanwhile), and the
  // accounts of the format before (accounts.json, named by hand; no migration: old data is deleted).
  clean() {
    const keep = new Set(this.stored().map((x) => x.folder));
    fs.rmSync(path.join(this.dir, 'accounts.json'), { force: true });
    let folders: string[] = [];
    try { folders = fs.readdirSync(path.join(this.dir, 'agents')); } catch {}
    for (const f of folders) if (!keep.has(f)) this.remove(this.folderOf(f));
  }
}

export type { Account };
export { Accounts };
