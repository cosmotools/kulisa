// A task (tasks.md; the term: CLAUDE.md): one line of work in a project. Its code (a git worktree of its own next to
// the project, worktrees.ts; without git, the project's folder itself), its profiles (folders in its data, store.ts), its
// grid and its agent, in a terminal of its own. Its project's window shows one task at a time; the others keep
// running, those of the other open projects too. A task loads (profiles, agent) the first time it is shown, so a
// restart does not start every one at once.
import { session } from 'electron';
import fs from 'fs';
import { Profile, wipeSession } from './profiles.ts';
import { ProjectProfiles } from './project-profiles.ts';
import { installSigninPause } from './signin-pause.ts';
import { startTerminal, stopTerminal, forgetTerminal, terminalSize, terminalTail, typeIntoPrompt } from './terminal.ts';
import { clearHighlights } from './mcp-server.ts';
import { copyProfile } from './store.ts';
import { renameBranch } from './worktrees.ts';
import { nameError } from './names.ts';
import { loginAllowed } from './local.ts';
import type { Tab } from './profiles.ts';
import type { Entry, Hooks } from './project-profiles.ts';
import type { Project } from './projects.ts';
import type { TaskEntry, TaskStore } from './store.ts';
import type { Pty } from './terminal.ts';
import type { GitError } from './worktrees.ts';
import type { Shell, AgentChoice } from './shell.ts';
import type * as Sent from '../renderer/types.ts'; // what the window gets: its one definition
import { refused } from './result.ts';
import type { Result } from './result.ts';

// A terminal of the task besides its agent's (openTerminal).
interface TaskTerminal { id: number; name: string; command: string; by: 'human' | 'agent'; key: string; pty?: Pty; error?: undefined }
type Found = { profile: Profile; error?: undefined } | { error: string; closed?: boolean; profile?: undefined };

const DICTATION_LIMIT = 5 * 60_000; // a recording left on (a click and no second one)

class Task {
  shell: Shell; project: Project; entry: TaskEntry; n: number; key: string; folder: string; offset: number; store: TaskStore;
  state: 'working' | 'waiting' | 'done' | null; seen: boolean; pty: Pty | null; loaded: boolean;
  terminals: Map<number, TaskTerminal>; terminalSeq: number; list: ProjectProfiles;
  profiles: ProjectProfiles['profiles']; closed: ProjectProfiles['closed'];
  agent?: AgentChoice; resumedSession?: string | null; dictating?: NodeJS.Timeout | null; starting?: Promise<unknown> | null;
  // project: its project (projects.ts); entry: { n, name, branch, worktree, folder, base, offset, closed, closedAt }
  // from its tasks.json; one without a worktree works in the project's folder. key: the task among all open ones
  // ("<project id>/<n>"): the windows, the terminals, the CDP proxy and the MCP server's URLs know it by that.
  // shell: the app (app.ts): store, proxy, mcp, sessionCookies, chromeIdentity, signin, uiZoom, bus, ask; the agents
  // (agentFor, findAgent, chooseAgent, plugin); and taskChanged(task, now, agentState), called after any change of its
  // profiles or its agent's state. Its window is its project's (window.ts: win, viewsHidden, picking, send), which
  // changes when the project moves to another window.
  constructor(shell: Shell, project: Project, entry: TaskEntry) {
    this.shell = shell; this.project = project; this.entry = entry;
    this.n = entry.n;
    this.key = `${project.id}/${this.n}`;
    this.folder = entry.folder || project.folder; // its agent's: the copy of the default repository
    this.offset = entry.offset || 0;
    this.store = shell.store.taskOf(project, this.n);
    this.state = null; // the agent's, from its hooks: 'working', 'waiting' (for the human), 'done'
    this.seen = false; // the human has seen it since (its window: see), so a done one has nothing to come and see
    this.pty = null; this.loaded = false;
    this.terminals = new Map(); this.terminalSeq = 0; // its other terminals (openTerminal), by id
    this.list = new ProjectProfiles(this.store, shell.profileStore, project.id, this._profileHooks());
    this.profiles = this.list.profiles; this.closed = this.list.closed;
  }
  get window() { return this.project.window; }
  shown() { return this.window?.task === this; }
  get name() { return this.entry.name; }
  // A new name, the agent's (task_rename) or the human's (Rename… on its tab): the name in the bar and its branch
  // of each of its copies (git branch -m; -2, -3 when another branch has it). Its folders stay: its agent may be
  // working there.
  async rename(name: string | undefined): Promise<Result<{ name: string; branch: string | null }>> {
    name = name?.trim();
    const bad = nameError(name);
    if (bad) return { error: bad };
    const { entry } = this;
    if (entry.copies?.length) {
      try { entry.branch = await renameBranch(entry.copies, name!); } catch (e) { return { error: (e as GitError).stderr || (e as Error).message }; }
    }
    entry.name = name!;
    this.project.save();
    this.window?.sendTasks(); this.window?.sendProjects();
    return { name: name!, branch: entry.branch || null };
  }

