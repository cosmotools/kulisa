// A task (tasks.md; the term: CLAUDE.md): one line of work in a project. Its code (a git worktree of its own next to
// the project, worktrees.ts; without git, the project's folder itself), its profiles (folders in its data, store.ts), its
// grid and its terminals, its agents in some of them. Its project's window shows one task at a time; the others keep
// running, those of the other open projects too. A task loads (profiles, terminals) the first time it is shown, so a
// restart does not start every one at once.
import { session } from 'electron';
import fs from 'fs';
import path from 'path';
import { Profile, wipeSession } from './profiles.ts';
import { ProjectProfiles } from './project-profiles.ts';
import { installSigninPause } from './signin-pause.ts';
import { startTerminal, stopTerminal, forgetTerminal, terminalTail, sendToPrompt } from './terminal.ts';
import { clearHighlights } from './mcp-server.ts';
import { copyProfile } from './store.ts';
import { renameBranch } from './worktrees.ts';
import { extendTrust } from './agents/index.ts';
import { installSkill } from './agents/files.ts';
import { nameError } from './names.ts';
import { loginAllowed } from './local.ts';
import type { Tab } from './profiles.ts';
import type { Entry, Hooks } from './project-profiles.ts';
import type { Project } from './projects.ts';
import type { Conversation, Copy, TaskEntry, TaskStore } from './store.ts';
import type { Pty } from './terminal.ts';
import type { GitError } from './worktrees.ts';
import type { Shell, AgentChoice } from './shell.ts';
import type * as Sent from '../renderer/types.ts'; // what the window gets: its one definition
import { refused } from './result.ts';
import type { Result } from './result.ts';

type AgentState = 'working' | 'waiting' | 'done' | null;
// A terminal of the task, a tab of its island: the user's shell in its folder, with an agent started in it (agent,
// its conversation: an index in agent.json; its state as its hooks report it, seen: the human has seen it since) or
// not (a shell: its name, the command typed in, by whom).
interface TaskTerminal {
  id: number; key: string; name: string; command: string; by: 'human' | 'agent'; pty?: Pty;
  agent?: AgentChoice; conversation?: number; state: AgentState; seen: boolean; error?: undefined;
  handedFrom?: number; // the conversation it was handed (handOver), its number from 1, while it reads it
  newDirs?: Copy[]; giving?: boolean; // copies added to the task, given to the agent once its turn is over (giveDirs)
}
type Found = { profile: Profile; error?: undefined } | { error: string; closed?: boolean; profile?: undefined };

const DICTATION_LIMIT = 5 * 60_000; // a recording left on (a click and no second one)
// The message an agent handed the task starts with (handOver), as the human would type it: what to read, and that
// it tells the human what it understood, who sees at once what it missed.
const HANDOVER = (n: number, name: string) => `Go on with the work of conversation ${n} of this task ("${name}"). Read it ` +
  `whole with the kulisa task_history tool (conversation ${n}) before anything else. Then tell me in a few lines what ` +
  'is done and what is next, and go on with it.';

