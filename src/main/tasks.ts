// A task (tasks.md; the term: CLAUDE.md): one line of work in a project. Its code (a git worktree of its own next to
// the project, worktrees.ts; without git, the project's folder itself), its profiles (folders in its data, store.ts), its
// grid and its terminals, its agents in some of them. Its project's window shows one task at a time; the others keep
// running, those of the other open projects too. A task loads (profiles, terminals) the first time it is shown, so a
// restart does not start every one at once.
import { nativeImage, session } from 'electron';
import fs from 'fs';
import path from 'path';
import { Profile, wipeSession } from './profiles.ts';
import { ProjectProfiles } from './project-profiles.ts';
import { installSigninPause } from './signin-pause.ts';
import { startTerminal, stopTerminal, forgetTerminal, terminalTail, sendToPrompt, typeIntoPrompt, eraseInPrompt, typeLine, interrupt, quotePaths } from '../terminal/main/index.ts';
import { READ_MAX } from '../kulisa-plugin/main/index.ts';
import { listArtifacts, saveArtifact } from './artifacts.ts';
import { copyProfile, worktreesOf, ownWorktree, folderOf, branchOf, taskKey } from './store.ts';
import { renameBranch } from './worktrees.ts';
import { extendTrust } from '../kulisa-plugin/main/index.ts';
import { installSkill } from '../kulisa-plugin/main/index.ts';
import { labelError } from '../shared/names.ts';
import { loginAllowed } from './local.ts';
import { log } from './log.ts';
import type { Tab } from './profiles.ts';
import type { Entry, Hooks } from './project-profiles.ts';
import type { Project } from './projects.ts';
import type { AppWindow } from './window.ts';
import type { Conversation, TaskEntry, TaskStore, Worktree } from './store.ts';
import type { Pty } from '../terminal/main/index.ts';
import type { GitError } from './worktrees.ts';
import type { Shell, AgentChoice } from './shell.ts';
import type * as Sent from '../shared/types.ts'; // what the window gets: its one definition
import { refused } from '../shared/result.ts';
import type { StageLayout } from '../shared/ipc.ts';
import type { Result } from '../shared/result.ts';

type AgentState = 'working' | 'waiting' | 'done' | null;
// A terminal of the task, a tab of its terminals: the user's shell in its folder, with an agent started in it (agent,
// its conversation: an index in agent.json; its state as its hooks report it, seen: the human has seen it since) or
// not (a shell: its name, the command typed in, by whom).
interface TaskTerminal {
  id: number; key: string; name: string; command: string; by: 'human' | 'agent'; pty?: Pty;
  agent?: AgentChoice; conversation?: number; state: AgentState; seen: boolean; error?: undefined;
  handedFrom?: number; // the conversation it was handed (handOver), its number from 1, while it reads it
  titleTimer?: NodeJS.Timeout; // its auto-title read again after a turn's end (followAutoTitle)
  newDirs?: { copy: Worktree; removed?: true }[]; giving?: boolean; // copies added to the task or removed, told once its turn is over (giveDirs)
}
type Found = { profile: Profile; error?: undefined } | { error: string; closed?: boolean; profile?: undefined };

// The message an agent handed the task starts with (handOver), as the human would type it: what to read, and that
// it tells the human what it understood, who sees at once what it missed.
const HANDOVER = (n: number, name: string) => `Go on with the work of conversation ${n} of this task ("${name}"). Read it ` +
  `whole with the kulisa task_history tool (conversation ${n}) before anything else. Then tell me in a few lines what ` +
  'is done and what is next, and go on with it.';

// A screenshot's picture in its Resources row: twice the row's (Resources.tsx), sharp on a Retina screen.
const THUMB_WIDTH = 128;

