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
import { startTerminal, stopTerminal, forgetTerminal, terminalTail, sendToPrompt, typeIntoPrompt, typeLine, interrupt } from '../terminal/main/index.ts';
import { READ_MAX } from './kulisa-plugin/mcp-server.ts';
import { copyProfile } from './store.ts';
import { renameBranch } from './worktrees.ts';
import { send, shareQuietly, playedElsewhere } from './partners.ts';
import { extendTrust } from './agents/index.ts';
import { installSkill } from './agents/files.ts';
import { nameError } from '../shared/names.ts';
import { loginAllowed } from './local.ts';
import { log } from './log.ts';
import type { Tab } from './profiles.ts';
import type { Entry, Hooks } from './project-profiles.ts';
import type { Project } from './projects.ts';
import type { AppWindow } from './window.ts';
import type { Conversation, Copy, Role, TaskEntry, TaskStore } from './store.ts';
import type { Pty } from '../terminal/main/index.ts';
import type { GitError } from './worktrees.ts';
import type { Shell, AgentChoice } from './shell.ts';
import type { Found as AgentFound } from './agents/agent.ts';
import type { Model } from '../shared/types.ts';
import type * as Sent from '../shared/types.ts'; // what the window gets: its one definition
import { refused } from '../shared/result.ts';
import type { Result } from '../shared/result.ts';

type AgentState = 'working' | 'waiting' | 'done' | null;
// A terminal of the task, a tab of its island: the user's shell in its folder, with an agent started in it (agent,
// its conversation: an index in agent.json; its state as its hooks report it, seen: the human has seen it since) or
// not (a shell: its name, the command typed in, by whom).
interface TaskTerminal {
  id: number; key: string; name: string; command: string; by: 'human' | 'agent'; pty?: Pty;
  agent?: AgentChoice; conversation?: number; state: AgentState; seen: boolean; error?: undefined;
  handedFrom?: number; // the conversation it was handed (handOver), its number from 1, while it reads it
  newDirs?: { copy: Copy; removed?: true }[]; giving?: boolean; // copies added to the task or removed, told once its turn is over (giveDirs)
  inbox?: string[]; // its partners' messages (message), typed into its prompt once its turn is over
  models?: Model[]; // the models its agent offers (agents/, model), as found at its start
}
type Found = { profile: Profile; error?: undefined } | { error: string; closed?: boolean; profile?: undefined };

const DICTATION_LIMIT = 5 * 60_000; // a recording left on (a click and no second one)
const HOLD = 400; // the key down longer is held (records until let go), shorter is a press (until the next)
const CLOSED_SHOWN = 10; // closed conversations offered to go on with; the older ones are read in task_history
// The message an agent handed the task starts with (handOver), as the human would type it: what to read, and that
// it tells the human what it understood, who sees at once what it missed.
const HANDOVER = (n: number, name: string) => `Go on with the work of conversation ${n} of this task ("${name}"). Read it ` +
  `whole with the kulisa task_history tool (conversation ${n}) before anything else. Then tell me in a few lines what ` +
  'is done and what is next, and go on with it.';

