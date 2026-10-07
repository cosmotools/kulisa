// A workspace (ROADMAP, "Workspaces"; the term: CLAUDE.md): one line of work in a project. Its code (main: the
// project's folder; a fork: a git worktree next to it, worktrees.js), its profiles (folders in its data, store.js), its
// grid and its agent, in a terminal of its own. Its project's window shows one workspace at a time; the others keep
// running, those of the other open projects too. A workspace loads (profiles, agent) the first time it is shown, so a
// restart does not start every one at once.
const { session } = require('electron');
const { Profile, wipeSession } = require('./profiles');
const { ProjectProfiles } = require('./project-profiles');
const { installSigninPause } = require('./signin-pause');
const { startTerminal, stopTerminal, forgetTerminal } = require('./terminal');
const { clearHighlights } = require('./mcp-server');
const { copyProfile } = require('./store');

class Workspace {
  // project: its project (projects.js); entry: { n, name, branch, worktree, folder, base,
  // offset } from its workspaces.json; main is n 1, in the project's folder. key: the workspace among all open ones
  // ("<project id>/<n>"): the windows, the terminals, the CDP proxy and the MCP server's URLs know it by that.
  // shell: the app (app.js): store, proxy, mcp, sessionCookies, chromeIdentity, signin, uiZoom, bus, ask; the agents
  // (agentFor, findAgent, chooseAgent, plugin); and wsChanged(ws, now, agentState), called after any change of its
  // profiles or its agent's state. Its window is its project's (window.js: win, viewsHidden, picking, send), which
  // changes when the project moves to another window.
  constructor(shell, project, entry) {
    this.shell = shell; this.project = project; this.entry = entry;
    this.n = entry.n; this.name = entry.name; this.main = entry.n === 1;
    this.key = `${project.id}/${this.n}`;
    this.folder = entry.folder || project.folder;
    this.offset = entry.offset || 0;
    this.store = shell.store.workspaceOf(project, this.n);
    this.state = null; // the agent's, from its hooks: 'working', 'waiting' (for the human), 'done'
    this.seen = false; // the human has seen it since (its window: see), so a done one has nothing to come and see
    this.pty = null; this.loaded = false;
    this.list = new ProjectProfiles(this.store, this._profileHooks());
    this.profiles = this.list.profiles; this.closed = this.list.closed;
  }
  get window() { return this.project.window; }
  shown() { return this.window?.ws === this; }

  // What it takes to run a profile of this workspace (project-profiles.js).
  _profileHooks() {
    const shell = this.shell;
    return {
      make: (cfg) => {
        const profile = new Profile(this.window.win, cfg, { ws: this.key, mimic: shell.chromeIdentity });
        profile.hidden = !this.shown() || this.window.viewsHidden;
        shell.proxy.addProfile(profile);
        profile.endpoint = shell.proxy.endpoint(profile);
        profile.setBaseZoom(shell.uiZoom);
        profile.on('changed', () => shell.wsChanged(this));
        profile.on('zoom', () => this.list.save());
        installSigninPause(profile, shell.signin.isSigninUrl);
        return profile;
      },
      start: async (profile, urls) => {
        await shell.sessionCookies.restore(profile); // before the first request of any tab
        await Promise.all(urls.map((u, i) => profile.newTab(u, { activate: i === 0 }).ready));
        // The window opens even if the shell's connection fails; the agent's tools say so for this profile.
        if (!profile.signinMode) await profile.connect(profile.endpoint).catch((e) => console.error(`[kulisa] ${profile.id}: no Playwright connection: ${e.message.split('\n')[0]}`));
        shell.bus.emit('profile-added', profile);
        profile.on('signin-mode', (on) => { if (!on) shell.bus.emit('profile-added', profile); });
      },
      // Its sign-ins saved (session cookies too) for when it opens again; its tabs and automation gone.
      unload: async (p) => {
        const pick = this.window?.picking.get(p.id);
        if (pick?.profile === p) pick.cancel();
        await clearHighlights(`${this.key}/${p.id}`);
        await shell.sessionCookies.persist(p);
        shell.proxy.removeProfile(p);
        await p.close();
      },
      urlsOf: (p) => p.tabs.filter((t) => !t.wc.isDestroyed()).map((t) => this._urlOf(t)).filter((u) => u && u !== 'about:blank'),
      renamed: (p, oldId) => { shell.proxy.renamed(p, oldId); p.endpoint = shell.proxy.endpoint(p); },
      remove: async ({ cfg, profile }) => {
        shell.sessionCookies.forget(cfg);
        if (!profile) return wipeSession(session.fromPath(cfg.dir));
        shell.proxy.removeProfile(profile);
        await profile.destroy();
      },
      changed: () => shell.wsChanged(this, true),
    };
  }
  // Where a tab is, to open it again: sign-in pages are one-time URLs, so where the sign-in started instead
  // (signin-pages.js); a tab still loading, the URL it is opening.
  _urlOf(t) { return this.shell.signin.restoreUrl(t.wc) || t.pendingUrl; }

