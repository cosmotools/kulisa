// The profiles of a task: its project's profiles (profile-store.ts: who each is, its master), in their order, open
// ones (a Profile: tabs, automation) and closed ones (their settings and the URLs of their tabs only; still signed
// in). What the task has of each is its own: a copy of the master, made when the profile is first opened here, its tabs,
// open or closed, its sites' zoom (TaskStore: profiles.json, the copy's folder). Creates, renames, describes (for the
// whole store), closes, opens and lets go of them. `profiles` (open ones: Profile) and `closed` (closed ones: their
// entry) are maps by id, in the list's order, for everything that looks a profile up (Task: profiles, closed).
// What it takes to run a profile is the task's (tasks.ts), given as hooks:
//   make(cfg) -> Profile        a Profile for the settings, not started yet
//   copy(entry)                 its folder made from its master (the first open in this task), its tabs set
//   start(profile, urls)        its tabs open, automation connected
//   unload(profile)             its tabs closed, its sign-ins saved
//   urlsOf(profile)             where its tabs are, to open them again
//   renamed(profile, oldId)     its id changed (the proxy's endpoint)
//   remove({ cfg, profile })    its copy gone for good (profile: when it is open)
//   changed()                   after any change: the window's state and the tabs are saved
//   everywhere()                who a profile is changed in the store: every task shows it
import fs from 'fs';
import { clearCaches } from './profiles.ts';
import type { Profile, ProfileConfig } from './profiles.ts';
import type { TaskStore, TaskProfile } from './store.ts';
import type { ProfileStore, StoredProfile } from './profile-store.ts';
import type { Result } from '../shared/result.ts';
import { refused } from '../shared/result.ts';

// A profile of the task: who it is (cfg), its tabs' addresses while closed, its Profile while open.
interface Entry { cfg: ProfileConfig; urls: string[]; profile: Profile | null; closed?: boolean; starting?: Promise<unknown> | null }
interface Hooks {
  make(cfg: ProfileConfig): Profile;
  copy(entry: Entry): Promise<void>;
  start(profile: Profile, urls: string[]): Promise<unknown>;
  unload(profile: Profile): Promise<void>;
  urlsOf(profile: Profile): string[];
  renamed(profile: Profile, oldId: string): void;
  remove(entry: Entry): Promise<void>;
  changed(): void;
  everywhere(): void;
}

class ProjectProfiles {
  store: TaskStore; all: ProfileStore; project: string; hooks: Hooks;
  entries: Entry[] = []; // { cfg: { id, name, avatar, description, folder, dir, zoom }, urls, profile }
  profiles = new Map<string, Profile>(); closed = new Map<string, Entry>();
  started: Promise<void> = Promise.resolve(); // the open ones' starts as the task loaded (load), awaited by its agents
  // store: the task's (TaskStore); profiles: the store of profiles (ProfileStore); project: its project's id.
  constructor(store: TaskStore, profiles: ProfileStore, project: string, hooks: Hooks) {
    this.store = store; this.all = profiles; this.project = project; this.hooks = hooks;
  }

  // The project's profiles, with what this task has of each; the closed ones stay closed. A new task has them all
  // closed (projects.ts, createTask); one the project got later comes closed. The open ones are made at once (in the
  // maps) and started behind, together (their cookies, tabs, automation: a site's answer away): the task's grid waits
  // for none of them, as it waited for each in turn until 2026-10-15. Saved once they have started.
  load() {
    const state = new Map((this.store.profiles() || []).map((x) => [x.folder, x]));
    this.entries = this.all.of(this.project).map((g) => ({ cfg: this._cfg(g, state.get(g.folder)), urls: this.store.tabs(g.folder),
      profile: null as Profile | null, closed: !state.has(g.folder) || !!state.get(g.folder)!.closed }));
    this._sync();
    this.started = Promise.all(this.entries.filter((e) => !e.closed).map((e) => this._start(e)
      .catch((err: Error) => console.error(`[profiles] ${e.cfg.id} did not open: ${err.message}`))))
      .then(() => { for (const e of this.entries) delete e.closed; this.save(); });
  }
  // The task closes (another project opens, it is deleted): the open profiles are unloaded and the list goes.
  async unloadAll() {
    await this.started; // a profile still opening, once it is open
    for (const e of this.entries) if (e.profile) await this.hooks.unload(e.profile);
    this.entries = []; this._sync();
  }
  // Who its profiles are, read again after a change made elsewhere (another task, Project Settings…): names, ids,
  // pictures, descriptions follow; one the project got comes closed; one it let go is gone (let go: drop).
  refresh() {
    const list = this.all.of(this.project);
    for (const g of list) {
      const e = this.entries.find((x) => x.cfg.folder === g.folder);
      if (!e) { this.entries.push({ cfg: this._cfg(g), urls: [], profile: null }); continue; }
      const oldId = e.cfg.id;
      Object.assign(e.cfg, { id: g.id, name: g.name, avatar: g.avatar, description: g.description || '', ...loginOf(g) });
      if (e.profile) {
        Object.assign(e.profile, { name: g.name, avatar: g.avatar, description: g.description || '', ...loginOf(g) });
        if (g.id !== oldId) { e.profile.id = g.id; this.hooks.renamed(e.profile, oldId); }
      }
    }
    this._sync();
    this.save();
  }