class Task {
  shell: Shell; project: Project; entry: TaskEntry; n: number; key: string; folder: string; offset: number; store: TaskStore;
  window: AppWindow | null; // the one whose tab it is (window.ts)
  loaded: boolean; terminalsLoaded: boolean;
  gitChecked: Promise<void>; // its project's repositories looked at as it loads (Project.checkGit), awaited by its agents
  terminals: Map<number, TaskTerminal>; terminalSeq: number; list: ProjectProfiles;
  profiles: ProjectProfiles['profiles']; closed: ProjectProfiles['closed'];
  front: number | null; lastAgent: number | null; // the island's tab in front; the agent's tab in front last
  resumedSession?: string | null; dictating?: { t: TaskTerminal; timer: NodeJS.Timeout } | null; held?: number;
  // project: its project (projects.ts); entry: { n, name, branch, worktree, folder, base, offset, closed, closedAt }
  // from its tasks.json; one without a worktree works in the project's folder. key: the task among all open ones
  // ("<project id>/<n>"): the windows, the terminals, the CDP proxy and the MCP server's URLs know it by that.
  // shell: the app (app.ts): store, proxy, mcp, sessionCookies, signin, uiZoom, bus, ask; the agents
  // (agentFor, findAgent, chooseAgent, plugin); and taskChanged(task, now, agentState), called after any change of its
  // profiles or its agent's state. Its window is the one whose tab it is (window.ts: add, drop; win, viewsHidden,
  // picking, send), none while it is closed; it changes when the task moves to another window (moveTo).
  constructor(shell: Shell, project: Project, entry: TaskEntry) {
    this.shell = shell; this.project = project; this.entry = entry; this.window = null;
    this.n = entry.n;
    this.key = `${project.id}/${this.n}`;
    this.folder = entry.folder || project.folder; // its agent's: the copy of the default repository
    this.offset = entry.offset || 0;
    this.store = shell.store.taskOf(project, this.n);
    this.loaded = false; this.terminalsLoaded = false; this.gitChecked = Promise.resolve();
    this.terminals = new Map(); this.terminalSeq = 0; // its island's terminals, by id, in their tabs' order
    this.front = null; this.lastAgent = null;
    this.list = new ProjectProfiles(this.store, shell.profileStore, project.id, this._profileHooks());
    this.profiles = this.list.profiles; this.closed = this.list.closed;
  }
  shown() { return this.window?.task === this; }
  // Into another window (app.ts, Move to New Window), running: its profiles' pages go there, hidden until that window
  // lays them out; its agents' output goes there (window: send).
  moveTo(w: AppWindow) { for (const p of this.profiles.values()) p.moveTo(w.win); }
  get name() { return this.entry.name; }
  // Still its first name (projects.ts): neither its agent nor the human has named it.
  get unnamed() { return this.entry.name === `task-${this.n}`; }
  // A new name, the agent's (task_rename) or the human's (Rename… on its tab): the name in the bar and its branch
  // of each of its copies (git branch -m; -2, -3 when another branch has it). Its folders stay: its agent may be
  // working there. An agent names it once, while it has its first name (the author, 2026-10-20: a second agent of the
  // task renamed it over the first's, its tab changing with every agent that came).
  async rename(name: string | undefined, by: 'human' | 'agent' = 'human'): Promise<Result<{ name: string; branch: string | null }>> {
    if (by === 'agent' && !this.unnamed) return { error: `the task is named already ("${this.name}"): name your conversation with conversation_rename instead` };
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
    this.window?.sendProjects();
    return { name: name!, branch: entry.branch || null };
  }

