// The profiles of a task: its project's profiles (profile-store.js: who each is, its master), in their order, open
// ones (a Profile: tabs, automation) and closed ones (their settings and the URLs of their tabs only; still signed
// in). What the task has of each is its own: a copy of the master, made when the profile is first opened here, its tabs,
// open or closed, its sites' zoom (TaskStore: profiles.json, the copy's folder). Creates, renames, describes (for the
// whole store), closes, opens and lets go of them. `profiles` (open ones: Profile) and `closed` (closed ones: their
// entry) are maps by id, in the list's order, for everything that looks a profile up (Task: profiles, closed).
// What it takes to run a profile is the task's (tasks.js), given as hooks:
//   make(cfg) -> Profile        a Profile for the settings, not started yet
//   copy(entry)                 its folder made from its master (the first open in this task), its tabs set
//   start(profile, urls)        its tabs open, automation connected
//   unload(profile)             its tabs closed, its sign-ins saved
//   urlsOf(profile)             where its tabs are, to open them again
//   renamed(profile, oldId)     its id changed (the proxy's endpoint)
//   remove({ cfg, profile })    its copy gone for good (profile: when it is open)
//   changed()                   after any change: the window's state and the tabs are saved
//   everywhere()                who a profile is changed in the store: every task shows it
const fs = require('fs');
const { nameError } = require('./names');
const { clearCaches } = require('./profiles');
const { AVATARS, nextAvatar } = require('./avatars');

// A profile's description: who it is in the app under test, for agents to choose profiles by (profiles.md). The
// human's words, optional.
const ABOUT_MAX = 500;

class ProjectProfiles {
  // store: the task's (TaskStore); profiles: the store of profiles (ProfileStore); project: its project's id.
  constructor(store, profiles, project, hooks) {
    this.store = store; this.all = profiles; this.project = project; this.hooks = hooks;
    this.entries = []; // { cfg: { id, name, avatar, description, folder, dir, zoom }, urls, profile }
    this.profiles = new Map(); this.closed = new Map();
  }