class Task {
  shell: Shell; project: Project; entry: TaskEntry; n: number; key: string; folder: string; offset: number; store: TaskStore;
  loaded: boolean; terminalsLoaded: boolean;
  terminals: Map<number, TaskTerminal>; terminalSeq: number; list: ProjectProfiles;
  profiles: ProjectProfiles['profiles']; closed: ProjectProfiles['closed'];
  front: number | null; lastAgent: number | null; // the island's tab in front; the agent's tab in front last
  resumedSession?: string | null; dictating?: { t: TaskTerminal; timer: NodeJS.Timeout } | null;
  // project: its project (projects.ts); entry: { n, name, branch, worktree, folder, base, offset, closed, closedAt }
  // from its tasks.json; one without a worktree works in the project's folder. key: the task among all open ones
  // ("<project id>/<n>"): the windows, the terminals, the CDP proxy and the MCP server's URLs know it by that.
  // shell: the app (app.ts): store, proxy, mcp, sessionCookies, signin, uiZoom, bus, ask; the agents
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
    this.loaded = false; this.terminalsLoaded = false;
    this.terminals = new Map(); this.terminalSeq = 0; // its island's terminals, by id, in their tabs' order
    this.front = null; this.lastAgent = null;
    this.list = new ProjectProfiles(this.store, shell.profileStore, project.id, this._profileHooks());
    this.profiles = this.list.profiles; this.closed = this.list.closed;
  }
  get window() { return this.project.window; }
  shown() { return this.window?.task === this; }
  get name() { return this.entry.name; }
  // Still its first name (projects.ts): neither its agent nor the human has named it.
  get unnamed() { return this.entry.name === `task-${this.n}`; }
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
    delete entry.about;
    this.project.save();
    this.window?.sendTasks(); this.window?.sendProjects();
    return { name: name!, branch: entry.branch || null };
  }

  // An unnamed task's first prompt (its first line), shown with its name until it has one: what it is about when its
  // agent did not name it.
  noteAbout(prompt: string) {
    const line = prompt.split('\n').map((l) => l.trim()).find(Boolean);
    if (!this.unnamed || this.entry.about || !line) return;
    this.entry.about = line.length > 120 ? `${line.slice(0, 119)}…` : line;
    this.project.save();
    this.window?.sendTasks(); this.window?.sendProjects();
  }

  // What it takes to run a profile of this task (project-profiles.ts).
  _profileHooks(): Hooks {
    const shell = this.shell;
    return {
      make: (cfg) => {
        const profile = new Profile(this.window!.win, cfg, { task: this.key });
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
        if (pick?.profile === p) pick.cancel();
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
  // of the project's folders without git, as they are (agents/, dirs; the MCP server's instructions name them). Not
  // the repositories it may add (addable): the agent reads those in the project's folders, changing nothing there.
  dirs() {
    const addable = this.addable();
    return [...new Set(this.project.repos().filter((r) => !addable.includes(r)).map((r) => this.entry.copies?.find((c) => c.repo === r)?.folder || r))]
      .filter((d) => d !== this.folder);
  }
  // The project's repositories in git it has no copy of yet; none for a task without git (it works in a folder).
  addable() {
    const { copies } = this.entry;
    return copies ? this.project.repos().filter((r) => this.project.gits.get(r) === 'ok' && !copies.some((c) => c.repo === r)) : [];
  }
  // Another of the project's repositories added to it, when its work turns out to need it (the human's Add Repository
  // on its tab, the agent's task_add_repository once the human agreed; the author, 2026-10-13): a copy on its branch,
  // given to its running agents (giveDirs); at their next start they get it as the others (dirs). The copy's
  // { folder, branch }.
  async addRepository(repo: string): Promise<Result<{ folder: string; branch: string }>> {
    if (!this.entry.copies) return { error: "this task works in the project's folder (no git): it has no copies to add to" };
    const found = this.project.repos().find((r) => r === repo || path.basename(r) === repo);
    if (!found) return { error: `${repo} is not one of the project's repositories: ${this.project.repos().join(', ')}` };
    if (this.entry.copies.some((c) => c.repo === found)) return { error: `the task has ${found} already` };
    if (!this.addable().includes(found)) return { error: `${found} has no git commit to copy` };
    const c = await this.project.addCopy(this, found);
    if (refused(c)) return c;
    for (const t of this.agentTerminals()) if (t.pty) { (t.newDirs ??= []).push(c); void this.giveDirs(t); }
    this.window?.sendTasks(); this.window?.sendProjects();
    return { folder: c.folder, branch: c.branch };
  }
  // Copies added to the task, sent to a running agent by Kulisa as the human would type them (the author, 2026-10-13:
  // the human sending a typed /add-dir was a step easily missed). Never while it waits for the human: Enter answered
  // Claude Code's permission question with Yes, the pasted line lost (2.1.296). Claude Code's /add-dir goes into a
  // turn too: it runs at once, its question over the turn, which goes on (2.1.296); others get a line saying so once
  // the turn is over (agents/, addDir). A draft the human is typing there then gets the line too.
  async giveDirs(t: TaskTerminal) {
    if (t.giving) return;
    t.giving = true;
    const busy = () => t.state === 'waiting' || (t.state === 'working' && !t.agent!.addDir);
    while (t.pty && this.terminals.get(t.id) === t && !busy() && t.newDirs?.length) {
      const c = t.newDirs.shift()!, add = t.agent!.addDir;
      await sendToPrompt(t.pty, add ? add.command(c.folder) : `Kulisa added ${c.folder} to this task: a copy of the project's repository ${c.repo}, on branch ${c.branch}. Nothing to do about it now.`, add?.confirm);
    }
    t.giving = false;
  }
  // Its project's repositories checked too, for what it may add (addable) and its agents' folders (dirs).
  async loadProfiles() { await Promise.all([this.list.load(), this.project.checkGit()]); this.loaded = true; }

  // Its island (docs/window.md, The terminal): the terminals in tabs, one shown at a time. Each the user's shell in the
  // task's folder, with an agent started in it or not. A shell is for what keeps running where the human sees it (the
  // human's own, the agent's terminal_run: the app's dev server), rather than in the background of the agent's own
  // shell, which some agents cannot do and the human does not see. As in an IDE they are kept: when the task loads
  // again (a restart, its project opened again) each comes back in its tab, an agent's conversation resumed, a shell
  // with nothing running (the agent runs its command again). They go when closed (×, terminal_stop) or their shell exits.
  // A task that never had one opens its agent (none: nothing, the island's buttons instead); the last one closed leaves
  // the island folded to its + (terminals.json says so).
  async loadTerminals() {
    if (this.terminalsLoaded || !this.loaded) return;
    this.terminalsLoaded = true;
    const saved = this.store.terminals();
    if (!saved) {
      const own = this.ownAgent();
      if (own !== null) await this.openAgent(own); else this.saveTerminals();
      return;
    }
    this.front = saved.front ?? null;
    const conversations = this.conversations();
    await Promise.all(saved.list.map((t) => (t.conversation === undefined ? this.openTerminal({ id: t.id, name: t.name, by: t.by, front: false })
      : this.openAgent(conversations[t.conversation]?.agent, { id: t.id, conversation: t.conversation, front: false }))
      .catch((e: Error) => console.error('[terminal]', e))));
    // In their tabs' order again: an agent's comes once its program is found, after the shells.
    const order = saved.list.map((t) => t.id), rank = (id: number) => (order.includes(id) ? order.indexOf(id) : order.length);
    this.terminals = new Map([...this.terminals].sort(([a], [b]) => rank(a) - rank(b)));
    this.changedTerminals();
  }
  conversations() { return this.store.agent().conversations || []; }
  updateConversation(i: number, change: Partial<Conversation>) {
    const a = this.store.agent(), list = a.conversations || [];
    if (!list[i]) return;
    list[i] = { ...list[i], ...change };
    for (const k of Object.keys(change) as (keyof Conversation)[]) if (change[k] === undefined) delete list[i][k];
    this.store.saveAgent({ ...a, conversations: list });
  }
  // The task's agent: the one it was made with (its project's default then); null: none, its project had agents and no
  // default (projects.ts, createTask); undefined: its project had none, openAgent opens a shell (or KULISA_AGENT's).
  ownAgent() { return this.store.agent().agent; }
  // Ctrl+` on the folded island: the task's agent, a new conversation; { none } when it has none (the window then gives
  // the keyboard to the island's buttons or opens its +).
  async openOwn(): Promise<Result<{ id: number } | { none: true }>> {
    const own = this.ownAgent();
    return own === null ? { none: true } : this.openAgent(own);
  }
  saveTerminals() {
    this.store.saveTerminals({ front: this.front, list: [...this.terminals.values()].map(({ id, name, by, conversation }) =>
      (conversation === undefined ? { id, name, by } : { id, conversation })) });
  }
  agentTerminals() { return [...this.terminals.values()].filter((t) => t.agent); }
  // The agent shown, where the dictation goes; none when the tab in front is a shell.
  shownAgent() { const t = this.front === null ? null : this.terminals.get(this.front); return t?.agent ? t : null; }
  // Where a pick goes: the agent shown, else the one shown last, else the last opened.
  promptTarget() {
    const last = this.lastAgent === null ? null : this.terminals.get(this.lastAgent);
    return this.shownAgent() || (last?.agent ? last : null) || this.agentTerminals().at(-1) || null;
  }
  get pty() { return this.promptTarget()?.pty || null; }
  // A tab's name: a shell's own; an agent's, the name it gave its conversation (nameConversation), else its agent's,
  // numbered when another agent's tab has it too.
  label(t: TaskTerminal) {
    if (!t.agent) return t.name;
    const own = this.conversations()[t.conversation!]?.title;
    if (own) return own;
    const same = this.agentTerminals().filter((x) => !this.conversations()[x.conversation!]?.title && x.agent!.cli === t.agent!.cli);
    const n = same.indexOf(t) + 1;
    return n > 1 ? `${t.agent.cli} ${n}` : t.agent.cli;
  }

  // An agent in a new tab, in front (the human opened it) or not (coming back after a restart): a new conversation of
  // it, or the one it had (conversation: its index). first: what it is told first, as if the human typed it
  // (handOver). An account no longer there, or its agent not installed: the window asks among the project's (and
  // installs it), the one chosen starting a new conversation. None, and none in the project: a shell.
  async openAgent(account: string | undefined, { id, conversation, first, front = true }: { id?: number; conversation?: number; first?: string; front?: boolean } = {}): Promise<Result<{ id: number }>> {
    if (!this.loaded) return { error: 'the task is not open' };
    const { shell } = this;
    let agent: AgentChoice | null = shell.agentFor(account);
    if (!agent && !account && !this.project.agents().length) agent = shell.agentFor('shell');
    let found = agent && await shell.findAgent(agent, this.folder);
    if (!found) {
      const chosen = await shell.chooseAgent(this, agent);
      found = chosen && this.loaded ? await shell.findAgent(chosen, this.folder) : null;
      if (!found) {
        if (conversation !== undefined) this.updateConversation(conversation, { terminal: undefined, to: Date.now() });
        return { error: 'no agent was chosen' };
      }
      if (chosen!.id !== agent?.id) conversation = undefined;
      agent = chosen;
    }
    const a = agent!;
    if (!a.command) return this.openTerminal({ id, front });
    id ??= this.terminalSeq + 1;
    this.terminalSeq = Math.max(this.terminalSeq, id);
    const list = this.store.agent();
    const conversations = list.conversations || [];
    if (conversation === undefined || conversations[conversation]?.agent !== a.id) {
      conversations.push({ agent: a.id, from: Date.now() });
      conversation = conversations.length - 1;
    }
    conversations[conversation]!.terminal = id;
    this.store.saveAgent({ ...list, conversations });
    const t: TaskTerminal = { id, key: `${this.key}#${id}`, name: '', command: '', by: 'human', agent: a, conversation, state: null, seen: true };
    this.terminals.set(id, t);
    if (front) this.show(id); else { if (this.front === id) this.lastAgent = id; this.saveTerminals(); this.changedTerminals(); }
    const saved = this.conversations()[conversation]!;
    const resume = (a.resume && a.resume(saved)) || null;
    this.resumedSession = resume ? saved.sessionId ?? null : null;
    const env = this.env(t), dirs = this.dirs(), more: { args?: string[]; env?: Record<string, string> } = (dirs.length && a.dirs?.(dirs)) || {};
    // Each copy trusted as the human trusted the project's code, in its folder or another task's copy (extendTrust).
    const where = { configDir: a.configDir, transcript: (this.project.agentData() as { transcript?: string }).transcript };
    const copies = this.shell.store.tasksOf(this.project.entry).list.flatMap((e) => e.copies || []);
    for (const c of this.entry.copies || []) {
      extendTrust(a, where, c.folder, [c.repo, ...copies.filter((o) => o.repo === c.repo && o.folder !== c.folder).map((o) => o.folder)]);
    }
    // Kulisa's profiles skill where the agent reads it, in its account's folder only (never the human's own).
    if (a.configDir && Object.keys(a.env).length) {
      try { if (a.skills) installSkill(shell.packages, path.join(a.configDir, a.skills)); } catch (e) { console.warn('[agents] skill:', (e as Error).message); }
    }
    if (this.terminals.get(id) !== t) return { error: 'the terminal was closed' };
    // The program by name, as the human would type it, unless the shell does not find it yet (just installed).
    const command = found.onPath ? a.command : found.path;
    t.pty = await startTerminal((channel, data) => this.window?.send(channel, data), { command, shell: a.shell, cwd: this.folder,
      env: { ...env, ...more.env, ...a.env }, pinned: a.env, sizeOf: this.key,
      args: [...(resume || []), ...(a.args?.({ env, packages: shell.packages, account: Object.keys(a.env).length ? a.configDir : null }) || []), ...(more.args || []), ...((!resume && first && a.prompt?.(first)) || [])] }, t.key);
    if (this.terminals.get(id) !== t) { stopTerminal(t.pty); return { error: 'the terminal was closed' }; }
    // Its shell exited by itself (exit), not stopped by Kulisa (closing, quitting: the terminal is kept then).
    t.pty.onExit(() => { if (!t.pty!.stopped) this.dropTerminal(t); });
    this.updateConversation(conversation, { started: true });
    this.sendVoice();
    return { id };
  }
  // The same agent from nothing (New Conversation, or + with it): a new tab; the one before stays.
  newConversation(id: number) {
    const t = this.terminals.get(id);
    return t?.agent ? this.openAgent(t.agent.id) : Promise.resolve({ error: `no agent's terminal ${id}` });
  }
  // The task handed to an agent (the agent's icon on its tab, Change agent…): it opens in a new tab, told to go on with
  // that tab's conversation, which it reads in task_history while the window's dialog shows it (historyRead;
  // HandOver.vue). In front from its start, under the dialog: a tab behind has no size, and its xterm laid out what the
  // agent drew for the island's size in 80 columns. The tab it came from stays: the human closes it.
  async handOver(id: number, account: string): Promise<Result<{ id: number }>> {
    const t = this.terminals.get(id);
    if (!t?.agent) return { error: `no agent's terminal ${id}` };
    const n = t.conversation! + 1, r = await this.openAgent(account, { first: HANDOVER(n, this.label(t)) });
    const handed = !refused(r) && this.terminals.get(r.id);
    if (handed) handed.handedFrom = n;
    return r;
  }
  // An agent read a part of a conversation in task_history: the one it was handed, shown as it goes (HandOver.vue).
  historyRead(t: TaskTerminal, conversation: number, part: number, parts: number) {
    if (t.handedFrom !== conversation) return;
    if (part >= parts) t.handedFrom = undefined;
    this.window?.send('handover:read', { task: this.key, id: t.id, part, parts });
  }
  // The name an agent gives its conversation (conversation_rename): its tab's, in 1–3 words.
  nameConversation(t: TaskTerminal, name: string | undefined): Result<{ name: string }> {
    const words = name?.trim().split(/\s+/).filter(Boolean) || [];
    if (!words.length || words.length > 3 || words.join(' ').length > 40) return { error: 'a name of 1 to 3 words, at most 40 characters' };
    this.updateConversation(t.conversation!, { title: words.join(' ') });
    this.changedTerminals();
    return { name: words.join(' ') };
  }

  // The tab in front, chosen by the human, or a new one they opened.
  show(id: number): Result<{ id: number }> {
    const t = this.terminals.get(id);
    if (!t) return { error: `no terminal ${id}` };
    this.front = id;
    if (t.agent) this.lastAgent = id;
    if (this.dictating && this.dictating.t !== t) this.dictate(false);
    this.saveTerminals();
    this.see();
    this.changedTerminals();
    this.sendVoice();
    return { id };
  }
  // The island's tabs changed (opened, closed, in front, named, an agent's state): the window draws them, the task's tab
  // its state.
  changedTerminals() { this.shell.taskChanged(this, true); this.shell.taskChanged(this, false, true); }
  // A shell by its name (as the agent knows it) or id (as the window does); never an agent's: its conversation is read in
  // task_history, and a command typed there would be a message to it.
  terminal(which: number | string): TaskTerminal | { error: string; agent?: boolean } {
    const shells = [...this.terminals.values()].filter((t) => !t.agent), name = String(which).trim().toLowerCase();
    const t = typeof which === 'number' ? shells.find((x) => x.id === which) : shells.find((x) => x.name.toLowerCase() === name);
    if (t) return t;
    if (typeof which === 'string' && this.agentTerminals().some((x) => this.label(x).toLowerCase() === name)) {
      return { error: `"${which}" is an agent's tab, not a terminal to run in: read what it did in task_history`, agent: true };
    }
    return { error: `no terminal "${which}"; open now: ${shells.map((x) => `"${x.name}"`).join(', ') || 'none'}` };
  }
  // A shell: the human's (+, in front) or the agent's (terminal_run, behind the tab in front: the human goes on
  // watching the agent).
  async openTerminal({ id, name, command = '', by = 'human', front = by === 'human' }: { id?: number; name?: string; command?: string; by?: 'human' | 'agent'; front?: boolean } = {}): Promise<Result<{ id: number; name: string }>> {
    if (!this.loaded) return { error: 'the task is not open' };
    name = name?.trim();
    if (name && !this.terminal(name).error) return { error: `there is a terminal "${name}" already` };
    for (let n = 1; !name; n++) if (this.terminal(n > 1 ? `Terminal ${n}` : 'Terminal').error) name = n > 1 ? `Terminal ${n}` : 'Terminal';
    id ??= this.terminalSeq + 1;
    this.terminalSeq = Math.max(this.terminalSeq, id);
    const t: TaskTerminal = { id, key: `${this.key}#${id}`, name, command, by, state: null, seen: true };
    this.terminals.set(id, t);
    if (front || this.front === null) this.show(id); else { this.saveTerminals(); this.changedTerminals(); }
    t.pty = await startTerminal((channel, data) => this.window?.send(channel, data),
      { line: command, cwd: this.folder, env: this.env(), sizeOf: this.key, screen: true }, t.key);
    if (this.terminals.get(id) !== t) { stopTerminal(t.pty); return { error: 'the terminal was closed' }; }
    t.pty.onExit(() => { if (!t.pty!.stopped) this.dropTerminal(t); });
    return { id, name };
  }
  // A command typed into a terminal already open (its last one stopped first: interruptTerminal), or into a new one.
  async runInTerminal(name: string, command: string): Promise<Result<{ id: number; name: string; again?: boolean }>> {
    const t = this.terminal(name);
    if (refused(t)) return t.agent ? t : this.openTerminal({ name, command, by: 'agent' });
    t.command = command;
    t.pty?.write(`${command}\r`);
    this.changedTerminals();
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
    this.dropTerminal(t);
    return { id: t.id };
  }
  // × on a tab, or Close in its menu. An agent's asks first, always: it stops, whatever it is doing (its conversation
  // stays in the task's history).
  async closeTab(id: number): Promise<Result<{ id: number }>> {
    const t = this.terminals.get(id);
    if (!t) return { error: `no terminal ${id}` };
    if (t.agent && !await this.shell.ask({ message: `Close ${this.label(t)}?`, ok: 'Close',
      detail: `${t.agent.cli} stops${t.state === 'working' ? ' in the middle of its work' : ''}. Its conversation stays in the task's history, where any agent of the task can read it.` }, this.window)) {
      return { error: 'the human said no' };
    }
    this.dropTerminal(t);
    return { id };
  }
  // A tab gone: what runs there stops; the tab next to it comes to the front.
  dropTerminal(t: TaskTerminal) {
    if (this.terminals.get(t.id) !== t) return;
    const order = [...this.terminals.keys()], i = order.indexOf(t.id);
    this.terminals.delete(t.id);
    if (this.dictating?.t === t) this.dictate(false);
    if (t.pty) stopTerminal(t.pty);
    forgetTerminal(t.key);
    this.window?.send('terminals:gone', [t.key]);
    if (t.conversation !== undefined) this.updateConversation(t.conversation, { terminal: undefined, to: Date.now() });
    if (this.lastAgent === t.id) this.lastAgent = null;
    if (this.front === t.id) {
      const next = order[i + 1] ?? order[i - 1];
      this.front = next ?? null;
      if (next !== undefined && this.terminals.get(next)?.agent) this.lastAgent = next;
    }
    this.saveTerminals();
    this.changedTerminals();
    this.sendVoice();
  }
  // The island's tabs, for the window.
  terminalsInfo(): Sent.Terminals {
    return { front: this.front, list: [...this.terminals.values()].map((t) => ({ id: t.id, name: this.label(t), command: t.command, by: t.by,
      agent: t.agent ? { account: t.agent.id, cli: t.agent.agentId, name: t.agent.name } : null,
      state: t.state === 'done' && t.seen ? null : t.state })) };
  }

  // Dictation, where the agent shown has its own (agents/, voice): what the window's microphone button shows
  // ({ languages, language, note, recording }, or null: no button), recording, and the language chosen there. The
  // human's only: the agent has no use for a microphone.
  voice() {
    const t = this.shownAgent(), v = t?.agent!.voice;
    return v ? { languages: v.languages, language: v.language(this.savedOf(t)), note: v.note || '', recording: this.dictating?.t === t } : null;
  }
  sendVoice() { this.window?.send('voice', { task: this.key, voice: this.voice() }); }
  // An agent's conversation as agents/ reads its files, with its account's folder.
  savedOf(t: TaskTerminal) { return { ...this.conversations()[t.conversation!], configDir: t.agent!.configDir }; }
  // Recording: the agent's key held, as a terminal shows a held key, its repeats. It stops when told, or after
  // DICTATION_LIMIT, or when that agent is gone or no longer shown.
  dictate(on: boolean): { recording: boolean } {
    clearInterval(this.dictating?.timer);
    this.dictating = null;
    const t = this.shownAgent(), v = t?.agent!.voice, p = t?.pty;
    if (on && v && p) {
      const until = Date.now() + DICTATION_LIMIT;
      this.dictating = { t, timer: setInterval(() => {
        if (t.pty === p && Date.now() < until) return p.write(v.key);
        this.dictate(false);
        this.sendVoice();
      }, v.repeat) };
    }
    return { recording: !!this.dictating };
  }
  setVoiceLanguage(code: string) {
    const t = this.shownAgent(), v = t?.agent!.voice;
    return v ? v.setLanguage(this.savedOf(t), code) : { error: 'this agent has no dictation' };
  }

  // What its terminals get in their environment: where Kulisa's MCP server and hooks are for this task (the Kulisa
  // plugin reads them, other agent CLIs can too), its name, and the offset for the ports of the app it runs. An agent's
  // terminal has URLs of its own (t), so its hooks report its own state and it names its own tab.
  env(t?: TaskTerminal) {
    const base = `${this.shell.mcp.base}/task/${encodeURIComponent(this.project.id)}/${this.n}${t ? `/t/${t.id}` : ''}`;
    return { KULISA_MCP_URL: `${base}/mcp`, KULISA_URL: base, KULISA_TASK: this.name, KULISA_PORT_OFFSET: String(this.offset) };
  }
  // Its terminals stopped (kept for when it loads again), its profiles saved and closed (its project closes, or the task
  // is deleted). Its tabs are saved first, as they are: closing them one by one changes the profiles, and nothing is
  // saved then.
  async unload() {
    this.shell.chooseAgent.cancel?.(this);
    this.dictate(false);
    for (const t of this.terminals.values()) { if (t.pty) stopTerminal(t.pty); forgetTerminal(t.key); }
    this.terminals.clear();
    forgetTerminal(this.key);
    this.terminalsLoaded = false; this.front = null; this.lastAgent = null;
    if (this.loaded) this.list.saveTabs();
    this.loaded = false;
    await this.list.unloadAll();
  }
  // An agent's session, as its hooks report it (agent-hooks.ts).
  saveSession(t: TaskTerminal, s: { sessionId?: string; transcript?: string }) { if (this.terminals.get(t.id) === t) this.updateConversation(t.conversation!, s); }
  setState(t: TaskTerminal, state: AgentState) {
    t.state = state;
    t.seen = state !== 'done' || (this.front === t.id && this.shown() && !!this.window?.win.isFocused());
    this.changedTerminals();
    if (state !== 'working' && state !== 'waiting') void this.giveDirs(t);
  }
  // Esc in an agent's terminal: a turn stopped so reports nothing (Claude Code runs no Stop hook then), so working or
  // waiting is no longer known; the human is there. An Esc that only closed a menu clears it too, until the next hook.
  interrupted(key: string) {
    const t = [...this.terminals.values()].find((x) => x.key === key);
    if (t && (t.state === 'working' || t.state === 'waiting')) this.setState(t, null);
  }
  // The human sees the tab in front (the task shown, its window in focus); true when that changes what its tab shows.
  see() {
    const was = this.tabState, t = this.front === null ? null : this.terminals.get(this.front);
    if (t) t.seen = true;
    return this.tabState !== was;
  }
  // Whether one of its agents is working (closing it, or quitting, asks first).
  get working() { return this.agentTerminals().some((t) => t.state === 'working'); }
  // What its tab shows: the most urgent of its agents' states, waiting for the human first; a done one the human has
  // seen, nothing.
  get tabState(): AgentState {
    const states = this.agentTerminals().map((t) => (t.state === 'done' && t.seen ? null : t.state));
    return (['waiting', 'working', 'done'] as const).find((s) => states.includes(s)) ?? null;
  }

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
    const tab = r.profile.get(tabId);
    return tab && !tab.wc.isDestroyed() ? { profile: r.profile, tab } : { error: tabId ? `No tab ${tabId} in ${id}` : `Profile "${id}" has no tab` };
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
    const pair = this.shell.profileStore.byFolder(r.profile.folder)?.login;
    if (!pair?.user || (field === 'password' && !pair.secret)) {
      return { error: `${r.profile.name} has no test login${pair?.user ? ' password' : ''} saved: ask the human to set one (Settings → Profiles), or save the one you signed it up with (profile_set_login).` };
    }
    const h = r.tab.wc.navigationHistory, urls = h.getAllEntries().slice(0, h.getActiveIndex() + 1).map((e) => e.url);
    if (!loginAllowed(urls, this.project.entry.local || [])) {
      return { error: `${urls.at(-1)} is not the app under test on this computer: a test user's pair is typed only on a local address (localhost, *.test, a private network, the project's own list in Project Settings…) or a page the tab reached from one, never on Google, Microsoft or another account provider. A real account is the human's to sign in to (profile_ask_signin).` };
    }
    return { profile: r.profile, tab: r.tab, value: field === 'password' ? this.shell.secrets.decrypt(pair.secret!) : pair.user };
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
    return { n, key, name, state, folder, offset, branch: this.entry.branch || null, closed: !!this.entry.closed, merged: !!this.entry.merged,
      about: this.entry.about, repos: this.addable() };
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