  // What it takes to run a profile of this task (project-profiles.ts).
  _profileHooks(): Hooks {
    const shell = this.shell;
    return {
      make: (cfg) => {
        const profile = new Profile(this.window!.win, cfg, { task: this.key, mimic: shell.chromeIdentity });
        profile.hidden = !this.shown() || this.window!.viewsHidden;
        shell.proxy.addProfile(profile);
        profile.endpoint = shell.proxy.endpoint(profile);
        profile.setBaseZoom(shell.uiZoom);
        profile.on('changed', () => shell.taskChanged(this));
        profile.on('zoom', () => this.list.save());
        installSigninPause(profile, shell.signin.isSigninUrl);
        return profile;
      },
      start: async (profile, urls) => {
        await shell.sessionCookies.restore(profile); // before the first request of any tab
        // Real accounts: the master's non-local cookies, then kept in step with it and the other tasks (cookie-sync.ts).
        await shell.cookieSync.attach(profile.folder, profile.session, this.project.entry.local || []);
        await Promise.all(urls.map((u, i) => profile.newTab(u, { activate: i === 0 }).ready));
        // The window opens even if the shell's connection fails; the agent's tools say so for this profile.
        if (!profile.signinMode) await profile.connect(profile.endpoint!).catch((e: Error) => console.error(`[kulisa] ${profile.id}: no Playwright connection: ${e.message.split('\n')[0]}`));
        shell.bus.emit('profile-added', profile);
        profile.on('signin-mode', (on: boolean) => { if (!on) shell.bus.emit('profile-added', profile); });
      },
      // Its sign-ins saved (session cookies too) for when it opens again; its tabs and automation gone.
      unload: async (p) => {
        const pick = this.window?.picking.get(p.id);
        if (pick?.profile === p) pick!.cancel();
        await clearHighlights(`${this.key}/${p.id}`);
        await shell.sessionCookies.persist(p);
        shell.cookieSync.detach(p.folder, p.session);
        shell.proxy.removeProfile(p);
        await p.close();
      },
      // Its first open in this task: a copy of its master (sign-ins included, caches left out: store.ts), its tabs those
      // of the master moved to this task's ports. Masters are not worked in, so nothing is open in one to flush.
      copy: async (e) => {
        await shell.flushMaster(e.cfg.folder); // open to sign in to: what was done there is on disk
        await copyProfile(shell.profileStore.masterDir(e.cfg.folder), e.cfg.dir);
        e.urls = this.store.tabs(e.cfg.folder).filter((u) => u && u !== 'about:blank').map((u) => withOffset(u, this.offset));
        this.store.saveTabs(e.cfg.folder, e.urls);
      },
      urlsOf: (p) => p.tabs.filter((t) => !t.wc.isDestroyed()).map((t) => this._urlOf(t)).filter((u) => u && u !== 'about:blank'),
      renamed: (p, oldId) => { shell.proxy.renamed(p, oldId); p.endpoint = shell.proxy.endpoint(p); },
      remove: async ({ cfg, profile }: Entry) => {
        shell.sessionCookies.forget(cfg);
        if (!profile) { if (fs.existsSync(cfg.dir)) await wipeSession(session.fromPath(cfg.dir)); return; } // never opened here: no copy
        shell.proxy.removeProfile(profile);
        await profile.destroy();
      },
      changed: () => shell.taskChanged(this, true),
      everywhere: () => shell.profilesChanged(this),
    };
  }
  // Where a tab is, to open it again: sign-in pages are one-time URLs, so where the sign-in started instead
  // (signin-pages.ts); a tab still loading, the URL it is opening.
  _urlOf(t: Tab) { return this.shell.signin.restoreUrl(t.wc) || t.pendingUrl || ''; }