  // A new, empty profile of the project, open here; from the editor and from the agent (profile_create).
  // avatar: the human's pick (the editor), else the next one free.
  async create(name: string, description = '', avatar?: string): Promise<Result<{ id: string }>> {
    const g = this.all.create(this.project, { name, description, avatar });
    if (refused(g)) return g;
    const e: Entry = { cfg: this._cfg(g), urls: [], profile: null };
    this.entries.push(e);
    await this._start(e);
    this._changed();
    this.hooks.everywhere();
    return { id: g.id };
  }

  // Close: the tabs go (their memory too); it stays in the project, signed in, and opens again with the same tabs.
  async close(id: string): Promise<Result<{ id: string }>> {
    const e = this._find(id);
    if (!e?.profile) return { error: `no open profile ${id}` };
    await e.starting?.catch(() => {}); // closed right as it opens: once it is open
    if (!e.profile) return { id };
    const p = e.profile;
    e.urls = this.hooks.urlsOf(p);
    e.cfg = this._cfgOf(e);
    e.profile = null;
    this._sync();
    await this.hooks.unload(p);
    await clearCaches(p.session).catch((err: Error) => console.error(`[kulisa] ${id}: caches not cleared: ${err.message}`));
    this._changed();
    return { id };
  }
  async open(id: string): Promise<Result<{ id: string }>> {
    const e = this._find(id);
    if (!e) return { error: `no profile ${id}` };
    if (!e.profile) { await this._start(e); this._changed(); }
    return { id };
  }

  // Who a profile of the project is, changed (the store checks and keeps it: profile-store.ts): its name and id (its
  // folders, tabs, place in the list and the agent's connection stay), what it is in the app under test, its picture,
  // a test user's pair (its password as the caller encrypted it: tasks.ts). Here at once, the other tasks after.
  rename(id: string, name: string | undefined) { return this._change(id, () => this.all.rename(id, name)); }
  describe(id: string, description: unknown) { return this._change(id, () => this.all.describe(id, description)); }
  setAvatar(id: string, avatar: string) { return this._change(id, () => this.all.setAvatar(id, avatar)); }
  setLogin(id: string, user: string | undefined, secret: string | undefined) { return this._change(id, () => this.all.setLogin(id, user, secret)); }
  _change(id: string, change: () => Result<{ id: string }>): Result<{ id: string }> {
    if (!this._find(id)) return { error: `no profile ${id}` };
    const r = change();
    if (refused(r)) return r;
    this.refresh();
    this.hooks.changed();
    this.hooks.everywhere();
    return r;
  }

  // Let go of in this task (its project let it go: projects.ts, dropProfile): its copy's tabs, sign-ins and storage
  // are gone for good.
  async drop(folder: string) {
    const e = this.entries.find((x) => x.cfg.folder === folder);
    if (!e) return;
    await e.starting?.catch(() => {});
    if (!this.entries.includes(e)) return;
    this.entries.splice(this.entries.indexOf(e), 1);
    this._sync();
    this.store.markDeleted(folder);
    await this.hooks.remove(e);
    this._changed();
  }

  // Where every profile's tabs are, each saved in its folder. One still opening (its session cookies are restored
  // before its tabs) is saved as what it opens: it has no tabs yet, and Kulisa quitting right then lost them all.
  // One never opened in this task has no copy yet: nothing is written for it (its folder made now would pass for a copy).
  saveTabs() {
    for (const e of this.entries) {
      if (!e.profile && !fs.existsSync(e.cfg.dir)) continue;
      this.store.saveTabs(e.cfg.folder, e.profile && !e.starting ? this.hooks.urlsOf(e.profile) : e.urls);
    }
  }
  save() { this.store.saveProfiles(this.entries.map((e): TaskProfile => (e.profile ? this._cfgOf(e) : { ...e.cfg, closed: true }))); }

  // Open: its copy made from the master the first time here; the Profile is in the maps at once; its tabs are opening
  // until `starting` settles.
  async _start(e: Entry) {
    if (!fs.existsSync(e.cfg.dir)) await this.hooks.copy(e);
    e.profile = this.hooks.make(e.cfg);
    this._sync();
    e.starting = this.hooks.start(e.profile, e.urls.length ? e.urls : ['about:blank']);
    try { await e.starting; } finally { e.starting = null; }
  }
  _cfg(g: StoredProfile, state?: TaskProfile): ProfileConfig {
    return { id: g.id, name: g.name, avatar: g.avatar, description: g.description || '', ...loginOf(g), folder: g.folder, dir: this.store.profileDir(g.folder), zoom: state?.zoom };
  }
  _cfgOf({ cfg, profile: p }: Entry): ProfileConfig {
    return p ? { id: p.id, name: p.name, avatar: p.avatar, description: p.description, folder: p.folder, dir: p.dir, zoom: p.siteZoom } : cfg;
  }
  _changed() { this.save(); this.hooks.changed(); }
  _find(id: string) { return this.entries.find((e) => e.cfg.id === id); }
  _sync() {
    this.profiles.clear(); this.closed.clear();
    for (const e of this.entries) {
      if (e.profile) this.profiles.set(e.cfg.id, e.profile);
      else this.closed.set(e.cfg.id, e);
    }
  }
}
// What a task shows of a profile's pair: its login, and whether it has a password (never the password).
const loginOf = (g: StoredProfile) => ({ login: g.login?.user || '', hasPassword: !!g.login?.secret });

export type { Entry, Hooks };
export { ProjectProfiles };