  // The project's profiles, with what this task has of each; the closed ones stay closed. A task with nothing saved
  // yet (the first of its project) opens them all; one the project got later comes closed.
  async load() {
    const saved = this.store.profiles(), state = new Map((saved || []).map((x) => [x.folder, x]));
    this.entries = this.all.of(this.project).map((g) => ({ cfg: this._cfg(g, state.get(g.folder)), urls: this.store.tabs(g.folder),
      profile: null, closed: saved ? !state.has(g.folder) || !!state.get(g.folder).closed : false }));
    this._sync();
    for (const e of this.entries) if (!e.closed) await this._start(e);
    for (const e of this.entries) delete e.closed;
    this.save();
  }
  // The task closes (another project opens, it is deleted): the open profiles are unloaded and the list goes.
  async unloadAll() {
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
      Object.assign(e.cfg, { id: g.id, name: g.name, avatar: g.avatar, description: g.description || '' });
      if (e.profile) {
        Object.assign(e.profile, { name: g.name, avatar: g.avatar, description: g.description || '' });
        if (g.id !== oldId) { e.profile.id = g.id; this.hooks.renamed(e.profile, oldId); }
      }
    }
    this._sync();
    this.save();
  }

  // A new, empty profile of the project, open here; from the editor and from the agent (profile_create).
  // avatar: the human's pick (the editor), else the next one free.
  async create(name, description = '', avatar) {
    const bad = nameError(name?.trim()) || aboutError(description) || (avatar && !AVATARS.includes(avatar) && `no picture ${avatar}`);
    if (bad) return { error: bad };
    const g = this.all.create(this.project, { name: name.trim(), avatar: avatar || this._nextAvatar(), description: description.trim() });
    const e = { cfg: this._cfg(g), urls: [], profile: null };
    this.entries.push(e);
    await this._start(e);
    this._changed();
    this.hooks.everywhere();
    return { id: g.id };
  }

  // Close: the tabs go (their memory too); it stays in the project, signed in, and opens again with the same tabs.
  async close(id) {
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
    await clearCaches(p.session).catch((err) => console.error(`[kulisa] ${id}: caches not cleared: ${err.message}`));
    this._changed();
    return { id };
  }
  async open(id) {
    const e = this._find(id);
    if (!e) return { error: `no profile ${id}` };
    if (!e.profile) { await this._start(e); this._changed(); }
    return { id };
  }

  // Rename: new name and id, in every project; the folders (sign-ins), tabs, place in the list and the agent
  // connection stay.
  rename(oldId, name) {
    const e = this._find(oldId);
    if (!e) return { error: `no profile ${oldId}` };
    const bad = nameError(name?.trim());
    if (bad) return { error: bad };
    const id = this.all.idFor(name, oldId);
    this.all.update(e.cfg.folder, { id, name: name.trim() });
    Object.assign(e.cfg, { id, name: name.trim() });
    if (e.profile) {
      e.profile.name = e.cfg.name;
      if (id !== oldId) { e.profile.id = id; this.hooks.renamed(e.profile, oldId); }
    }
    this._sync();
    this._changed();
    this.hooks.everywhere();
    return { id };
  }

  // Who the profile is in the app under test (empty: not said), and its picture: the rest stays.
  describe(id, description) {
    const bad = aboutError(description);
    if (bad) return { error: bad };
    return this._set(id, { description: description.trim() });
  }
  setAvatar(id, avatar) {
    if (!AVATARS.includes(avatar)) return { error: `no picture ${avatar}` };
    return this._set(id, { avatar });
  }
  _set(id, fields) {
    const e = this._find(id);
    if (!e) return { error: `no profile ${id}` };
    this.all.update(e.cfg.folder, fields);
    Object.assign(e.cfg, fields);
    if (e.profile) Object.assign(e.profile, fields);
    this._changed();
    this.hooks.everywhere();
    return { id };
  }

  // Let go of in this task (its project let it go: projects.js, dropProfile): its copy's tabs, sign-ins and storage
  // are gone for good.
  async drop(folder) {
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
  save() { this.store.saveProfiles(this.entries.map((e) => (e.profile ? this._cfgOf(e) : { ...e.cfg, closed: true }))); }

  // Open: its copy made from the master the first time here; the Profile is in the maps at once; its tabs are opening
  // until `starting` settles.
  async _start(e) {
    if (!fs.existsSync(e.cfg.dir)) await this.hooks.copy(e);
    e.profile = this.hooks.make(e.cfg);
    this._sync();
    e.starting = this.hooks.start(e.profile, e.urls.length ? e.urls : ['about:blank']);
    try { await e.starting; } finally { e.starting = null; }
  }
  _cfg(g, state) {
    return { id: g.id, name: g.name, avatar: g.avatar, description: g.description || '', folder: g.folder, dir: this.store.profileDir(g.folder), zoom: state?.zoom };
  }
  _cfgOf({ cfg, profile: p }) {
    return p ? { id: p.id, name: p.name, avatar: p.avatar, description: p.description, folder: p.folder, dir: p.dir, zoom: p.siteZoom } : cfg;
  }
  _changed() { this.save(); this.hooks.changed(); }
  _find(id) { return this.entries.find((e) => e.cfg.id === id); }
  _sync() {
    this.profiles.clear(); this.closed.clear();
    for (const e of this.entries) {
      if (e.profile) this.profiles.set(e.cfg.id, e.profile);
      else this.closed.set(e.cfg.id, e);
    }
  }
  _nextAvatar() { return nextAvatar(this.entries.map((e) => e.profile?.avatar ?? e.cfg.avatar)); }
}
const aboutError = (d) => (typeof d !== 'string' ? 'a description is text'
  : d.trim().length > ABOUT_MAX ? `a description is at most ${ABOUT_MAX} characters` : null);

module.exports = { ProjectProfiles };