  // The other folders its agent works in besides its own: its copies of the project's other repositories, and those
  // of the project's folders without git, as they are (agents.ts, dirs; the MCP server's instructions name them).
  dirs() {
    return [...new Set(this.project.repos().map((r) => this.entry.copies?.find((c) => c.repo === r)?.folder || r))].filter((d) => d !== this.folder);
  }
  // A repository added to its project while it runs (Project Settings…): copied for it, and its agent told, typed into
  // its prompt for the human to send (agents.ts, addDir: Claude Code's /add-dir; else a line saying so).
  async reposChanged() {
    if (!this.loaded) return;
    for (const c of await this.project.addCopies(this)) {
      if (this.pty) typeIntoPrompt(this.pty, this.agent?.addDir?.(c.folder) || `Kulisa added ${c.folder} to this task: a copy of the project's repository ${c.repo}, on branch ${c.branch}.`);
    }
  }
  // Its terminals come back with it, as they were left (openTerminal), not waited for: their panels are listed at once.
  async loadProfiles() {
    await this.list.load(); this.loaded = true;
    for (const { id, name, by } of this.store.terminals()) this.openTerminal({ id, name, by }).catch((e: Error) => console.error('[terminal]', e));
  }
  // The task's agent (agents.ts) in its folder, continuing its last conversation where the agent can. None chosen and
  // none in the project: the terminal alone (its accounts are added in the project's settings). One no longer there,
  // or not installed: the window asks the human (and installs it); asked again the next time the task is shown if
  // they left without choosing.
  async startAgent() {
    const { shell } = this;
    let agent: AgentChoice | null = shell.agentFor(this.store.agent().agent);
    if (!agent && !this.store.agent().agent && !this.project.agents().length) agent = shell.agentFor('shell');
    let found = agent && await shell.findAgent(agent, this.folder);
    if (!found) {
      agent = await shell.chooseAgent(this, agent);
      if (!agent || !this.loaded || this.pty) return;
      found = await shell.findAgent(agent, this.folder);
      if (!found) return;
    }
    const saved = this.store.agent();
    const resume = (saved.agent === agent!.id && agent!.resume && agent!.resume(saved)) || null;
    this.resumedSession = resume ? saved.sessionId ?? null : null;
    this.agent = agent!;
    await this.project.addCopies(this); // the project's repositories added since
    const dirs = this.dirs(), more: { args?: string[]; env?: Record<string, string> } = (dirs.length && agent!.dirs?.(dirs)) || {};
    for (const c of this.entry.copies || []) await agent!.prepare?.({ folder: c.folder, project: { folder: c.repo, ...this.project.agentData() }, configDir: agent!.configDir });
    // The program by name, as the human would type it, unless the shell does not find it yet (just installed).
    const a = agent!, command = found.onPath ? a.command : found.path;
    this.pty = await startTerminal((channel, data) => this.window?.send(channel, data), { command, shell: a.shell, cwd: this.folder, env: { ...this.env(), ...more.env, ...a.env },
      args: [...(resume || []), ...(a.args?.({ env: this.env(), plugin: shell.plugin }) || []), ...(more.args || []), ...(a.voice?.args || [])] }, this.key);
    this.store.saveAgent({ ...this.store.agent(), agent: a.id, started: true });
    this.window?.send('voice', { task: this.key, voice: this.voice() });
  }
  // Dictation, where the agent has its own (agents.ts, voice): what the window's microphone button shows ({ languages,
  // language, note, recording }, or null: no button), recording, and the language chosen there. The human's only: the
  // agent has no use for a microphone.
  voice() {
    const v = this.agent?.voice;
    return v ? { languages: v.languages, language: v.language({ ...this.store.agent(), configDir: this.agent!.configDir }), note: v.note || '', recording: !!this.dictating } : null;
  }
  // Recording: the agent's key held, as a terminal shows a held key, its repeats. It stops when told, or after
  // DICTATION_LIMIT, or when that agent is gone (another started, the task closed).
  dictate(on: boolean): { recording: boolean } {
    clearInterval(this.dictating ?? undefined);
    this.dictating = null;
    const v = this.agent?.voice, p = this.pty;
    if (on && v && p) {
      const until = Date.now() + DICTATION_LIMIT;
      this.dictating = setInterval(() => {
        if (this.pty === p && Date.now() < until) return p.write(v.key);
        this.dictate(false);
        this.window?.send('voice', { task: this.key, voice: this.voice() });
      }, v.repeat);
    }
    return { recording: !!this.dictating };
  }
  setVoiceLanguage(code: string) {
    const v = this.agent?.voice;
    return v ? v.setLanguage({ ...this.store.agent(), configDir: this.agent!.configDir }, code) : { error: 'this agent has no dictation' };
  }
  // Another agent for this task, chosen by the human (the terminal's menu): the running one stops, the chosen one
  // starts with a new conversation (the old one stays in the old agent's own history).
  async changeAgent() {
    const agent = await this.shell.chooseAgent(this, this.agent ?? null, { cancel: true });
    if (!agent || !this.loaded || agent.id === this.agent?.id) return { changed: false };
    await this.starting;
    if (this.pty) { stopTerminal(this.pty); this.pty = null; }
    this.store.saveAgent({ agent: agent.id });
    this.window?.send('terminal:reset', { task: this.key });
    await this.startAgent();
    return { changed: true, agent: agent.id };
  }
  // Its terminals besides the agent's, each a panel next to the agent's: the human's shells (+ on the terminal's
  // header) and what the agent keeps running there for the human to see (terminal_run: the app's dev server, docker
  // compose), rather than in the background of its own shell, which some agents cannot do and the human does not see.
  // Each is the user's shell in the task's folder with the agent's environment (the port offset), the command
  // typed in. As in an IDE they are kept: when the task is loaded again (a restart, its project opened again)
  // each comes back where it was (its id, its panel's in the saved grid), a shell with nothing running: the agent
  // runs its command again. They go when closed (×, terminal_stop) or their shell exits. by: 'human' (the panel comes
  // to the front) or 'agent' (behind the agent's terminal).
  saveTerminals() { this.store.saveTerminals([...this.terminals.values()].map(({ id, name, by }) => ({ id, name, by }))); }
  terminalsInfo(): Sent.OtherTerminal[] { return [...this.terminals.values()].map(({ id, name, command, by }) => ({ id, name, command, by })); }
  // A terminal by its name (as the agent knows it) or id (as the window does).
  terminal(which: number | string): TaskTerminal | { error: string } {
    const t = typeof which === 'number' ? this.terminals.get(which)
      : [...this.terminals.values()].find((x) => x.name.toLowerCase() === String(which).trim().toLowerCase());
    return t || { error: `no terminal "${which}"; open now: ${[...this.terminals.values()].map((x) => `"${x.name}"`).join(', ') || 'none'}` };
  }
  async openTerminal({ id, name, command = '', by = 'human' }: { id?: number; name?: string; command?: string; by?: 'human' | 'agent' } = {}): Promise<Result<{ id: number; name: string }>> {
    if (!this.loaded) return { error: 'the task is not open' };
    name = name?.trim();
    if (name && !this.terminal(name).error) return { error: `there is a terminal "${name}" already` };
    for (let n = 2; !name; n++) if (this.terminal(`Terminal ${n}`).error) name = `Terminal ${n}`;
    id ??= this.terminalSeq + 1;
    this.terminalSeq = Math.max(this.terminalSeq, id);
    const key = `${this.key}#${id}`, t: TaskTerminal = { id, name: name!, command, by, key };
    this.terminals.set(id, t);
    this.saveTerminals();
    this.shell.taskChanged(this, true); // its panel, which the window sizes
    t.pty = await startTerminal((channel, data) => this.window?.send(channel, data),
      { line: command, cwd: this.folder, env: this.env(), size: terminalSize(this.key), sizeOf: this.key }, key);
    // The shell exited by itself (exit), not stopped by Kulisa (closing, quitting: the terminal is kept then).
    t.pty.onExit(() => { if (!t.pty!.stopped) this.closeTerminal(id); });
    return { id, name: name! };
  }
  // A command typed into a terminal already open (its last one stopped first: interruptTerminal), or into a new one.
  async runInTerminal(name: string, command: string): Promise<Result<{ id: number; name: string; again?: boolean }>> {
    const t = this.terminal(name);
    if (refused(t)) return this.openTerminal({ name, command, by: 'agent' });
    t.command = command;
    t.pty?.write(`${command}\r`);
    this.shell.taskChanged(this, true);
    return { id: t.id, name: t.name, again: true };
  }
  // Ctrl+C, as the human would press it: what runs there stops, the shell stays.
  interruptTerminal(which: number | string): Result<{ id: number }> {
    const t = this.terminal(which);
    if (refused(t)) return t;
    t.pty?.write('\x03');
    return { id: t.id };
  }
  readTerminal(which: number | string, lines = 50): Result<{ text: string }> {
    const t = this.terminal(which);
    return refused(t) ? t : { text: t.pty ? terminalTail(t.pty, lines) : '' };
  }
  closeTerminal(which: number | string): Result<{ id: number }> {
    const t = this.terminal(which);
    if (refused(t)) return t;
    this.terminals.delete(t.id);
    this.saveTerminals();
    if (t.pty) stopTerminal(t.pty);
    forgetTerminal(t.key);
    this.shell.taskChanged(this, true);
    return { id: t.id };
  }
  // What the agent gets in its environment: where Kulisa's MCP server and hooks are for this task (the Kulisa
  // plugin reads them, other agent CLIs can too), its name, and the offset for the ports of the app it runs.
  env() {
    const base = `${this.shell.mcp.base}/task/${encodeURIComponent(this.project.id)}/${this.n}`;
    return { KULISA_MCP_URL: `${base}/mcp`, KULISA_URL: base, KULISA_TASK: this.name, KULISA_PORT_OFFSET: String(this.offset) };
  }
  // Its agent stopped, its profiles saved and closed (its project closes, or the task is deleted).
  // Its tabs are saved first, as they are: closing them one by one changes the profiles, and nothing is saved then.
  async unload() {
    this.shell.chooseAgent.cancel?.(this);
    if (this.pty) { stopTerminal(this.pty); this.pty = null; }
    forgetTerminal(this.key);
    for (const t of this.terminals.values()) { if (t.pty) stopTerminal(t.pty); forgetTerminal(t.key); }
    this.terminals.clear();
    if (this.loaded) this.list.saveTabs();
    this.loaded = false;
    await this.list.unloadAll();
  }
  // The agent's session, as its hooks report it (agent-hooks.ts).
  saveAgent(s: { sessionId?: string; transcript?: string }) { if (this.loaded) this.store.saveAgent({ ...this.store.agent(), ...s }); }
  setState(state: Task['state']) { this.state = state; this.seen = false; this.shell.taskChanged(this, false, true); }
  // Esc in the agent's terminal: a turn stopped so reports nothing (Claude Code runs no Stop hook then), so working or
  // waiting is no longer known; the human is there. An Esc that only closed a menu clears it too, until the next hook.
  interrupted() { if (this.state === 'working' || this.state === 'waiting') this.setState(null); }
  // The human sees it (shown, its window in focus); true when that changes what its tab shows.
  see() { const was = this.tabState; this.seen = true; return this.tabState !== was; }
  // What its tab shows: the agent's state, but nothing for a done one the human has seen.
  get tabState() { return this.state === 'done' && this.seen ? null : this.state; }