  async loadProfiles() { await this.list.load(); this.loaded = true; }
  // The workspace's agent (agents.js) in its folder, continuing its last conversation where the agent can. One not
  // chosen yet, or not installed: the window asks the human (and installs it); asked again the next time the
  // workspace is shown if they left without choosing.
  async startAgent() {
    const { shell } = this;
    let agent = shell.agentFor(this.store.agent().agent);
    let found = agent && await shell.findAgent(agent, this.folder);
    if (!found) {
      agent = await shell.chooseAgent(this, agent);
      if (!agent || !this.loaded || this.pty) return;
      found = await shell.findAgent(agent, this.folder);
      if (!found) return;
    }
    const saved = this.store.agent();
    const resume = (saved.agent === agent.id && agent.resume?.(saved)) || null;
    this.resumedSession = resume ? saved.sessionId ?? null : null;
    this.agent = agent;
    if (!this.main) {
      const main = this.project.main;
      await agent.prepare?.({ folder: this.folder, main: { folder: main.folder, ...main.store.agent() } });
    }
    // The program by name, as the human would type it, unless the shell does not find it yet (just installed).
    const command = found.onPath ? agent.command : found.path;
    this.pty = await startTerminal((channel, data) => this.window?.send(channel, data), { command, shell: agent.shell, cwd: this.folder, env: this.env(),
      args: [...(resume || []), ...(agent.args?.({ env: this.env(), plugin: shell.plugin }) || [])] }, this.key);
    this.store.saveAgent({ ...this.store.agent(), agent: agent.id, started: true });
  }
  // Another agent for this workspace, chosen by the human (the terminal's menu): the running one stops, the chosen one
  // starts with a new conversation (the old one stays in the old agent's own history).
  async changeAgent() {
    const agent = await this.shell.chooseAgent(this, this.agent, { cancel: true });
    if (!agent || !this.loaded || agent.id === this.agent?.id) return { changed: false };
    await this.starting;
    if (this.pty) { stopTerminal(this.pty); this.pty = null; }
    this.store.saveAgent({ agent: agent.id });
    this.window?.send('terminal:reset', { ws: this.key });
    await this.startAgent();
    return { changed: true, agent: agent.id };
  }
  // What the agent gets in its environment: where Kulisa's MCP server and hooks are for this workspace (the Kulisa
  // plugin reads them, other agent CLIs can too), its name, and the offset for the ports of the app it runs.
  env() {
    const base = `${this.shell.mcp.base}/ws/${encodeURIComponent(this.project.id)}/${this.n}`;
    return { KULISA_MCP_URL: `${base}/mcp`, KULISA_URL: base, KULISA_WORKSPACE: this.name, KULISA_PORT_OFFSET: String(this.offset) };
  }
  // Its agent stopped, its profiles saved and closed (its project closes, or the workspace is deleted).
  // Its tabs are saved first, as they are: closing them one by one changes the profiles, and nothing is saved then.
  async unload() {
    this.shell.chooseAgent.cancel?.(this);
    if (this.pty) { stopTerminal(this.pty); this.pty = null; }
    forgetTerminal(this.key);
    if (this.loaded) this.list.saveTabs();
    this.loaded = false;
    await this.list.unloadAll();
  }
  // The agent's session, as its hooks report it (agent-hooks.js).
  saveAgent(s) { if (this.loaded) this.store.saveAgent({ ...this.store.agent(), ...s }); }
  setState(state) { this.state = state; this.seen = false; this.shell.wsChanged(this, false, true); }
  // The human sees it (shown, its window in focus); true when that changes what its tab shows.
  see() { const was = this.tabState; this.seen = true; return this.tabState !== was; }
  // What its tab shows: the agent's state, but nothing for a done one the human has seen.
  get tabState() { return this.state === 'done' && this.seen ? null : this.state; }