  // An unnamed task's first prompt (its first line), shown with its name until it has one: what it is about when its
  // agent did not name it.
  noteAbout(prompt: string) {
    const line = prompt.split('\n').map((l) => l.trim()).find(Boolean);
    if (!this.unnamed || this.entry.about || !line) return;
    this.entry.about = line.length > 120 ? `${line.slice(0, 119)}…` : line;
    this.project.save();
    this.window?.sendProjects();
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
      start: async (profile, tabs) => {
        await shell.sessionCookies.restore(profile); // before the first request of any tab
        // Real accounts: the master's non-local cookies, then kept in step with it and the other tasks (cookie-sync.ts).
        await shell.cookieSync.attach(profile.folder, profile.session, this.project.entry.local || []);
        await profile.openTabs(tabs);
        // The window opens even if the shell's connection fails; the agent's tools say so for this profile.
        if (!profile.signinMode) await profile.connect(profile.endpoint!).catch((e: Error) => console.error(`[kulisa] ${profile.id}: no Playwright connection: ${e.message.split('\n')[0]}`));
        shell.bus.emit('profile-added', profile);
        profile.on('signin-mode', (on: boolean) => { if (!on) shell.bus.emit('profile-added', profile); });
      },
      // Its sign-ins saved (session cookies too) for when it opens again; its tabs and automation gone.
      unload: async (p) => {
        const pick = this.window?.picking.get(p.id);
        if (pick?.profile === p) pick.cancel();
        shell.bus.emit('profile-unloading', `${this.key}/${p.id}`);
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
        const { urls, active } = this.store.tabs(e.cfg.folder);
        e.tabs = { urls: urls.map((u) => withOffset(u, this.offset)), active };
        this.store.saveTabs(e.cfg.folder, e.tabs);
      },
      tabsOf: (p) => p.savedTabs((t) => this.urlOf(t)),
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
  // (signin-pages.ts); a tab still loading, the URL it is opening; a discarded one, the address it was kept at.
  urlOf(t: Tab) { return t.discarded ? t.url : t.wc.isDestroyed() ? '' : this.shell.signin.restoreUrl(t.wc) || t.pendingUrl || ''; }

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
    for (const t of this.agentTerminals()) if (t.pty) { (t.newDirs ??= []).push({ copy: c }); void this.giveDirs(t); }
    this.window?.sendProjects();
    return { folder: c.folder, branch: c.branch };
  }
  // One of them taken out again (the human's Remove Repository, the agent's task_remove_repository once the human
  // agreed; the author, 2026-10-13), by its repository's folder or name, or its copy's folder: asked first when it holds
  // work not pushed (askRemoveCopy). Not its own folder, where its agents work: that goes with the task. Its running
  // agents told; one not told yet of it being added is told nothing. The copy's folder.
  async removeRepository(repo: string): Promise<Result<{ folder: string }>> {
    const c = this.entry.copies?.find((x) => x.repo === repo || x.folder === repo || path.basename(x.repo) === repo);
    if (!c) return { error: `the task has no copy of ${repo}; its copies: ${(this.entry.copies || []).map((x) => x.folder).join(', ') || 'none'}` };
    if (c.folder === this.folder) return { error: `${c.folder} is the task's own folder, where its agents work: it goes only with the task` };
    if (!await this.project.askRemoveCopy(this, c)) return { error: 'the human said no' };
    await this.project.removeCopy(this, c);
    for (const t of this.agentTerminals()) {
      if (!t.pty) continue;
      if (t.newDirs?.some((d) => d.copy === c)) { t.newDirs = t.newDirs.filter((d) => d.copy !== c); continue; }
      (t.newDirs ??= []).push({ copy: c, removed: true });
      void this.giveDirs(t);
    }
    this.window?.sendProjects();
    return { folder: c.folder };
  }
  // Copies added to the task, sent to a running agent by Kulisa as the human would type them (the author, 2026-10-13:
  // the human sending a typed /add-dir was a step easily missed). Never while it waits for the human: Enter answered
  // Claude Code's permission question with Yes, the pasted line lost (2.1.296). Claude Code's /add-dir goes into a
  // turn too: it runs at once, its question over the turn, which goes on (2.1.296); others get a line saying so once
  // the turn is over (agents/, addDir). A copy removed: a line for every agent, once its turn is over (no agent has a
  // command to drop a folder). A draft the human is typing there then gets the line too.
  async giveDirs(t: TaskTerminal) {
    if (t.giving) return;
    t.giving = true;
    const busy = () => t.state === 'waiting' || (t.state === 'working' && (!t.agent!.addDir || !!t.newDirs?.[0]?.removed));
    while (t.pty && this.terminals.get(t.id) === t && t.newDirs?.length && !busy()) {
      const { copy: c, removed } = t.newDirs.shift()!, add = removed ? undefined : t.agent!.addDir;
      await sendToPrompt(t.pty, removed ? `Kulisa removed ${c.folder} from this task, with its branch ${c.branch}: work no more there. Nothing to do about it now.`
        : add ? add.command(c.folder) : `Kulisa added ${c.folder} to this task: a copy of the project's repository ${c.repo}, on branch ${c.branch}. Nothing to do about it now.`, add?.confirm);
    }
    t.giving = false;
  }
  // Its profiles made (they start behind: ProjectProfiles.load), and its project's repositories looked at meanwhile
  // (git, for what it may add: addable): the grid waits for no program to run, nor a site; its agents wait for both
  // (openAgent), finding its profiles ready and told at their start what the task may add.
  loadProfiles() {
    this.gitChecked = this.project.checkGit().then(() => this.shell.sendProjects(), (e: Error) => console.error('[git]', e));
    this.list.load();
    this.loaded = true;
  }

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
      if (own !== null) await this.openAgent(own, { role: this.ownRole() }); else this.saveTerminals();
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
  ownRole() { return this.store.agent().role; }
  // The role a conversation plays (its project's team: The team, docs/tasks.md), if it plays one still there.
  roleOf(t: TaskTerminal) { return t.conversation === undefined ? null : this.project.role(this.conversations()[t.conversation]?.role); }
  // A role as the human and agents call it: its name, else its account's.
  roleName(r: Role) { return r.name || this.shell.agentFor(r.account)?.name || r.account; }
  // A role of the project opened in the task (the island's +): its account, a new conversation of that role.
  openRole(id: string): Promise<Result<{ id: number }>> {
    const r = this.project.role(id);
    if (!r) return Promise.resolve({ error: `no role ${id} in the project` });
    this.project.keepPlayer(r);
    return this.openAgent(r.account, { role: r.id });
  }
  // The conversations no tab has open that their agent can go on with (its resume), the one closed last first: × on an
  // agent's tab loses nothing, as × on a task's (issue #119). Only the project's accounts' (or KULISA_AGENT's), as the
  // island's + lists them; a conversation without its session known is resumed by the agent's guess (Codex's --last).
  closedConversations() {
    const open = new Set(this.agentTerminals().map((t) => t.conversation)), agents = this.project.agents();
    return this.conversations().map((c, i) => ({ c, i, a: this.shell.agentFor(c.agent) }))
      .filter(({ c, i, a }) => !open.has(i) && a && (agents.includes(c.agent) || a.custom) && a.resume && a.resume(c))
      .sort((x, y) => (y.c.to ?? 0) - (x.c.to ?? 0)).slice(0, CLOSED_SHOWN);
  }
  // A closed conversation gone on with, in a tab of its own (the island's +, the empty task's Continue).
  continueConversation(i: number): Promise<Result<{ id: number }>> {
    const c = this.closedConversations().find((x) => x.i === i);
    return c ? this.openAgent(c.c.agent, { conversation: i }) : Promise.resolve({ error: `no closed conversation ${i + 1}` });
  }
  // Ctrl+` on the folded island: the conversation closed last, gone on with; with none, the task's agent, a new
  // conversation; { none } when it has none either (the window then gives the keyboard to the island's buttons or
  // opens its +).
  async openOwn(): Promise<Result<{ id: number } | { none: true }>> {
    const last = this.closedConversations()[0];
    if (last) return this.continueConversation(last.i);
    const own = this.ownAgent();
    return own === null ? { none: true } : this.openAgent(own, { role: this.ownRole() });
  }
  saveTerminals() {
    // An agent's tab still looking for its program, a new conversation not made yet: not a shell to bring back.
    this.store.saveTerminals({ front: this.front, list: [...this.terminals.values()].filter((t) => !t.agent || t.conversation !== undefined).map(({ id, name, by, conversation }) =>
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
  // Words for the human's next message to the agent (Pick's reference, a screenshot's path): typed without Enter into
  // the agent's prompt, its tab brought to the front, the keyboard there, so the human writes the rest around them.
  typeForAgent(text: string) {
    const to = this.promptTarget();
    if (!to?.pty) return false;
    typeIntoPrompt(to.pty, text);
    if (to.id !== this.front) this.show(to.id);
    const w = this.window;
    if (w && !w.win.isDestroyed()) { w.win.webContents.focus(); w.send('terminal:focus'); }
    return true;
  }
  // A tab's name: a shell's own; an agent's, its role's (the human's word for it), else the name it gave its
  // conversation (nameConversation), else its agent's, numbered when another agent's tab has it too.
  label(t: TaskTerminal) {
    if (!t.agent) return t.name;
    const own = this.roleOf(t)?.name || this.conversations()[t.conversation!]?.title;
    if (own) return own;
    const same = this.agentTerminals().filter((x) => !this.roleOf(x)?.name && !this.conversations()[x.conversation!]?.title && x.agent!.cli === t.agent!.cli);
    const n = same.indexOf(t) + 1;
    return n > 1 ? `${t.agent.cli} ${n}` : t.agent.cli;
  }

  // An agent in a new tab, in front (the human opened it) or not (coming back after a restart): a new conversation of
  // it, playing a role of the team or none, or the one it had (conversation: its index, its role kept). first: what it is told first, as if the human typed it
  // (handOver). An account no longer there, or its agent not installed: the window asks among the project's (and
  // installs it), the one chosen starting a new conversation. None, and none in the project: a shell.
  async openAgent(account: string | undefined, { id, conversation, first, role, front = true }: { id?: number; conversation?: number; first?: string; role?: string; front?: boolean } = {}): Promise<Result<{ id: number }>> {
    if (!this.loaded) return { error: 'the task is not open' };
    const { shell } = this;
    let agent: AgentChoice | null = shell.agentFor(account);
    if (!agent && !account && !this.project.agents().length) agent = shell.agentFor('shell');
    const place = (agent: AgentChoice) => {
      const tab: TaskTerminal = { id: id = this.terminalId(id), key: `${this.key}#${id}`, name: '', command: '', by: 'human', agent, conversation, state: null, seen: true };
      this.terminals.set(tab.id, tab);
      if (front) this.show(tab.id); else { if (this.front === tab.id) this.lastAgent = tab.id; this.saveTerminals(); this.changedTerminals(); }
      return tab;
    };
    // Its tab at once, starting (terminalsInfo), while its program is looked for in the user's login shell: a task
    // opening showed the island's buttons for that second (docs/window.md, A tab comes before its program).
    let t = agent?.command ? place(agent) : null;
    let found = agent && await shell.findAgent(agent, this.folder);
    if (t && this.terminals.get(t.id) !== t) return { error: 'the terminal was closed' };
    if (!found) {
      const chosen = await shell.chooseAgent(this, agent);
      found = chosen && this.loaded ? await shell.findAgent(chosen, this.folder) : null;
      if (!found) {
        if (t) this.dropTerminal(t); // its tab goes: the island as it was before
        else if (conversation !== undefined) this.updateConversation(conversation, { terminal: undefined, to: Date.now() });
        return { error: 'no agent was chosen' };
      }
      if (chosen!.id !== agent?.id) conversation = undefined;
      agent = chosen;
    }
    const a = agent!;
    if (!a.command) return this.openTerminal({ id, front });
    if (t && this.terminals.get(t.id) !== t) return { error: 'the terminal was closed' };
    t ??= place(a);
    const list = this.store.agent();
    const conversations = list.conversations || [];
    if (conversation === undefined || conversations[conversation]?.agent !== a.id) {
      conversations.push({ agent: a.id, ...(role && { role }), from: Date.now() });
      conversation = conversations.length - 1;
    }
    conversations[conversation]!.terminal = t.id;
    this.store.saveAgent({ ...list, conversations });
    Object.assign(t, { agent: a, conversation }); // the one chosen in its place, if another
    this.saveTerminals();
    this.changedTerminals();
    return this.launch(t, a, found, conversation, first);
  }
  // An agent's program started in its tab, its conversation resumed when it has one to go on with, with the model
  // the conversation was given (changeModel), else its role's, else the agent's own.
  async launch(t: TaskTerminal, a: AgentChoice, found: AgentFound, conversation: number, first?: string): Promise<Result<{ id: number }>> {
    const { shell } = this;
    const saved = this.conversations()[conversation]!;
    const model = a.model && (saved.model ?? this.project.role(saved.role)?.model);
    t.models = a.model?.list(a.configDir) ?? [];
    const resume = (a.resume && a.resume(saved)) || null;
    this.resumedSession = resume ? saved.sessionId ?? null : null;
    const env = this.env(t), dirs = this.dirs(), more: { args?: string[]; env?: Record<string, string> } = (dirs.length && a.dirs?.(dirs)) || {};
    // Each copy trusted as the human trusted the project's code, in its folder or another task's copy (extendTrust).
    const where = { configDir: a.configDir, transcript: (this.project.agentData() as { transcript?: string }).transcript };
    const copies = this.shell.store.tasksOf(this.project.entry).list.flatMap((e) => e.copies || []);
    for (const c of this.entry.copies || []) {
      extendTrust(a, where, c.folder, [c.repo, ...copies.filter((o) => o.repo === c.repo && o.folder !== c.folder).map((o) => o.folder)]);
    }
    // Kulisa's profiles skill where the agent reads it, and Kulisa's language (☰ → Language: app.ts, setLanguage) in its
    // own setting, in its account's folder only (never the human's own).
    if (a.configDir && Object.keys(a.env).length) {
      try { if (a.skills) installSkill(shell.packages, path.join(a.configDir, a.skills)); } catch (e) { console.warn('[agents] skill:', (e as Error).message); }
      const r = a.language?.set(a.configDir, shell.language);
      if (r?.error) console.warn('[agents] language:', r.error);
    }
    await Promise.all([this.gitChecked, this.list.started]); // its profiles ready, told at its start what it may add (agent-hooks.ts)
    if (this.terminals.get(t.id) !== t) return { error: 'the terminal was closed' };
    // The program by name, as the human would type it, unless the shell does not find it yet (just installed).
    const command = found.onPath ? a.command : found.path;
    t.pty = await startTerminal((channel, data) => this.window?.send(channel, data), { command, shell: a.shell, cwd: this.folder,
      env: { ...env, ...more.env, ...a.env }, pinned: a.env, sizeOf: this.key,
      args: [...(resume || []), ...(a.args?.({ env, packages: shell.packages, account: Object.keys(a.env).length ? a.configDir : null }) || []), ...(more.args || []),
        ...((model && a.model!.args(model)) || []), ...((!resume && first && a.prompt?.(first)) || [])] }, t.key);
    if (this.terminals.get(t.id) !== t) { stopTerminal(t.pty); return { error: 'the terminal was closed' }; }
    // Its shell exited by itself (exit), not stopped by Kulisa (closing, quitting: the terminal is kept then; another
    // model: a new pty in its place, which the old one's exit is not).
    const p = t.pty;
    p.onExit(() => { if (!p.stopped && t.pty === p) this.dropTerminal(t); });
    log.info(`[terminal] ${t.key} started ${a.id}${resume ? ' (resumed)' : ''}${model ? ` with ${model}` : ''}: ${command}`);
    this.changedTerminals(); // started
    this.updateConversation(conversation, { started: true });
    this.sendVoice();
    return { id: t.id };
  }
  // Another model for a tab's agent (its menu's Model; the author, 2026-10-20: opus to fable, not only one agent to
  // another): no hand-over, the same conversation resumed with it in the same tab, as after a restart; the same way
  // for every agent that resumes and takes a model (agents/, model). Asked first while it works: it stops. null: its
  // role's, else the agent's own.
  async changeModel(id: number, model: string | null): Promise<Result<{ id: number }>> {
    const t = this.terminals.get(id), a = t?.agent;
    if (!t || !a || t.conversation === undefined) return { error: `no agent's terminal ${id}` };
    if (!a.model) return { error: `${a.cli} takes no model from Kulisa` };
    if (model !== null && !t.models?.some((m) => m.id === model)) return { error: `${a.cli} offers no model ${model}` };
    if (!a.resume || !a.resume(this.conversations()[t.conversation]!)) {
      return { error: `${a.cli} cannot go on with this conversation yet (Kulisa does not know its session): give it a first message, then change its model` };
    }
    if (t.state === 'working' && !await this.shell.ask({ message: `Restart ${this.label(t)} with another model?`, ok: 'Restart',
      detail: `${a.cli} stops in the middle of its work, and goes on with the same conversation with the model.` }, this.window)) return { error: 'the human said no' };
    const found = await this.shell.findAgent(a, this.folder);
    if (!found) return { error: `${a.cli} is not found` };
    this.updateConversation(t.conversation, { model: model ?? undefined });
    if (t.pty) stopTerminal(t.pty);
    t.pty = undefined; t.state = null;
    this.changedTerminals();
    return this.launch(t, a, found, t.conversation);
  }
  // The same agent from nothing (New Conversation), in the same role: a new tab; the one before stays.
  newConversation(id: number) {
    const t = this.terminals.get(id);
    return t?.agent ? this.openAgent(t.agent.id, { role: this.roleOf(t)?.id }) : Promise.resolve({ error: `no agent's terminal ${id}` });
  }
  // The task handed to an agent (the agent's icon on its tab, Change agent…): it opens in a new tab, told to go on with
  // that tab's conversation, which it reads in task_history while the window's dialog shows it (historyRead;
  // HandOver.vue). In front from its start, under the dialog: a tab behind has no size, and its xterm laid out what the
  // agent drew for the island's size in 80 columns. The tab it came from stays: the human closes it. The role stays the
  // same (the author, 2026-10-20: an account out of money, or a model doing poorly in it): who plays it changes.
  async handOver(id: number, account: string): Promise<Result<{ id: number }>> {
    const t = this.terminals.get(id);
    if (!t?.agent) return { error: `no agent's terminal ${id}` };
    const n = t.conversation! + 1, r = await this.openAgent(account, { first: HANDOVER(n, this.label(t)), role: this.roleOf(t)?.id });
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
  // The task's team as its agents see it (team_list, the instructions; docs/tasks.md, The team): each role of the
  // project with the tab of the task that plays it now, if one does.
  team() {
    return this.project.team().map((role) => ({ role, terminal: this.agentTerminals().find((t) => this.roleOf(t)?.id === role.id) ?? null }));
  }
  // An agent's message to a partner in the task (agent_message), by the partner's role or tab name: typed into the
  // partner's prompt as a prompt, saying who it is from, so the human reads the talk in both terminals; once its turn
  // is over, never while it waits for the human (Enter would answer its question: giveDirs), those come meanwhile in
  // one prompt. A partner not open is refused: the human opens it (the island's +), as which agents work is theirs.
  // A partner on another computer (the task's card: partners.ts): a comment on the task's pull request.
  async message(from: TaskTerminal, to: string, text: string): Promise<Result<{ to: string; queued: boolean }>> {
    const name = to.trim().toLowerCase(), said = text.trim();
    const target = this.agentTerminals().find((t) => t !== from && [this.roleOf(t)?.name, this.label(t)].some((n) => n?.toLowerCase() === name));
    if (!target) {
      const away = said ? await send(this, from, to) : null;
      if (away) return 'error' in away ? away : { ...await away(said), queued: false };
      const open = this.agentTerminals().filter((t) => t !== from).map((t) => this.label(t));
      return { error: `no partner "${to}" open in this task (${open.length ? `open: ${open.join(', ')}` : 'none is open'}); a role not open is opened by the human, ask them` };
    }
    if (!said) return { error: 'an empty message' };
    (target.inbox ??= []).push(`From ${this.label(from)} (${from.agent!.cli}): ${said}`);
    this.deliver(target);
    return { to: this.label(target), queued: target.state === 'working' || target.state === 'waiting' };
  }
  // A message from the task's pull request (partners.ts): for a role (none: every agent of the task, the human's own
  // comment), typed once its turn is over; for a role not open here, kept until it opens.
  fromPartner(role: string | null, text: string) {
    const to = this.agentTerminals().filter((t) => !role || this.roleOf(t)?.id === role);
    if (!to.length) { if (role) (this.later[role] ??= []).push(text); return; }
    for (const t of to) { (t.inbox ??= []).push(text); this.deliver(t); }
  }
  later: Record<string, string[]> = {}; // messages for roles not open, by role id
  // The other computer a role is played on (its card: partners.ts), as the agent is told it; null: none.
  elsewhere(role: string) { return playedElsewhere(this, role); }
  // The pull request's last comment read (partners.ts), kept with the task.
  markSeen(seen: { pr: number; id: number }) { this.entry.prSeen = seen; this.project.save(); }
  deliver(t: TaskTerminal) {
    const r = this.roleOf(t);
    if (r && this.later[r.id]) { (t.inbox ??= []).push(...this.later[r.id]!); delete this.later[r.id]; }
    if (!t.pty || this.terminals.get(t.id) !== t || !t.inbox?.length || t.state === 'working' || t.state === 'waiting') return;
    void sendToPrompt(t.pty, t.inbox.splice(0).join('\n\n'));
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
    id = this.terminalId(id);
    const t: TaskTerminal = { id, key: `${this.key}#${id}`, name, command, by, state: null, seen: true };
    this.terminals.set(id, t);
    if (front || this.front === null) this.show(id); else { this.saveTerminals(); this.changedTerminals(); }
    t.pty = await startTerminal((channel, data) => this.window?.send(channel, data),
      { line: command, cwd: this.folder, env: this.env(), sizeOf: this.key, screen: READ_MAX }, t.key);
    if (this.terminals.get(id) !== t) { stopTerminal(t.pty); return { error: 'the terminal was closed' }; }
    t.pty.onExit(() => { if (!t.pty!.stopped) this.dropTerminal(t); });
    log.info(`[terminal] ${t.key} started: a shell${by === 'agent' ? " (the agent's)" : ''}`);
    this.changedTerminals(); // started
    return { id, name };
  }
  // A terminal's id: the one it had (coming back after a restart), else the next.
  terminalId(id?: number) { id ??= this.terminalSeq + 1; this.terminalSeq = Math.max(this.terminalSeq, id); return id; }
  // A command typed into a terminal already open (its last one stopped first: interruptTerminal), or into a new one.
  async runInTerminal(name: string, command: string): Promise<Result<{ id: number; name: string; again?: boolean }>> {
    const t = this.terminal(name);
    if (refused(t)) return t.agent ? t : this.openTerminal({ name, command, by: 'agent' });
    t.command = command;
    if (t.pty) typeLine(t.pty, command);
    this.changedTerminals();
    return { id: t.id, name: t.name, again: true };
  }
  // Ctrl+C, as the human would press it: what runs there stops, the shell stays.
  interruptTerminal(which: number | string): Result<{ id: number }> {
    const t = this.terminal(which);
    if (refused(t)) return t;
    if (t.pty) interrupt(t.pty);
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
  // × on a tab, or Close in its menu. An agent's asks first only while it works, as × on a task's: nothing else is
  // lost, its conversation goes on from the island's + (closedConversations).
  async closeTab(id: number): Promise<Result<{ id: number }>> {
    const t = this.terminals.get(id);
    if (!t) return { error: `no terminal ${id}` };
    if (t.agent && t.state === 'working' && !await this.shell.ask({ message: `Close ${this.label(t)}?`, ok: 'Close',
      detail: `${t.agent.cli} stops in the middle of its work. Its conversation goes on from the island's +, where it is listed with the closed ones.` }, this.window)) {
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
    log.info(`[terminal] ${t.key} gone`);
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
      agent: t.agent ? { account: t.agent.id, cli: t.agent.agentId, name: t.agent.name, about: this.roleOf(t)?.about ?? '', models: t.models ?? [],
        model: (t.conversation !== undefined && (this.conversations()[t.conversation]?.model ?? this.roleOf(t)?.model)) || null } : null, starting: !t.pty,
      state: t.state === 'done' && t.seen ? null : t.state })),
    closed: this.closedConversations().map(({ c, i, a }) => ({ i, name: c.title || a!.cli, account: a!.name, cli: a!.agentId, closedAt: c.to ?? c.from, unsure: !c.sessionId })) };
  }

  // Dictation, where the agent shown has its own (agents/, voice): what the window's microphone button shows
  // ({ recording }, or null: disabled), and recording. The human's only: the agent has no use for a microphone. Its
  // language is Kulisa's one (app.ts, setLanguage).
  voice() {
    const t = this.shownAgent();
    return t?.agent!.voice ? { recording: this.dictating?.t === t } : null;
  }
  sendVoice() { this.window?.send('voice', { task: this.key, voice: this.voice() }); }
  // The dictation key (keys.ts, voice.hold), as the microphone button: held, it records until let go; pressed once,
  // until the next press, or a press while it records stops it. Pressed with a shell in front, the agent the prompt
  // goes to comes to the front first: the key means "speak to the agent", wherever the keyboard is.
  holdKey(down: boolean) {
    if (down) {
      if (this.dictating && !this.held) this.dictate(false);
      else {
        const t = this.promptTarget();
        if (t && this.front !== t.id) this.show(t.id);
        this.held = Date.now();
        this.dictate(true);
      }
    } else {
      if (this.held && Date.now() - this.held > HOLD) this.dictate(false);
      this.held = 0;
    }
    this.sendVoice();
  }
  // The window lost the keyboard while the key is down: its release will never be seen, so the recording ends here.
  letGo() { if (this.held) { this.held = 0; this.dictate(false); this.sendVoice(); } }
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
    if (state !== 'working' && state !== 'waiting') { void this.giveDirs(t); this.deliver(t); }
    if (state === 'done') void shareQuietly(this); // its card, once its branch is on the remote (partners.ts)
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

  // Profiles and their tabs: the one core the human (the window, ipc/) and the agent (mcp-server.ts) both act on.
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
    return tab && (tab.discarded || !tab.wc.isDestroyed()) ? { profile: r.profile, tab } : { error: tabId ? `No tab ${tabId} in ${id}` : `Profile "${id}" has no tab` };
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
    return { n, key, project: this.project.id, name, state, folder, offset, branch: this.entry.branch || null, closed: !!this.entry.closed, merged: !!this.entry.merged,
      about: this.entry.about, repos: this.addable(),
      copies: (this.entry.copies || []).map((c) => ({ name: path.basename(c.repo), folder: c.folder, branch: c.branch })) };
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