  // Profiles and their tabs: the one core the human (the window, app.ts) and the agent (mcp-server.ts) both act on.
  // Each side only translates (CLAUDE.md, Architecture): the checks, the questions and what an action does are here
  // and in Profile, so both get the same. A refusal is { error } saying why. Closed profiles stay closed across
  // restarts.
  find(id: string): Found {
    const profile = this.profiles.get(id);
    if (profile) return { profile };
    if (this.closed.has(id)) return { error: `Profile "${id}" is closed (it is still signed in): open it first.`, closed: true };
    return { error: `No profile "${id}". Profiles: ${[...this.profiles.keys(), ...this.closed.keys()].join(', ') || 'none yet'}` };
  }
  // A tab of an open profile; no tabId: its active tab.
  findTab(id: string, tabId?: string | null): Result<{ profile: Profile; tab: Tab }> {
    const r = this.find(id);
    if (refused(r)) return r;
    const tab = r.profile!.get(tabId);
    return tab && !tab.wc.isDestroyed() ? { profile: r.profile!, tab } : { error: tabId ? `No tab ${tabId} in ${id}` : `Profile "${id}" has no tab` };
  }
  createProfile(name: string, description?: string, avatar?: string) { return this.list.create(name, description, avatar); }
  renameProfile(id: string, name: string | undefined) { return this.list.rename(id, name); }
  describeProfile(id: string, description: unknown) { return this.list.describe(id, description); }
  setProfileAvatar(id: string, avatar: string) { return this.list.setAvatar(id, avatar); }
  closeProfile(id: string) { return this.list.close(id); }
  openProfile(id: string) { return this.list.open(id); }
  // Always after the human says yes, whoever asks (by: 'human' or 'agent'): sign-ins are made by hand and cannot be
  // made again by code.
  // It is the project's letting go of it (projects.ts, askDropProfile, dropProfile): its copy in every task of the
  // project goes; the profile stays, with its master (Settings → Profiles deletes it).
  async deleteProfile(id: string, by: 'human' | 'agent' = 'human'): Promise<Result<{ id: string }>> {
    const p = this.profiles.get(id) || this.closed.get(id)?.cfg;
    if (!p) return { error: `No profile "${id}"` };
    if (!await this.project.askDropProfile(p, by)) return { error: 'the human said no' };
    await this.project.dropProfile(p.folder);
    return { id };
  }
  // A caption over a profile's pane (ghost.ts, browser_highlight); sticky ones stay until the next caption.
  caption(profile: string, caption: string | null, sticky = false) { this.window?.send('agent', { task: this.key, profile, caption, sticky }); }

