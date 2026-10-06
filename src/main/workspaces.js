// A workspace (ROADMAP, "Workspaces"; the term: CLAUDE.md): one line of work in the open project. Its code (main: the
// project's folder; a fork: a git worktree next to it, worktrees.js), its profiles (folders in its data, store.js), its
// grid and its agent, in a terminal of its own. The window shows one workspace at a time; the others keep running. A
// workspace loads (profiles, agent) the first time it is shown, so a restart does not start every one at once.
const { session } = require('electron');
const { Profile, wipeSession } = require('./profiles');
const { ProjectProfiles } = require('./project-profiles');
const { installSigninPause } = require('./signin-pause');
const { startTerminal, stopTerminal } = require('./terminal');
const { clearHighlights } = require('./mcp-server');
const { copyProfile } = require('./store');

class Workspace {
  // entry: { n, name, branch, worktree, folder, base, offset } from workspaces.json; main is n 1, in the project's
  // folder (projectFolder).
  // shell: the window (app.js): win, store, proxy, mcp, sessionCookies, chromeIdentity, signin, uiZoom, viewsHidden,
  // picking, bus, ask; the agents (agentFor, findAgent, chooseAgent, plugin); and wsChanged(ws, now, agentState),
  // called after any change of its profiles or its agent's state.
  constructor(shell, entry, projectFolder) {
    this.shell = shell; this.entry = entry;
    this.n = entry.n; this.name = entry.name; this.main = entry.n === 1;
    this.folder = entry.folder || projectFolder;
    this.offset = entry.offset || 0;
    this.store = shell.store.workspace(this.n);
    this.state = null; // the agent's, from its hooks: 'working', 'waiting' (for the human), 'done'
    this.pty = null; this.loaded = false;
    this.list = new ProjectProfiles(this.store, this._profileHooks());
    this.profiles = this.list.profiles; this.closed = this.list.closed;
  }
  shown() { return this.shell.ws === this; }

  // What it takes to run a profile of this workspace (project-profiles.js).
  _profileHooks() {
    const shell = this.shell;
    return {
      make: (cfg) => {
        const profile = new Profile(shell.win, cfg, { ws: this.n, mimic: shell.chromeIdentity });
        profile.hidden = !this.shown() || shell.viewsHidden;
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
        if (!profile.signinMode) await profile.connect(profile.endpoint);
        shell.bus.emit('profile-added', profile);
        profile.on('signin-mode', (on) => { if (!on) shell.bus.emit('profile-added', profile); });
      },
      // Its sign-ins saved (session cookies too) for when it opens again; its tabs and automation gone.
      unload: async (p) => {
        const pick = shell.picking?.get(p.id);
        if (pick?.profile === p) pick.cancel();
        await clearHighlights(`${this.n}/${p.id}`);
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
      const main = shell.workspaces.get(1);
      await agent.prepare?.({ folder: this.folder, main: { folder: main.folder, ...main.store.agent() } });
    }
    // The program by name, as the human would type it, unless the shell does not find it yet (just installed).
    const command = found.onPath ? agent.command : found.path;
    this.pty = await startTerminal(shell.win, { command, shell: agent.shell, cwd: this.folder, env: this.env(),
      args: [...(resume || []), ...(agent.args?.({ env: this.env(), plugin: shell.plugin }) || [])] }, this.n);
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
    if (!this.shell.win.isDestroyed()) this.shell.win.webContents.send('terminal:reset', { ws: this.n });
    await this.startAgent();
    return { changed: true, agent: agent.id };
  }
  // What the agent gets in its environment: where Kulisa's MCP server and hooks are for this workspace (the Kulisa
  // plugin reads them, other agent CLIs can too), its name, and the offset for the ports of the app it runs.
  env() {
    const base = `${this.shell.mcp.base}/ws/${this.n}`;
    return { KULISA_MCP_URL: `${base}/mcp`, KULISA_URL: base, KULISA_WORKSPACE: this.name, KULISA_PORT_OFFSET: String(this.offset) };
  }
  // Its agent stopped, its profiles saved and closed (another project opens, or the workspace is deleted).
  async unload() {
    this.shell.chooseAgent.cancel?.(this);
    if (this.pty) { stopTerminal(this.pty); this.pty = null; }
    await this.list.unloadAll();
    this.loaded = false;
  }
  // The agent's session, as its hooks report it (agent-hooks.js).
  saveAgent(s) { if (this.loaded) this.store.saveAgent({ ...this.store.agent(), ...s }); }
  setState(state) { this.state = state; this.shell.wsChanged(this, false, true); }

  // Profiles: from the window, the panes and the agent (mcp-server.js). Closed profiles stay closed across restarts.
  createProfile(name) { return this.list.create(name); }
  closeProfile(id) { return this.list.close(id); }
  openProfile(id) { return this.list.open(id); }
  deleteProfile(id) { return this.list.delete(id); } // the human confirms first: the editor, or agentDeletesProfile
  // The agent deletes only what the human confirms: sign-ins are made by hand and cannot be made again by code.
  async agentDeletesProfile(id) {
    const p = this.profiles.get(id) || this.closed.get(id)?.cfg;
    if (!p) return { error: `no profile ${id}` };
    const ok = await this.shell.ask({ message: `The agent asks to delete the profile ${p.name}.`, ok: 'Delete', danger: true,
      detail: 'Its sign-ins, cookies, storage and tabs are removed for good.' });
    return ok ? this.deleteProfile(id) : { error: 'the human said no' };
  }
  // A caption over a profile's pane (ghost.js, browser_highlight); sticky ones stay until the next caption.
  caption(profile, caption, sticky = false) {
    const win = this.shell.win;
    if (!win.isDestroyed()) win.webContents.send('agent', { ws: this.n, profile, caption, sticky });
  }

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
    const { n, name, main, state, folder, offset } = this;
    return { n, name, main, state, folder, offset, branch: this.entry.branch || null, agent: this.agent?.name || null };
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