class Task {
  shell: Shell; project: Project; entry: TaskEntry; id: string; key: string; store: TaskStore;
  window: AppWindow | null; // the one whose tab it is (window.ts)
  loaded: boolean; terminalsLoaded: boolean;
  gitChecked: Promise<void>; // its project's repositories looked at as it loads (Project.checkGit), awaited by its agents
  _copying: Promise<unknown>; // its copies made one at a time (copying)
  terminals: Map<number, TaskTerminal>; terminalSeq: number; list: ProjectProfiles;
  profiles: ProjectProfiles['profiles']; closed: ProjectProfiles['closed'];
  front: number | null; lastAgent: number | null; // the terminals' tab in front; the agent's tab in front last
  resumedSession?: string | null;
  // project: its project (projects.ts); entry: its record in its tasks.json (store.ts, TaskEntry); one without a
  // worktree works in the project's folder. key: the task among all (store.ts, taskKey).
  // shell: the app (app.ts): store, proxy, mcp, sessionCookies, signin, uiZoom, bus, ask; the agents
  // (agentFor, findAgent, chooseAgent, plugin); and taskChanged(task, now, agentState), called after any change of its
  // profiles or its agent's state. Its window is the one whose tab it is (window.ts: add, drop; win, viewsHidden,
  // picking, send), none while it is closed; it changes when the task moves to another window (moveTo).
  constructor(shell: Shell, project: Project, entry: TaskEntry) {
    this.shell = shell; this.project = project; this.entry = entry; this.window = null;
    this.id = entry.id;
    this.key = taskKey(project, this.id);
    this.store = shell.store.taskOf(project, this.id);
    this.loaded = false; this.terminalsLoaded = false; this.gitChecked = Promise.resolve(); this._copying = Promise.resolve();
    this.terminals = new Map(); this.terminalSeq = 0; // its terminals, by id, in their tabs' order
    this.front = null; this.lastAgent = null;
    this.list = new ProjectProfiles(this.store, shell.profileStore, project.id, this._profileHooks());
    this.profiles = this.list.profiles; this.closed = this.list.closed;
  }
  arrangeStage(layout?: StageLayout, overflow?: boolean): Result {
    if (layout === undefined && overflow === undefined) return { error: 'choose a stage layout or set overflow' };
    if (layout !== undefined && !['column', 'tabs', 'row'].includes(layout)) return { error: 'unknown stage layout' };
    if (overflow !== undefined && typeof overflow !== 'boolean') return { error: 'overflow must be true or false' };
    if (!this.shown()) return { error: 'this task is not on screen; ask the human to show it before arranging its stage' };
    if (!this.profiles.size) return { error: 'open an environment before arranging the stage' };
    this.window!.send('stage:arrange', { task: this.key, layout, overflow });
    return {};
  }
  shown() { return this.window?.task === this; }
  // Into another window (app.ts, Move to New Window), running: its profiles' pages go there, hidden until that window
  // lays them out; its agents' output goes there (window: send).
  moveTo(w: AppWindow) { for (const p of this.profiles.values()) p.moveTo(w.win); }
  get name() { return this.entry.name; }
  // The name shown in the bar: the one it was given (task_rename / Rename…), or, until then, its first agent
  // conversation's name (the agent's own auto-title, noteAutoTitle), falling back to its stored name ("New Task").
  // Not entry.name, which a branch's slug is made from.
  get displayName() {
    if (this.entry.named) return this.entry.name;
    const first = this.agentTerminals()[0];
    return (first && this.conversationName(first)) || this.entry.name;
  }
  // Where its agent works: its first resource, its own worktree once it has one (ensureWorktree), else the project's
  // folder it opened in (the human's; a task without git stays there). It changes when the agent makes the worktree.
  get folder() { return folderOf(this.entry, this.project.folder); }
  get branch() { return branchOf(this.entry); }
  get worktrees() { return worktreesOf(this.entry); }
  // The task's own git worktree, made on demand (the agent's task_worktree), idempotent: created the first time (a
  // branch of its own, so the agent's work does not touch the human's folder), the same one after. Its running agents
  // are given the new folder (giveDirs), as an added repository is. name: the task's name when it is still unnamed, so
  // the agent names it and makes the worktree in one call; the branch takes a slug of the name. Its { folder, branch }.
  makeWorktree(name?: string) { return this.copying(() => this._makeWorktree(name)); }
  async _makeWorktree(name?: string): Promise<Result<{ folder: string; branch: string }>> {
    if (name && !this.entry.named) { const r = await this._rename(name); if (refused(r)) return r; }
    const had = !!ownWorktree(this.entry);
    const c = await this.project.ensureWorktree(this);
    if (refused(c)) return c;
    if (!had) {
      for (const t of this.agentTerminals()) if (t.pty) { (t.newDirs ??= []).push({ copy: c }); void this.giveDirs(t); }
      this.window?.sendProjects();
    }
    return { folder: c.folder, branch: c.branch };
  }
  // A new name, the agent's (task_rename) or the human's (Rename… on its tab): the name in the bar and its branch
  // of each of its copies (git branch -m; -2, -3 when another branch has it). Its folders stay: its agent may be
  // working there. One of the copying (copying): a branch renamed while a copy is being made would miss it.
  rename(name: string | undefined) { return this.copying(() => this._rename(name)); }
  async _rename(name: string | undefined): Promise<Result<{ name: string; branch: string | null }>> {
    name = name?.trim();
    const bad = labelError(name);
    if (bad) return { error: bad };
    const { entry } = this, copies = worktreesOf(entry);
    if (copies.length) {
      try { await renameBranch(copies, name!); } catch (e) { return { error: (e as GitError).stderr || (e as Error).message }; }
    }
    entry.name = name!;
    entry.named = true;
    this.project.save();
    this.window?.sendProjects();
    return { name: name!, branch: this.branch };
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
        profile.setBlank(shell.blankColor());
        profile.on('changed', () => shell.taskChanged(this));
        profile.on('zoom', () => this.list.save());
        installSigninPause(profile, shell.signin.isSigninUrl);
        return profile;
      },
      start: async (profile, tabs) => {
        await shell.sessionCookies.restore(profile); // before the first request of any tab
        // Real accounts: the master's non-local cookies, then kept in step with it and the other tasks (cookie-sync.ts).
        await shell.cookieSync.attach(profile.id, profile.session, this.project.entry.local || []);
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
        shell.cookieSync.detach(p.id, p.session);
        shell.proxy.removeProfile(p);
        await p.close();
      },
      // Its first open in this task: a copy of its master (sign-ins included, caches left out: store.ts), with the
      // master's tabs. Masters are not worked in, so nothing is open in one to flush.
      copy: async (e) => {
        await shell.flushMaster(e.cfg.id); // open to sign in to: what was done there is on disk
        await copyProfile(shell.profileStore.masterDir(e.cfg.id), e.cfg.dir);
        await shell.cookieSync.copy(e.cfg.id, session.fromPath(e.cfg.dir));
        e.tabs = this.store.tabs(e.cfg.id);
        this.store.saveTabs(e.cfg.id, e.tabs);
      },
      tabsOf: (p) => p.savedTabs((t) => this.urlOf(t)),
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
    return [...new Set(this.project.folders().filter((r) => !addable.includes(r)).map((r) => worktreesOf(this.entry).find((c) => c.repo === r)?.folder || r))]
      .filter((d) => d !== this.folder);
  }
  // The project's repositories in git it has no copy of yet; none while it works in a repository with no worktree of its
  // own yet (beside which they go). One working in a folder without git has none to make: its copies go on a branch of
  // their own (Project.addCopy).
  addable() {
    const copies = worktreesOf(this.entry);
    if (this.inGit()) return [];
    return this.project.folders().filter((r) => this.project.gits.get(r) === 'ok' && !copies.some((c) => c.repo === r));
  }
  // Working in a folder of the project that is in git (one it can have a worktree of), not yet in its own worktree.
  inGit() { return !ownWorktree(this.entry) && this.project.gits.get(this.folder) !== 'none'; }
  // Another of the project's repositories added to it, when its work turns out to need it (the human's Add Repository
  // on its tab, the agent's task_add_repository once the human agreed): a copy on its branch,
  // given to its running agents (giveDirs); at their next start they get it as the others (dirs). The copy's
  // { folder, branch }.
  addRepository(repo: string) { return this.copying(() => this._addRepository(repo)); }
  async _addRepository(repo: string): Promise<Result<{ folder: string; branch: string }>> {
    if (this.inGit()) return { error: 'the task has no worktree of its own yet to add a copy beside: make it with task_worktree first' };
    const found = this.project.folders().find((r) => r === repo || path.basename(r) === repo);
    if (!found) return { error: `${repo} is not one of the project's folders: ${this.project.folders().join(', ')}` };
    if (worktreesOf(this.entry).some((c) => c.repo === found)) return { error: `the task has ${found} already` };
    if (!this.addable().includes(found)) return { error: `${found} has no git commit to copy` };
    const c = await this.project.addCopy(this, found);
    if (refused(c)) return c;
    for (const t of this.agentTerminals()) if (t.pty) { (t.newDirs ??= []).push({ copy: c }); void this.giveDirs(t); }
    this.window?.sendProjects();
    return { folder: c.folder, branch: c.branch };
  }
  // Its copies made, and its branch renamed, one after another: two agents of the task calling task_worktree at once
  // get the one worktree (the second finds it made), not one each; a repository added meanwhile goes beside it; a
  // rename meanwhile renames the new copy's branch too.
  copying<T>(make: () => Promise<T>): Promise<T> {
    const done = this._copying.then(make);
    this._copying = done.catch(() => {});
    return done;
  }
  // One of them taken out again (the human's Remove Repository, the agent's task_remove_repository once the human
  // agreed), by its repository's folder or name, or its copy's folder: asked first when it holds
  // work not pushed (askRemoveCopy). Not its own folder, where its agents work: that goes with the task. Its running
  // agents told; one not told yet of it being added is told nothing. The copy's folder.
  async removeRepository(repo: string): Promise<Result<{ folder: string }>> {
    const c = worktreesOf(this.entry).find((x) => x.repo === repo || x.folder === repo || path.basename(x.repo) === repo);
    if (!c) return { error: `the task has no copy of ${repo}; its copies: ${worktreesOf(this.entry).map((x) => x.folder).join(', ') || 'none'}` };
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
  // Copies added to the task, sent to a running agent by Kulisa as the human would type them (a
  // typed /add-dir is a step easily missed). Never while it waits for the human: Enter answered
  // Claude Code's permission question with Yes, the pasted line lost. Claude Code's /add-dir goes into a
  // turn too: it runs at once, its question over the turn, which goes on; others get a line saying so once
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

  // Its terminals' panel (docs/window.md, The terminal): the terminals in tabs, one shown at a time. Each the user's shell in the
  // task's folder, with an agent started in it or not. A shell is for what keeps running where the human sees it (the
  // human's own, the agent's terminal_run: the app's dev server), rather than in the background of the agent's own
  // shell, which some agents cannot do and the human does not see. As in an IDE they are kept: when the task loads
  // again (a restart, its project opened again) each comes back in its tab, an agent's conversation resumed, a shell
  // with nothing running (the agent runs its command again). They go when closed (×, terminal_stop) or their shell exits.
  // A task that never had one opens its agent (none: nothing, the terminals' buttons instead); the last one closed leaves
  // the terminals folded to their + (terminals.json says so).
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
  // Ctrl+` on the folded terminals: the task's agent, a new conversation; { none } when it has none (the window then gives
  // the keyboard to the terminals' buttons or opens its +).
  async openOwn(): Promise<Result<{ id: number } | { none: true }>> {
    const own = this.ownAgent();
    return own === null ? { none: true } : this.openAgent(own);
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
  // An agent conversation's name: the one it was given (conversation_rename), else its own auto-title read from the
  // transcript (noteAutoTitle); null when it has neither.
  conversationName(t: TaskTerminal) {
    const c = this.conversations()[t.conversation!];
    return c?.title || c?.autoTitle || null;
  }
  // A tab's name: a shell's own; an agent's, its conversation's name, else its agent's, numbered when another agent's
  // tab has it too.
  label(t: TaskTerminal) {
    if (!t.agent) return t.name;
    const own = this.conversationName(t);
    if (own) return own;
    const same = this.agentTerminals().filter((x) => !this.conversationName(x) && x.agent!.cli === t.agent!.cli);
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
    const place = (agent: AgentChoice) => {
      const tab: TaskTerminal = { id: id = this.terminalId(id), key: `${this.key}#${id}`, name: '', command: '', by: 'human', agent, conversation, state: null, seen: true };
      this.terminals.set(tab.id, tab);
      if (front) this.show(tab.id); else { if (this.front === tab.id) this.lastAgent = tab.id; this.saveTerminals(); this.changedTerminals(); }
      return tab;
    };
    // Its tab at once, starting (terminalsInfo), while its program is looked for in the user's login shell: a task
    // opening showed the terminals' buttons for that second (docs/window.md, A tab comes before its program).
    let t = agent?.command ? place(agent) : null;
    let found = agent && await shell.findAgent(agent, this.folder);
    if (t && this.terminals.get(t.id) !== t) return { error: 'the terminal was closed' };
    if (!found) {
      const chosen = await shell.chooseAgent(this, agent);
      found = chosen && this.loaded ? await shell.findAgent(chosen, this.folder) : null;
      if (!found) {
        if (t) this.dropTerminal(t); // its tab goes: the terminals as they were before
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
      conversations.push({ agent: a.id, from: Date.now() });
      conversation = conversations.length - 1;
    }
    conversations[conversation]!.terminal = t.id;
    this.store.saveAgent({ ...list, conversations });
    Object.assign(t, { agent: a, conversation }); // the one chosen in its place, if another
    this.saveTerminals();
    this.changedTerminals();
    const saved = this.conversations()[conversation]!;
    const resume = (a.resume && a.resume(saved)) || null;
    this.resumedSession = resume ? saved.sessionId ?? null : null;
    const env = this.env(t), dirs = this.dirs(), more: { args?: string[]; env?: Record<string, string> } = (dirs.length && a.dirs?.(dirs)) || {};
    // Each copy trusted as the human trusted the project's code, in its folder or another task's copy (extendTrust).
    const where = { configDir: a.configDir, transcript: (this.project.agentData() as { transcript?: string }).transcript };
    const copies = this.shell.store.tasksOf(this.project.entry).list.flatMap(worktreesOf);
    for (const c of worktreesOf(this.entry)) {
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
      args: [...(resume || []), ...(a.args?.({ env, packages: shell.packages, account: Object.keys(a.env).length ? a.configDir : null, artifacts: shell.store.artifactsGlob() }) || []), ...(more.args || []), ...((!resume && first && a.prompt?.(first)) || [])] }, t.key);
    if (this.terminals.get(t.id) !== t) { stopTerminal(t.pty); return { error: 'the terminal was closed' }; }
    // Its shell exited by itself (exit), not stopped by Kulisa (closing, quitting: the terminal is kept then).
    t.pty.onExit(() => { if (!t.pty!.stopped) this.dropTerminal(t); });
    log.info(`[terminal] ${t.key} started ${shell.accounts.label(a.id)}${resume ? ' (resumed)' : ''}: ${command}`);
    this.changedTerminals(); // started
    this.updateConversation(conversation, { started: true });
    this.voiceShown();
    return { id: t.id };
  }
  // The same agent from nothing (New Conversation, or + with it): a new tab; the one before stays.
  newConversation(id: number) {
    const t = this.terminals.get(id);
    return t?.agent ? this.openAgent(t.agent.id) : Promise.resolve({ error: `no agent's terminal ${id}` });
  }
  // The task handed to an agent (the agent's icon on its tab, Change agent…): it opens in a new tab, told to go on with
  // that tab's conversation, which it reads in task_history while the window's dialog shows it (historyRead;
  // HandOver.tsx). In front from its start, under the dialog: a tab behind has no size, and its xterm laid out what the
  // agent drew for the terminals' size in 80 columns. The tab it came from stays: the human closes it.
  async handOver(id: number, account: string): Promise<Result<{ id: number }>> {
    const t = this.terminals.get(id);
    if (!t?.agent) return { error: `no agent's terminal ${id}` };
    const n = t.conversation! + 1, r = await this.openAgent(account, { first: HANDOVER(n, this.label(t)) });
    const handed = !refused(r) && this.terminals.get(r.id);
    if (handed) handed.handedFrom = n;
    return r;
  }
  // An agent read a part of a conversation in task_history: the one it was handed, shown as it goes (HandOver.tsx).
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
  // The agent's own auto-title for a conversation, read where its agent keeps it at session start and at a turn's end
  // (agent-hooks.ts): shown on its tab, and on the task's tab while the task is unnamed, until a name is given
  // explicitly. Best effort: never stored as the task's name, never a branch slug. True when it changed.
  async noteAutoTitle(t: TaskTerminal) {
    const n = t.conversation, c = n === undefined ? null : this.conversations()[n];
    if (!t.agent?.title || !c || c.title || !c.transcript) return false; // an explicit name wins; nothing to read yet
    let title: string | null = null;
    try { title = await t.agent.title({ transcript: c.transcript, sessionId: c.sessionId }); } catch (e) { console.warn('[agents] title:', (e as Error).message); }
    const now = this.conversations()[n!];
    if (!title || !now || now.title || title === now.autoTitle) return false;
    this.updateConversation(n!, { autoTitle: title });
    this.changedTerminals();
    this.window?.sendProjects();
    return true;
  }
  // At a turn's end: its auto-title read then, and again a few times after until it changes, since an agent may name
  // the session only once its turn is over (Codex: seconds after its Stop hook). Another turn's end starts over.
  followAutoTitle(t: TaskTerminal) {
    clearTimeout(t.titleTimer);
    const at = [0, 5000, 15000, 30000];
    const next = (i: number) => {
      t.titleTimer = setTimeout(async () => {
        if (this.terminals.get(t.id) !== t || await this.noteAutoTitle(t)) return;
        if (i + 1 < at.length) next(i + 1);
      }, at[i]! - (at[i - 1] ?? 0));
    };
    next(0);
  }

  // The tab in front, chosen by the human, or a new one they opened.
  show(id: number): Result<{ id: number }> {
    const t = this.terminals.get(id);
    if (!t) return { error: `no terminal ${id}` };
    this.front = id;
    if (t.agent) this.lastAgent = id;
    this.saveTerminals();
    this.see();
    this.changedTerminals();
    this.voiceShown();
    return { id };
  }
  // The terminals' tabs changed (opened, closed, in front, named, an agent's state): the window draws them, the task's tab
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
  pasteImage(id: number) {
    const t = this.terminals.get(id), key = t?.agent?.imagePaste;
    if (!key || !t?.pty || t.pty.stopped) return;
    log.info(`[terminal] ${t.key} clipboard image paste`);
    t.pty.write(key);
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
    log.info(`[terminal] ${t.key} gone`);
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
    this.voiceShown();
  }
  // The terminals' tabs, for the window.
  terminalsInfo(): Sent.Terminals {
    return { front: this.front, list: [...this.terminals.values()].map((t) => ({ id: t.id, name: this.label(t), command: t.command, by: t.by,
      agent: t.agent ? { account: t.agent.id, cli: t.agent.agentId, name: t.agent.name } : null, starting: !t.pty,
      state: t.state === 'done' && t.seen ? null : t.state })) };
  }

  // The agent in front, told to the dictation (src/dictation), which records for it; the human's only: the agent has
  // no use for a microphone. Its language is Kulisa's one (app.ts, setLanguage).
  voiceShown() {
    const t = this.shownAgent();
    this.shell.dictation.shown(this.key, t ? { id: t.key, name: t.agent!.cli, voice: t.agent!.voice, input: t.pty || null,
      type: (text) => { if (t.pty) typeIntoPrompt(t.pty, text); }, erase: (n) => { if (t.pty) eraseInPrompt(t.pty, n); } } : null);
  }
  // The dictation key (keys.ts, voice.hold), as the microphone button. Pressed with a shell in front, the agent the
  // prompt goes to comes to the front first: the key means "speak to the agent", wherever the keyboard is.
  holdKey(down: boolean) {
    if (down && !this.shell.dictation.recording(this.key)) {
      const t = this.promptTarget();
      if (t && this.front !== t.id) this.show(t.id);
    }
    this.shell.dictation.key(this.key, down);
  }

  // What its terminals get in their environment: where Kulisa's MCP server and hooks are for this task (the Kulisa
  // plugin reads them, other agent CLIs can too), and its name. An agent's terminal has URLs of its own (t), so its
  // hooks report its own state and it names its own tab.
  env(t?: TaskTerminal) {
    const base = `${this.shell.mcp.base}/task/${encodeURIComponent(this.project.id)}/${this.id}${t ? `/t/${t.id}` : ''}`;
    return { KULISA_MCP_URL: `${base}/mcp`, KULISA_URL: base, KULISA_TASK: this.name };
  }
  // Its terminals stopped (kept for when it loads again), its profiles saved and closed (its project closes, or the task
  // is deleted). Its tabs are saved first, as they are: closing them one by one changes the profiles, and nothing is
  // saved then.
  async unload() {
    this.shell.chooseAgent.cancel?.(this);
    this.shell.dictation.gone(this.key);
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

  // Profiles and their tabs: the one core the human (the window, ipc/) and the agent (kulisa-plugin/main/tools/) both act on.
  // Each side only translates (CLAUDE.md, Architecture): the checks, the questions and what an action does are here
  // and in Profile, so both get the same. A refusal is { error } saying why. Closed profiles stay closed across
  // restarts. A profile is its id here; the agent names it (named), and what is refused names it as the agent does.
  find(id: string): Found {
    const profile = this.profiles.get(id);
    if (profile) return { profile };
    const closed = this.closed.get(id);
    if (closed) return { error: `Profile "${closed.cfg.name}" is closed (it is still signed in): open it first.`, closed: true };
    return { error: `No profile "${id}"` };
  }
  named(name: string) { return this.list.named(name); }
  // A tab of an open profile; no tabId: its active tab.
  findTab(id: string, tabId?: string | null): Result<{ profile: Profile; tab: Tab }> {
    const r = this.find(id);
    if (refused(r)) return r;
    const tab = r.profile.get(tabId);
    return tab && (tab.discarded || !tab.wc.isDestroyed()) ? { profile: r.profile, tab } : { error: tabId ? `No tab ${tabId} in ${r.profile.name}` : `Profile "${r.profile.name}" has no tab` };
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
    await this.project.dropProfile(id);
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
    const pair = this.shell.profileStore.get(id)?.login;
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
    return p ? this.shell.openMaster(p.id) : r;
  }
  // A profile its project let go (projects.ts, dropProfile): its copy gone; a task not loaded loses it from its file.
  async dropProfile(id: string) { return this.loaded ? this.list.drop(id) : this.store.dropProfile(id); }

  info(): Sent.TaskInfo {
    const { id, key, displayName: name, tabState: state, folder } = this;
    return { id, key, project: this.project.id, name, state, folder, branch: this.branch, closed: !!this.entry.closed, merged: !!this.entry.merged,
      repos: this.addable(), resources: this.resources() };
  }
  // Its resources as the Resources panel (Resources.tsx) shows them: the first, where it works, is not removed there
  // (the main tree is the human's, its own worktree goes with the task); an added repository's worktree is
  // (task_remove_repository).
  resources(): Sent.TaskResource[] {
    return (this.entry.resources || []).map((r, i): Sent.TaskResource => (r.kind === 'maintree'
      ? { kind: r.kind, label: path.basename(r.folder), folder: r.folder, branch: null, removable: false }
      : { kind: r.kind, label: path.basename(r.repo), folder: r.folder, branch: r.branch, removable: i > 0 }));
  }

  async screenshot(profile: string, tab: string | undefined, shot: Parameters<Profile['screenshot']>[1]) {
    const r = this.findTab(profile, tab);
    if (refused(r)) throw new Error(r.error);
    const buf = await r.profile.screenshot(r.tab, shot);
    const file = await this.saveArtifact(r.profile.id, r.tab.id, `screenshot.${shot.type === 'jpeg' ? 'jpg' : 'png'}`, buf);
    const w = this.window;
    if (w && this.shown()) w.thumbnails.show(r.profile.id, file, buf, w.paneBox(r.profile.id));
    return { buf, file };
  }
  // Both handles keep page files here so their numbering, limit and Resources updates agree.
  async saveArtifact(profile: string, tab: string, kind: string, content: string | Buffer) {
    const file = await saveArtifact(this.store.artifacts, `${profile}-${tab}-${kind}`, content);
    this.artifactsChanged();
    return file;
  }
  async findArtifact(file: string) {
    const artifact = (await listArtifacts(this.store.artifacts)).find((a) => a.file === path.resolve(file));
    return artifact ? { artifact } : { error: `not an artifact of this task: ${file}` };
  }
  async sendArtifact(file: string): Promise<Result> {
    const r = await this.findArtifact(file);
    if (refused(r)) return r;
    if (!this.shown()) return { error: 'that task is not on screen' };
    const to = this.promptTarget();
    if (!to?.pty) return { error: 'Open an agent terminal to send it an artifact.' };
    this.typeForAgent(`${quotePaths(to.pty.shell, [r.artifact.file])} `);
    return {};
  }
  // The files kept of its pages (artifacts.ts), as the Resources panel lists them. A
  // screenshot's small picture is made here once and kept while the task is loaded: the window never decodes the
  // files themselves (a page's picture is megabytes once decoded, a hundred of them a lot of a window's memory).
  private thumbs = new Map<string, string>(); // '' where none could be made
  private makingThumbs = false;
  async artifacts(): Promise<Sent.Artifact[]> {
    const list = await listArtifacts(this.store.artifacts);
    for (const file of this.thumbs.keys()) if (!list.some((a) => a.file === file)) this.thumbs.delete(file);
    const missing = list.filter((a) => a.kind === 'screenshot' && !this.thumbs.has(a.file)).map((a) => a.file);
    if (missing.length) void this.makeThumbs(missing);
    return list.map((a) => ({ ...a, thumb: this.thumbs.get(a.file) || null }));
  }
  // One at a time, the main process free between them: a whole page's picture takes tens of milliseconds to decode,
  // and a task shown with many would hold up everything else (its terminals starting). The list goes again with them.
  private async makeThumbs(files: string[]) {
    if (this.makingThumbs) return; // the list sent when those are done makes the rest
    this.makingThumbs = true;
    for (const file of files) {
      await new Promise((r) => setImmediate(r));
      const image = nativeImage.createFromPath(file);
      this.thumbs.set(file, image.isEmpty() ? '' : `data:image/jpeg;base64,${image.resize({ width: THUMB_WIDTH }).toJPEG(80).toString('base64')}`);
    }
    this.makingThumbs = false;
    this.artifactsChanged();
  }
  // One made (or more gone past the limit, or deleted): the window showing the task lists them again.
  artifactsChanged() { void this.window?.sendArtifacts(this); }
  // What its artifacts take, or those of its project's tasks or of every task, loaded or not (the activity monitor,
  // src/activity-monitor): the Resources panel's figure, task_artifacts. Each task with its name and its project's.
  async artifactsUsage(scope: 'task' | 'project' | 'all' = 'task') {
    const r = await this.shell.activity.query({ metrics: ['artifacts'], ...(scope === 'task' ? { tasks: [this.key] } : scope === 'project' ? { projects: [this.project.id] } : {}) });
    const named = new Map(this.shell.store.allTasks().map((t) => [t.key, { name: this.shell.taskByKey(t.key)?.displayName ?? t.entry.name, project: t.project.name }]));
    return { bytes: r.total.artifacts ?? 0, tasks: r.tasks.map((t) => ({ key: t.key, ...named.get(t.key)!, bytes: t.metrics.artifacts?.bytes ?? 0 })) };
  }
  // Delete in a row's menu, Delete All, task_artifacts_delete (files null: all): only files of the task's own folder,
  // not any path the window or the agent names.
  async deleteArtifacts(files: string[] | null): Promise<Result<{ deleted: number; bytes: number }>> {
    const list = await listArtifacts(this.store.artifacts);
    const chosen = files ? files.map((f) => list.find((a) => a.file === path.resolve(f))) : list;
    const stranger = files?.find((_f, i) => !chosen[i]);
    if (stranger !== undefined) return { error: `not an artifact of this task: ${stranger}` };
    for (const a of chosen) await fs.promises.rm(a!.file, { force: true });
    if (chosen.some((a) => a!.file === this.window?.thumbnails.file)) this.window?.thumbnails.close();
    this.artifactsChanged();
    return { deleted: chosen.length, bytes: chosen.reduce((sum, a) => sum + a!.bytes, 0) };
  }
}

export type { TaskTerminal };
export { Task };