  // A test user's pair (profiles.md, "Test users' sign-ins"): set by the human (Settings → Profiles) or the agent
  // (profile_set_login, e.g. after it signed that user up). The password is kept encrypted with the OS keyring, never
  // in the clear: without a keyring it is not kept. An empty login takes the pair away.
  setLogin(id: string, user: string | undefined, password: string | undefined): Result<{ id: string }> {
    const s = this.shell.loginSecret(password);
    return refused(s) ? s : this.list.setLogin(id, user, s.secret);
  }
  // Its login or password, to type in a tab (the agent's browser_type_login; it never gets the password itself), only
  // on a local page or one the tab reached from a local page, never a big account provider's (local.ts).
  loginFor(id: string, tabId: string | null | undefined, field: 'login' | 'password'): Result<{ profile: Profile; tab: Tab; value: string }> {
    const r = this.findTab(id, tabId);
    if (refused(r)) return r;
    const pair = this.shell.profileStore.byFolder(r.profile!.folder)?.login;
    if (!pair?.user || (field === 'password' && !pair.secret)) {
      return { error: `${r.profile!.name} has no test login${pair?.user ? ' password' : ''} saved: ask the human to set one (Settings → Profiles), or save the one you signed it up with (profile_set_login).` };
    }
    const h = r.tab!.wc.navigationHistory, urls = h.getAllEntries().slice(0, h.getActiveIndex() + 1).map((e) => e.url);
    if (!loginAllowed(urls, this.project.entry.local || [])) {
      return { error: `${urls.at(-1)} is not the app under test on this computer: a test user's pair is typed only on a local address (localhost, *.test, a private network, the project's own list in Project Settings…) or a page the tab reached from one, never on Google, Microsoft or another account provider. A real account is the human's to sign in to (profile_ask_signin).` };
    }
    return { profile: r.profile!, tab: r.tab!, value: field === 'password' ? this.shell.secrets.decrypt(pair.secret!) : pair.user };
  }
  // Signing in to a profile's master (master.ts), for every task's copy made from it from then on. The human's only:
  // the agent never signs in (profile_ask_signin asks the human to, in this task's copy).
  openMaster(id: string) {
    const r = this.find(id);
    const p = r.profile || this.closed.get(id)?.cfg;
    return p ? this.shell.openMaster(p.folder) : r;
  }
  // Refresh from Master…: the master's cookies (its sign-ins) brought to this task's copy, made before the master was
  // signed in to; what was signed in only in this copy goes, so the human is asked first. Its open tabs reload.
  async refreshProfile(id: string): Promise<Result<{ id: string; cookies: number }>> {
    const r = this.find(id);
    if (refused(r)) return r;
    const p = r.profile;
    if (!await this.shell.ask({ message: `Bring the sign-ins of ${p.name}'s master to this task?`, ok: 'Refresh',
      detail: "This task's copy of the profile takes its master's cookies: what was signed in only here goes. Sign-ins kept in a site's storage (as Microsoft's are) are not brought: sign in here again for those." }, this.window)) {
      return { error: 'the human said no' };
    }
    await this.shell.flushMaster(p.folder);
    const master = { session: session.fromPath(this.shell.profileStore.masterDir(p.folder)), dir: this.shell.profileStore.masterDir(p.folder) };
    const set = await this.shell.sessionCookies.copy(master, p);
    for (const t of p.tabs) if (!t.wc.isDestroyed()) t.wc.reload();
    return { id, cookies: set };
  }
  // A profile its project let go (projects.ts, dropProfile): its copy gone; a task not loaded loses it from its file.
  async dropProfile(folder: string) { return this.loaded ? this.list.drop(folder) : this.store.dropProfile(folder); }

  info(): Sent.TaskInfo {
    const { n, key, name, tabState: state, folder, offset } = this;
    return { n, key, name, state, folder, offset, branch: this.entry.branch || null, closed: !!this.entry.closed, merged: !!this.entry.merged, agent: this.agent?.name || null };
  }
}

// A URL of the app under test moved to another task's ports: a local address with a port moves by shift, the
// difference of the two tasks' offsets (localhost:3000 → localhost:3100). Cookies do not depend on the port, so the profile stays signed in to the app.
function withOffset(url: string, shift: number) {
  if (!shift) return url;
  try {
    const u = new URL(url);
    if (!u.port || !/^(localhost|127(\.\d+){3}|\[::1\])$|\.localhost$/.test(u.hostname)) return url;
    u.port = String(Number(u.port) + shift);
    return u.href;
  } catch { return url; }
}

export type { TaskTerminal };
export { Task, withOffset };
