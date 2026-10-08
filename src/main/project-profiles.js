// The profiles of a workspace, in their order: open ones (a Profile: tabs, automation) and closed
// ones (their settings and the URLs of their tabs only; still signed in). Creates, renames, closes, opens and deletes
// them and keeps profiles.json and their tabs (store.js, WorkspaceStore). `profiles` (open ones: Profile) and `closed` (closed ones: their entry) are maps by
// id, in the list's order, for everything that looks a profile up (Workspace: profiles, closed).
// What it takes to run a profile is the workspace's (workspaces.js), given as hooks:
//   make(cfg) -> Profile        a Profile for the settings, not started yet
//   start(profile, urls)        its tabs open, automation connected
//   unload(profile)             its tabs closed, its sign-ins saved
//   urlsOf(profile)             where its tabs are, to open them again
//   renamed(profile, oldId)     its id changed (the proxy's endpoint)
//   remove({ cfg, profile })    its data gone for good (profile: when it is open)
//   changed()                   after any change: the window's state and the tabs are saved
const { nameError, slugOf } = require('./names');
const { clearCaches } = require('./profiles');
const { AVATARS, nextAvatar } = require('./avatars');

// A profile's description: who it is in the app under test, for agents to choose profiles by (profiles.md). The
// human's words, optional.
const ABOUT_MAX = 500;

class ProjectProfiles {
  constructor(store, hooks) {
    this.store = store; this.hooks = hooks;
    this.entries = []; // { cfg: { id, name, avatar, description, folder, dir, zoom }, urls, profile }
    this.profiles = new Map(); this.closed = new Map();
  }

  // The workspace's profiles from its store; the closed ones stay closed. Profiles made before pictures (with a
  // color) get one.
  async load() {
    this.entries = this.store.profiles().map(({ closed, color, ...cfg }) =>
      ({ cfg: { ...cfg, dir: this.store.profileDir(cfg.folder) }, urls: this.store.tabs(cfg.folder), profile: null, closed }));
    for (const e of this.entries) if (!AVATARS.includes(e.cfg.avatar)) e.cfg.avatar = this._nextAvatar();
    this._sync();
    for (const e of this.entries) if (!e.closed) await this._start(e);
    for (const e of this.entries) delete e.closed;
  }
  // The workspace closes (another project opens, it is deleted): the open profiles are unloaded and the list goes.
  async unloadAll() {
    for (const e of this.entries) if (e.profile) await this.hooks.unload(e.profile);
    this.entries = []; this._sync();
  }

  // A new, empty profile; from the editor and from the agent (profile_create).
  // avatar: the human's pick (the editor), else the next one free.
  async create(name, description = '', avatar) {
    const bad = nameError(name?.trim()) || aboutError(description) || (avatar && !AVATARS.includes(avatar) && `no picture ${avatar}`);
    if (bad) return { error: bad };
    const id = this._idFor(name);
    const folder = this.store.freeFolder(this.entries.map((x) => x.cfg.folder));
    const e = { cfg: { id, name: name.trim(), avatar: avatar || this._nextAvatar(), description: description.trim(), folder,
      dir: this.store.profileDir(folder) }, urls: [], profile: null };
    this.entries.push(e);
    await this._start(e);
    this._changed();
    return { id };
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

  // Rename: new name and id; the folder (sign-ins), tabs, place in the list and the agent connection stay.
  rename(oldId, name) {
    const e = this._find(oldId);
    if (!e) return { error: `no profile ${oldId}` };
    const bad = nameError(name?.trim());
    if (bad) return { error: bad };
    const id = this._idFor(name, oldId);
    Object.assign(e.cfg, { id, name: name.trim() });
    if (e.profile) {
      e.profile.name = e.cfg.name;
      if (id !== oldId) { e.profile.id = id; this.hooks.renamed(e.profile, oldId); }
    }
    this._sync();
    this._changed();
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
    Object.assign(e.cfg, fields);
    if (e.profile) Object.assign(e.profile, fields);
    this._changed();
    return { id };
  }

  // Delete: its tabs, sign-ins and storage are gone for good. The human confirms first (the editor, or the agent's
  // request: workspaces.js).
  async delete(id) {
    const e = this._find(id);
    if (!e) return { error: `no profile ${id}` };
    await e.starting?.catch(() => {});
    if (!this.entries.includes(e)) return { id };
    this.entries.splice(this.entries.indexOf(e), 1);
    this._sync();
    this.store.markDeleted(e.cfg.folder);
    await this.hooks.remove(e);
    this._changed();
    return { id };
  }

  // Where every profile's tabs are, each saved in its folder. One still opening (its session cookies are restored
  // before its tabs) is saved as what it opens: it has no tabs yet, and Kulisa quitting right then lost them all.
  saveTabs() {
    for (const e of this.entries) this.store.saveTabs(e.cfg.folder, e.profile && !e.starting ? this.hooks.urlsOf(e.profile) : e.urls);
  }
  save() { this.store.saveProfiles(this.entries.map((e) => (e.profile ? this._cfgOf(e) : { ...e.cfg, closed: true }))); }

  // Open: the Profile is in the maps at once; its tabs are opening until `starting` settles.
  async _start(e) {
    e.profile = this.hooks.make(e.cfg);
    this._sync();
    e.starting = this.hooks.start(e.profile, e.urls.length ? e.urls : ['about:blank']);
    try { await e.starting; } finally { e.starting = null; }
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
  _idFor(name, except) {
    const base = slugOf(name, 'profile');
    let id = base, n = 2;
    while (this._find(id) && id !== except) id = `${base}-${n++}`;
    return id;
  }
  _nextAvatar() { return nextAvatar(this.entries.map((e) => e.profile?.avatar ?? e.cfg.avatar)); }
}
const aboutError = (d) => (typeof d !== 'string' ? 'a description is text'
  : d.trim().length > ABOUT_MAX ? `a description is at most ${ABOUT_MAX} characters` : null);

module.exports = { ProjectProfiles };