  // Profiles and their tabs: the one core the human (the window, app.js) and the agent (mcp-server.js) both act on.
  // Each side only translates (CLAUDE.md, Architecture): the checks, the questions and what an action does are here
  // and in Profile, so both get the same. A refusal is { error } saying why. Closed profiles stay closed across
  // restarts.
  find(id) {
    const profile = this.profiles.get(id);
    if (profile) return { profile };
    if (this.closed.has(id)) return { error: `Profile "${id}" is closed (it is still signed in): open it first.`, closed: true };
    return { error: `No profile "${id}". Profiles: ${[...this.profiles.keys(), ...this.closed.keys()].join(', ') || 'none yet'}` };
  }
  // A tab of an open profile; no tabId: its active tab.
  findTab(id, tabId) {
    const r = this.find(id);
    if (r.error) return r;
    const tab = r.profile.get(tabId);
    return tab && !tab.wc.isDestroyed() ? { ...r, tab } : { error: tabId ? `No tab ${tabId} in ${id}` : `Profile "${id}" has no tab` };
  }
  createProfile(name) { return this.list.create(name); }
  renameProfile(id, name) { return this.list.rename(id, name); }
  closeProfile(id) { return this.list.close(id); }
  openProfile(id) { return this.list.open(id); }
  // Always after the human says yes, whoever asks (by: 'human' or 'agent'): sign-ins are made by hand and cannot be
  // made again by code.
  async deleteProfile(id, by = 'human') {
    const p = this.profiles.get(id) || this.closed.get(id)?.cfg;
    if (!p) return { error: `No profile "${id}"` };
    const ok = await this.shell.ask({ ok: 'Delete', danger: true, detail: 'Its sign-ins, cookies, storage and tabs are removed for good.',
      message: by === 'agent' ? `The agent asks to delete the profile ${p.name}.` : `Delete the profile ${p.name}?` }, this.window);
    return ok ? this.list.delete(id) : { error: 'the human said no' };
  }
  // A caption over a profile's pane (ghost.js, browser_highlight); sticky ones stay until the next caption.
  caption(profile, caption, sticky = false) { this.window?.send('agent', { ws: this.key, profile, caption, sticky }); }

  // A fork's profiles: copies of this workspace's (main's), sign-ins included, each folder without its caches. Open
  // ones are flushed first and open in the fork with their active tab only; closed ones stay closed. URLs of the app
  // under test move to the fork's ports (offset). The grid comes along.
  async forkProfilesInto(dest, offset) {
    const entries = this.loaded ? this.list.entries
      : this.store.profiles().map(({ closed, ...cfg }) => ({ cfg: { ...cfg, dir: this.store.profileDir(cfg.folder) }, urls: this.store.tabs(cfg.folder), closed }));
    const list = [];
    for (const e of entries) {
      const p = e.profile;
      if (p) await this.shell.sessionCookies.persist(p);
      const closed = this.loaded ? !p : !!e.closed;
      const active = p?.get();
      const urls = p ? (active ? [this._urlOf(active)] : []) : closed ? e.urls : e.urls.slice(0, 1);
      await copyProfile(e.cfg.dir, dest.profileDir(e.cfg.folder));
      dest.saveTabs(e.cfg.folder, urls.filter((u) => u && u !== 'about:blank').map((u) => withOffset(u, offset)));
      const { id, name, color, folder, zoom } = p ? { ...e.cfg, id: p.id, name: p.name, color: p.color, zoom: p.siteZoom } : e.cfg;
      list.push({ id, name, color, folder, zoom, closed });
    }
    dest.saveProfiles(list);
    const layout = this.store.layout();
    if (layout) dest.saveLayout(layout);
  }

  info() {
    const { n, key, name, main, tabState: state, folder, offset } = this;
    return { n, key, name, main, state, folder, offset, branch: this.entry.branch || null, agent: this.agent?.name || null };
  }
}

// A URL of the app under test in a workspace with a port offset: a local address with a port moves by the offset
// (localhost:3000 → localhost:3100). Cookies do not depend on the port, so the profile stays signed in to the app.
function withOffset(url, offset) {
  if (!offset) return url;
  try {
    const u = new URL(url);
    if (!u.port || !/^(localhost|127(\.\d+){3}|\[::1\])$|\.localhost$/.test(u.hostname)) return url;
    u.port = String(Number(u.port) + offset);
    return u.href;
  } catch { return url; }
}

module.exports = { Workspace, withOffset };
