// Kulisa, the app: its windows (window.ts) with their project tabs, the open projects, the agents, the CDP proxy and
// the MCP server, the windows' IPC (each message acts in the window it comes from), quitting. start(options) is used by
// the entry point (index.ts) and by the tests.
import { app, ipcMain, dialog, screen, nativeTheme, Menu, safeStorage, shell as electronShell } from 'electron';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { stepZoom } from './profiles.ts';
import { CdpProxy } from './cdp-proxy.ts';
import { Store, PROJECT_COLORS } from './store.ts';
import { Accounts } from './accounts.ts';
import { ProfileStore } from './profile-store.ts';
import { CookieSync } from './cookie-sync.ts';
import { nextAvatar } from './avatars.ts';
import { signinPages } from './signin-pages.ts';
import { SessionCookies } from './session-cookies.ts';
import { Project, askDeleteProject, deleteClosedTask, deleteProjectData, iconFile, iconOfFile, pictureOf, PICTURE_TYPES, addRepo, cloneRepo, defaultRepo, removeRepo, reposInfo, askDropProfile, dropProfile, agentsInfo, addAgent, defaultAgent, removeAgent, deleteAccount, deleteProfile, PROJECT_ICONS } from './projects.ts';
import { AppWindow, COLORS } from './window.ts';
import { repoOf, initRepo, clone } from './worktrees.ts';
import { findFavicon } from './favicons.ts';
import { AGENTS, findAgent, accountEmail, signOut, agentVersion, installLine, installAgent } from './agents/index.ts';
import { nameError, repoName } from './names.ts';
import { startTerminal, stopTerminal, forgetTerminal } from './terminal.ts';
import { keymap, match } from './keys.ts';
import { startMcpServer } from './mcp-server.ts';
import { installPicker } from './picker.ts';
import { installGhost } from './ghost.ts';
import { installMasters } from './master.ts';
import { refused } from './result.ts';
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';
import type { Shell, AgentChoice } from './shell.ts';
import type { Agent } from './agents/index.ts';
import type { ProjectEntry, WindowState } from './store.ts';
import type { Profile, Tab } from './profiles.ts';
import type { Task } from './tasks.ts';
import type { Pty } from './terminal.ts';
import type { GitError } from './worktrees.ts';
import type { Place } from './window.ts';
import type * as Sent from '../renderer/types.ts'; // what the window gets: its one definition
import type { Result } from './result.ts';

// What start takes (below).
interface Options {
  userData?: string; project?: string; projectsHome?: string; mcpPort?: number; signinHosts?: string[];
  appDevTools?: boolean; agents?: Agent[];
  agent?: { name?: string; command: string; args?: string[]; resume?: (sessionId: string) => string[]; shell?: Agent['shell']; voice?: Agent['voice']; conversation?: Agent['conversation'] };
}
type Event = IpcMainInvokeEvent | IpcMainEvent;
// The terminals' contents the window sends when a project moves (window.ts: sent to the window it goes to).
type Terminals = Record<string, string>;

// Electron shows a blocking modal dialog on an uncaught main-process exception, which also stops the proxy and
// the MCP server; log instead.
process.on('uncaughtException', (e) => console.error('[kulisa] uncaught', e));
process.on('unhandledRejection', (e) => console.error('[kulisa] unhandled rejection', e));

const NONE = new Map<string, never>(); // the tasks and profiles when no project is open

// Kulisa's packages for the agents (CLAUDE.md, Architecture, layer 3: Claude Code's plugin, claude-plugin/), each agent
// finding its own there (agents/). Outside the asar archive when packaged (forge.config.ts, extraResource), because the
// agents read them from disk.
const AGENT_PACKAGES = app.isPackaged ? process.resourcesPath : path.join(import.meta.dirname, '..', 'agent');

// options:
//   userData   folder for Kulisa's data and browser profiles
//   project    a project's folder to open (added to the first window's tabs and shown); default: the windows and tabs
//              open last, else none (the window offers to open one, as VS Code)
//   agent      { name, command, args, resume, shell } to run in every task that has not chosen one, without
//              asking (KULISA_AGENT, the tests); resume(sessionId) gives the arguments that continue a session.
//              Default: the human chooses from agents (agents/) per task, in the window.
//   agents     the agents to choose from, instead of agents/index.ts's (tests)
//   mcpPort    port of the MCP server (default 4450)
//   signinHosts  extra sign-in hosts (sign-in pause, tab restore)
function start(options: Options = {}) {
  // direnv's state from where Kulisa was started (a terminal in a folder direnv had loaded) is not Kulisa's: a task's
  // shell took the task's folder for that folder left and undid its .envrc's changes, an agent's account variable
  // with them (its CLAUDE_CONFIG_DIR gone: the agent ran with the user's own sign-in, 2026-10-11). Without it, direnv
  // in each terminal starts clean and loads the task's own .envrc; git and direnv run by Kulisa too.
  for (const k of Object.keys(process.env)) if (k.startsWith('DIRENV_')) delete process.env[k];
  const userData = options.userData || path.join(app.getPath('appData'), 'Kulisa');
  app.setPath('userData', userData);
  // One Kulisa per data folder (Electron's lock is the userData's; KULISA_DATA for another): a second one on the same
  // data ran beside the first, without its MCP server, and the two wrote over each other's saved tabs, cookies and
  // tasks (2026-10-12). It shows the first one's window and goes, before anything is read or written.
  if (!app.requestSingleInstanceLock()) {
    console.log(`[kulisa] already running with ${userData}: its window is shown`);
    app.quit();
    return new Promise<never>(() => {});
  }
  const store = new Store(userData);
  // The windows open at the start, each with its tabs and the one it shows: those open last (or KULISA_PROJECT's,
  // added to the first); one with none at first start.
  const saved = store.windows().filter((w, i) => i === 0 || w.tabs.length);
  if (!saved.length) saved.push({ tabs: [], shown: null });
  if (options.project) {
    const p = projectOfFolder(path.resolve(options.project));
    const w = saved.find((x) => x.tabs.some((t) => t.id === p.id)) || saved[0];
    if (!w.tabs.some((t) => t.id === p.id)) w.tabs.push(p);
    w.shown = p;
  }
  for (const w of saved) if (!w.tabs.some((t) => t.id === w.shown?.id)) w.shown = w.tabs[0] || null;
  const bus = new EventEmitter(); // profile-added, agent-command, agent-action
  // The app: the projects open in any window (projects.ts: Project, by id) and the windows (window.ts: AppWindow).
  // win, current, task, profiles, closed, pty are the first window's (the tests'): its shown project and task, that
  // task's open and closed profiles by id, its agent a pick goes to (Task.promptTarget).
  const shell = { bus, store, proxy: null, mcp: null, open: new Map(), windows: [], signin: signinPages(options.signinHosts || []) } as unknown as Shell;
  const first = () => shell.windows[0] ?? null;
  app.on('second-instance', () => first()?.focus());
  // The profiles and their masters (profile-store.ts); after who one is changed, or a project got or let go of one,
  // every loaded task shows it (project-profiles.ts, refresh), but the one it was changed in, which did.
  shell.profileStore = new ProfileStore(userData, (dir) => store.markDeleted(dir));
  // Real accounts signed in once, in every task: non-local cookies kept in step between masters and copies.
  shell.cookieSync = new CookieSync({ masterDir: (f) => shell.profileStore.masterDir(f), restore: (p) => shell.sessionCookies.restore(p) });
  // Test users' passwords, encrypted with the OS keyring (tasks.ts, setLogin); never kept in the clear.
  shell.secrets = {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (s: string) => safeStorage.encryptString(s).toString('base64'),
    decrypt: (b: string) => safeStorage.decryptString(Buffer.from(b, 'base64')),
  };
  // A test user's password as it is kept: encrypted, or why not; none given: the one kept stays (profile-store.ts).
  shell.loginSecret = (password) => {
    if (!password) return {};
    if (!shell.secrets.available()) return { error: 'this computer has no keyring to keep a password encrypted, so none is kept' };
    if (password.length > 500) return { error: 'a password is at most 500 characters' };
    return { secret: shell.secrets.encrypt(password) };
  };
  // Profiles whose test password is being typed (mcp-server.ts, browser_type_login): ghost.ts shows no text for them.
  shell.typingSecret = new Set<string>();
  shell.profilesChanged = (from) => {
    for (const p of shell.open.values()) for (const t of p.tasks.values()) if (t.loaded && t !== from) { t.list.refresh(); shell.taskChanged(t, true); }
  };
  // Where new projects go, and the folders of copies of tasks with several repositories (projects.ts).
  shell.projectsHome = options.projectsHome || path.join(app.getPath('home'), 'Kulisa');
  Object.defineProperties(shell, {
    win: { get: () => first()?.win ?? null },
    current: { get: () => first()?.current ?? null },
    task: { get: () => first()?.task ?? null },
    profiles: { get: () => first()?.profiles || NONE },
    closed: { get: () => first()?.closed || NONE },
    pty: { get: () => first()?.task?.pty || null },
    resumedSession: { get: () => first()?.task?.resumedSession ?? null },
  });
  // A task of an open project: by the project's id and its number (the MCP server's URLs), or by its key (the
  // windows', the CDP proxy's).
  shell.taskOf = (id, n) => shell.open.get(id)?.tasks.get(n) || null;
  shell.taskByKey = (key) => { for (const p of shell.open.values()) { const task = p.taskByKey(key); if (task) return task; } return null; };
  // The window a page's message comes from (IPC: event.sender).
  shell.windowOf = (sender) => shell.windows.find((w) => !w.win.isDestroyed() && w.win.webContents === sender) || null;
  const at = (e: Event) => shell.windowOf(e.sender);
  const appDevTools = options.appDevTools ?? !app.isPackaged;
  let quitting = false; // from before-quit on (below): closing a window asks nothing, tabs closing save nothing
  Object.defineProperty(shell, 'quitting', { get: () => quitting });
  // A task's profiles changed (now: right away), or its agent's state (tasks.ts): its window shows it. Not
  // once quitting: the tabs are saved then, and each one closing as Kulisa quits saved its task's tabs again,
  // fewer each time, at last none (one in the background at once: 2026-10-08, the author's tabs all about:blank).
  shell.taskChanged = (task, now, agentState) => quitting || task.project.window?.changed(task, now, agentState);
  // A project for a folder opened (KULISA_PROJECT, project:open with a folder): its site's favicon as its icon.
  function projectOfFolder(folder: string) { return store.projectFor(folder, undefined, { icon: 'favicon' }); }
  // A color, icon or agent the window sent for a project: one of those offered, or why not.
  const lookError = ({ color, icon, agent }: { color?: string; icon?: string; agent?: string }) => (color && !PROJECT_COLORS.includes(color) ? `no color ${color}`
    : icon && icon !== 'favicon' && !PROJECT_ICONS.includes(icon) ? `no icon ${icon}`
      : agent && !shell.agentFor(agent) ? `no agent ${agent}` : null);
  // The projects' icons as the windows show them: the picture of its favicon or of the file chosen (a file gone: its
  // favicon), each read once, again when its settings are opened (a favicon changed meanwhile). A favicon is looked for
  // without holding the window up: it comes when found.
  const favicons = new Map<string, string | null>(); // a project's id: its favicon's file
  const pictures = new Map<string, string | null>(); // a file: its picture
  const looking = new Set<string>();
  const lookForFavicon = async (p: ProjectEntry) => {
    looking.add(p.id);
    try {
      const file = await findFavicon(p.repos?.length ? p.repos : [p.folder]);
      favicons.set(p.id, file);
      if (file) pictures.delete(file);
    } finally { looking.delete(p.id); }
  };
  const picture = (file: string) => (pictures.has(file) ? pictures.get(file) : pictures.set(file, pictureOf(file)).get(file)) ?? null;
  const faviconPicture = (p: ProjectEntry) => {
    if (!favicons.has(p.id)) {
      if (!looking.has(p.id)) lookForFavicon(p).then(sendProjects, (err) => console.error('[favicon]', err));
      return null;
    }
    const file = favicons.get(p.id);
    return file ? picture(file) : null;
  };
  const iconPicture = (p: ProjectEntry) => {
    const file = iconFile(p);
    return (file && picture(file)) || (file || p.icon === 'favicon' ? faviconPicture(p) : null);
  };
  // And its tasks (the bar's + lists the closed ones): those open, as made, then the closed ones, the one closed last first.
  const tasksOf = (p: ProjectEntry) => {
    const list = store.tasksOf(p).list.map(({ n, name, branch, closed, closedAt, merged, about }) => ({ n, name, branch, closed: !!closed, closedAt, merged: !!merged, about }));
    return [...list.filter((t) => !t.closed), ...list.filter((t) => t.closed).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0))]
      .map(({ closedAt, ...t }) => t);
  };
  shell.projects = () => store.projects().map((p) => {
    const favicon = iconPicture(p);
    return { ...p, ...(favicon && { favicon }), tasks: tasksOf(p) };
  });
  // A question asked in a window (window.ts), the first one when none is named: askWhich gives the button clicked
  // ('ok', 'other') or null; ask whether it was ok. Through shell: the tests answer it.
  shell.askWhich = (q, w = first()) => w!.ask(q);
  shell.ask = async (q, w) => (await shell.askWhich(q, w)) === 'ok';
  shell.saveWindows = () => store.saveWindows(shell.windows.map((w) => w.saved()));
  // Every window's tabs and menus: which projects there are, where they are open, their agents (+'s menu).
  const sendProjects = shell.sendProjects = () => { for (const w of shell.windows) w.sendProjects(); };

  // The Kulisa zoom: the whole UI of every window (window.ts), and the profiles' pages, which follow it (profiles.ts).
  // The panes' boxes come in CSS pixels (window.ts, layout).
  shell.uiZoom = store.settings().uiZoom || 1;
  shell.setUiZoom = (z) => {
    shell.uiZoom = z;
    for (const w of shell.windows) w.setZoom(z);
    for (const p of allProfiles()) p.setBaseZoom(z);
    store.saveSettings({ ...store.settings(), uiZoom: z });
  };
  // The theme of Kulisa's own UI: 'dark' (the default, as JetBrains'), 'light', or 'system' (the OS's, followed as it
  // changes). Only the windows' UI, by CSS (tokens.css): nativeTheme.themeSource stays the OS's, so the profiles'
  // pages keep the OS's scheme, as without Kulisa, and a site under test looks as its users see it. shade(): 'dark'
  // or 'light', what is shown, for what CSS does not paint (the window's background, the OS buttons).
  shell.theme = store.settings().theme || 'dark';
  shell.shade = () => (shell.theme === 'system' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : shell.theme);
  shell.setTheme = (theme) => {
    if (theme) { shell.theme = theme; store.saveSettings({ ...store.settings(), theme }); }
    for (const w of shell.windows) w.setTheme(shell.theme, shell.shade());
  };
  nativeTheme.on('updated', () => { if (shell.theme === 'system') shell.setTheme(); });
  // Where the bar of the open projects and their tasks is: 'bottom' (the default: by the terminal, where the hand
  // goes anyway) or 'top' (under the title bar, as browsers' tabs), chosen in ☰.
  shell.bar = store.settings().bar || 'bottom';
  shell.setBar = (bar) => {
    shell.bar = bar; store.saveSettings({ ...store.settings(), bar });
    for (const w of shell.windows) w.send('bar', bar);
  };
  const allTasks = () => [...shell.open.values()].flatMap((p) => [...p.tasks.values()]);
  // Every open profile: the tasks' copies, and the masters open to sign in to (master.ts).
  const allProfiles = () => [...allTasks().flatMap((task) => [...task.profiles.values()]), ...[...(shell.masters?.values() || [])].map((m) => m.profile)];

  // ---------- windows, projects and tasks ----------
  // A project is a folder with its tasks (store.ts). Each window has a tab per project open in it, as a browser
  // has; it shows one, the others keep running (their agents and pages), until the human closes their tab. Each
  // task has its profiles, grid and agent (tasks.ts); a window shows one of its shown project's, the others
  // keep running. Showing another project or task hides this one's pages, and the window builds the next grid in
  // place (the page is not loaded again). A task loads (profiles, agent) the first time it is shown.
  // Opening, showing, creating, moving and closing run one after another, in all windows.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => T | Promise<T>): Promise<T> => { const r = queue.then(fn); queue = r.catch(() => {}); return r; };
  const newWindow = (place: Place) => { const w = new AppWindow(shell, place, { appDevTools }); shell.windows.push(w); return w; };
  const addProject = (p: ProjectEntry, w: AppWindow) => { const project = new Project(shell, p); shell.open.set(p.id, project); w.add(project); return project; };
  // A project is no thing to open (the author, 2026-10-11: it is what its tasks are made of: profiles, agents,
  // repositories); its tasks are. Its island in a window's bar is the group of its open tasks there, as Chrome's tab
  // group: it comes with the first one opened and goes with the last one closed. In code an open project (Project in
  // shell.open, a tab of its window) is that group.
  // Task n of project p shown (the bar's +), opened again if it was closed; none: a new task of it. In its group's
  // window, brought to the front; with no group yet, a new one at the end of window w's bar.
  async function openProject(p: ProjectEntry, w: AppWindow, n?: number | null): Promise<Result<{ n: number; key: string }>> {
    const had = shell.open.get(p.id), project = had || addProject(p, w);
    const task = n != null && project.tasks.get(n);
    if (project.window !== w) project.window!.focus();
    if (!task) {
      const r = await createTask(project);
      if (r.error && !had && !project.open().length) { await unload(project); sendProjects(); } // no group without a task
      return r;
    }
    if (task.entry.closed) project.reopen(task);
    await showTask(task);
    sendProjects();
    return { n: task.n, key: task.key };
  }
  // Closing groups, wherever it starts (Close Group, the middle button on a label, × on a group's last task, deleting a
  // project, a window's ×): one function, so one rule. The human is asked first in their window w, only when an agent
  // works (a window's ×: always; asked: already). Each group's tasks close as × on each would (projects.ts, closeAll:
  // agents stopped, profiles saved and closed, all kept to open again), its island goes; the one on screen goes last,
  // so the one next to it is shown, or none is left: an empty island in the grid's place, or the window closes when
  // there is another (as a browser's).
  async function closeProjects(w: AppWindow, projects: Project[], { asked = false, window = false } = {}): Promise<Result<{ ids: string[] }>> {
    if (!asked && !await askClosing(w, projects, { window })) return { error: 'the human said no' };
    for (const p of [...projects.filter((p) => p !== w.current), ...projects.filter((p) => p === w.current)]) {
      await w.leave(p);
      p.closeAll();
      await unload(p);
    }
    if (!w.tabs.length && shell.windows.length > 1) dropWindow(w);
    shell.saveWindows();
    sendProjects();
    return { ids: projects.map((p) => p.id) };
  }
  async function closeProject(project: Project | null | undefined, options?: { asked?: boolean }): Promise<Result<{ ids: string[] }>> {
    if (!project || !shell.open.has(project.id)) return { error: 'the project is not open' };
    return closeProjects(project.window!, [project], options);
  }
  // The question before closing groups (one: only when an agent works; a window's: window), saying which agents are
  // still working; or before quitting (quit), when the groups come back at the next start: asked only when that would
  // stop a working agent. True: go on.
  function askClosing(w: AppWindow | null, projects: Project[], { quit = false, window = false } = {}) {
    const working = projects.flatMap((p) => [...p.tasks.values()].filter((task) => task.working)
      .map((task) => (projects.length > 1 ? `${p.name}: ${task.name}` : task.name)));
    const busy = working.length ? `${working.length > 1 ? 'Agents are' : 'An agent is'} still working (${working.join(', ')}): ` : '';
    const it = working.length > 1 ? 'them' : 'it';
    if (quit) {
      return !working.length || shell.ask({ message: 'Quit Kulisa?', ok: 'Quit',
        detail: `${busy}quitting stops ${it}. The windows, their tasks and conversations come back at the next start.` }, w);
    }
    if (!window) {
      return !working.length || shell.ask({ message: `Close the group ${projects[0].name}?`, ok: 'Close',
        detail: `${busy}closing stops ${it}. Its tasks' conversations, code and profiles stay: open them again from the bar's +.` }, w);
    }
    return shell.ask({ message: 'Close the window?', ok: 'Close',
      detail: `Its tasks close: ${projects.map((p) => p.name).join(', ')}. ${busy ? `${busy}closing stops ${it}. ` : ''}`
        + 'Their conversations, code and profiles stay: open them again from the bar\'s +.' }, w);
  }
  // A group no longer: its agents stopped, its profiles closed, its island gone (not on screen any more).
  async function unload(project: Project) {
    await project.unload();
    shell.open.delete(project.id);
    project.window!.drop(project);
  }
  // A project into another window (to, its tab at index; none: a window of its own next to its window, or at the
  // point at), as a browser moves a tab; it keeps running: its agents, its pages (the same views, moved, not loaded
  // again), what its terminals showed (terminals: { task key: their contents }, from the window it leaves). The
  // only tab of a window goes to a new one never (nothing would change); into another window, its window closes after
  // it.
  async function moveProject(project: Project | undefined, terminals: Terminals = {}, to: AppWindow | null = null, { index, at }: { index?: number; at?: Electron.Point } = {}): Promise<Result<{ id: string }>> {
    const from = project?.window;
    if (!from) return { error: 'the project is not open' };
    if (to === from) return { id: project.id };
    if (!to && from.tabs.length < 2) return { error: 'the project is the only one in its window' };
    for (const task of project.tasks.values()) shell.chooseAgent.cancel(task); // none opens: the island's + there
    await from.leave(project);
    from.drop(project);
    const target = to || newWindow({ near: from.win, at });
    target.add(project, index);
    project!.moveTo(target);
    if (!from.tabs.length) dropWindow(from); // after its pages have left it
    target.send('terminals:restore', terminals); // before any more output (window.ts: sent once the page has loaded)
    if (to) {
      to.focus();
      await to.show(project!);
      shell.saveWindows();
      sendProjects();
    } else await showInNew(target, project!);
    return { id: project!.id };
  }
  async function showInNew(to: AppWindow, project: Project) {
    const loading = to.load(project.entry);
    await to.show(project);
    await loading;
    shell.saveWindows();
    sendProjects();
  }
  // A project's tab dragged and let go on window w's tabs (index: where): from w, it changes their order; from another
  // window, the project moves to w.
  function dropProject(project: Project | undefined, w: AppWindow | null, index: number, terminals: Terminals) {
    if (!project || !w) return { error: 'the project is not open' };
    if (project.window !== w) return moveProject(project, terminals, w, { index });
    w.reorder(project, index);
    return { id: project.id };
  }
  // A tab let go where no Kulisa window took it: outside them all, a new window there; on one (cancelled, or let go
  // elsewhere in a window), nothing.
  // The first start (no project yet: nothing to do in Kulisa without one): the projects' manager opens by itself on New
  // Project, over the empty window (Empty.vue).
  shell.firstStart = (w) => { if (!store.projects().length) w.send('project:new'); };
  shell.pointer = () => screen.getCursorScreenPoint(); // where the pointer is on the screen (the tests set it)
  async function dragOut(project: Project | undefined, terminals: Terminals): Promise<Result<{ id?: string }>> {
    const at = shell.pointer();
    return shell.windows.some((w) => w.contains(at)) ? { id: project?.id } : moveProject(project, terminals, null, { at });
  }
  // The OS's × of a window. The last one closes and Kulisa quits: its tabs open again at the next start (asked first
  // only when an agent works). Another one closes its projects, as closing their tabs would.
  shell.windowClosing = (w, e) => {
    if (quitting) return;
    e.preventDefault();
    serial(() => closeWindow(w)).catch((err) => console.error('[window]', err));
  };
  async function closeWindow(w: AppWindow) {
    if (!shell.windows.includes(w)) return;
    if (shell.windows.length > 1) return w.tabs.length ? closeProjects(w, [...w.tabs], { window: true }) : dropWindow(w);
    return quit(w);
  }
  // Quitting Kulisa (the last window's ×, ☰ → Exit): every window and project comes back at the next start, so it asks
  // only when an agent works; w: the window to ask in.
  async function quit(w: AppWindow | null) { if (await askClosing(w, [...shell.open.values()], { quit: true })) app.quit(); }
  function dropWindow(w: AppWindow) { shell.windows.splice(shell.windows.indexOf(w), 1); w.destroy(); }
  // A new task of a project (the bar's +, New Task: projects.ts), with its default agent, then shown. Without git it
  // would work in the folder another open task works in: the human is told first.
  async function createTask(project: Project | null | undefined): Promise<Result<{ n: number; key: string }>> {
    if (!project) return { error: 'the project is not open' };
    await project.checkGit();
    if (project.sharesFolder() && !await shell.ask({ message: `Another task of ${project.name} works in its folder`, ok: 'Create Anyway',
      detail: `Without git, tasks have no copies of their own: both agents would work in ${project.folder}, and may get in each other's way.` }, project.window)) {
      return { error: 'the human said no' };
    }
    const task = await project.createTask();
    if (refused(task)) return task;
    await showTask(task);
    return { n: task.n, key: task.key };
  }
  // A task of any open project shown: it becomes that project's, then the project is shown.
  async function showTask(task: Task) {
    const win = task.project.window!;
    await win.showTask(task);
    if (win.current !== task.project) await win.show(task.project);
  }
  // Before a task of a project leaves its bar (closed or deleted): the project shows the open task next to it.
  async function leaveTask(task: Task) {
    const project = task.project, open = project.open(), i = open.indexOf(task);
    if (project.task === task) await project.window!.showTask(open[i + 1] || open[i - 1]);
  }
  // × on a task's tab: its agent stops, its tabs close, all else stays (projects.ts, closeTask); asked first only when
  // its agent is working. The last open task closes its group, as Chrome's tab group goes with its last tab.
  async function closeTask(task: Task): Promise<Result<{ n: number } | { ids: string[] }>> {
    const project = task.project;
    if (task.working && !await shell.ask({ message: `Close the task ${task.name}?`, ok: 'Close',
      detail: 'Its agent is still working: closing stops it. Its conversation, code and profiles stay; open it again from the bar\'s +.' }, project.window)) {
      return { error: 'the human said no' };
    }
    if (project.open().length === 1) return closeProject(project, { asked: true });
    await leaveTask(task);
    await project.closeTask(task);
    project.window!.taskGone(task);
    project.checkMerged().then((found) => found && sendProjects()).catch(() => {});
    return { n: task.n };
  }
  // Delete in a task's menu (open or closed), after the human says yes: everything of it goes (projects.ts). The last
  // open one closes its project first.
  async function deleteTask(task: Task): Promise<Result<{ n: number }>> {
    const project = task.project;
    if (!await project.askDeleteTask(task)) return { error: 'the human said no' };
    if (!task.entry.closed && project.open().length === 1) {
      const r = await closeProject(project, { asked: true });
      if (refused(r)) return r;
    } else if (!task.entry.closed) await leaveTask(task);
    await project.deleteTask(task);
    project.window?.taskGone(task);
    if (!project.window) sendProjects();
    return { n: task.n };
  }
  // Delete Merged Tasks… (its group's menu): its closed tasks whose PR is merged, after one question naming them;
  // nothing of them is lost (projects.ts, checkMerged).
  async function deleteMerged(project: Project) {
    const list = project.closedTasks().filter((t) => t.entry.merged);
    if (!list.length) return { error: 'no closed task of it is merged' };
    if (!await shell.ask({ message: `Delete ${list.length === 1 ? `the task ${list[0].name}` : `${list.length} merged tasks`}?`, ok: 'Delete', danger: true,
      detail: `Merged on the remote, nothing uncommitted: ${list.map((t) => `${t.name} (${t.entry.branch})`).join(', ')}. Their folders, branches, profiles' copies and agents' conversations go.` }, project.window)) {
      return { error: 'the human said no' };
    }
    for (const t of list) await project.deleteTask(t);
    sendProjects();
    return { deleted: list.map((t) => t.n) };
  }
  // A closed task listed in its project's group menu, opened again: shown, its agent resumed.
  async function openTask(task: Task) {
    task.project.reopen(task);
    await showTask(task);
    return { n: task.n };
  }
  // Removing a project, from wherever a window asks for it (w): the human confirms, then it is closed if it is open,
  // and its data deleted (projects.ts).
  async function deleteProject(id: string, w: AppWindow | null) {
    const p = store.projects().find((x) => x.id === id);
    if (!p) return { error: `no project ${id}` };
    if (!await askDeleteProject(shell, p, shell.open.get(id)?.window || w)) return { error: 'the human said no' };
    if (shell.open.has(id)) await closeProject(shell.open.get(id), { asked: true });
    await deleteProjectData(shell, p);
    sendProjects();
    return { id };
  }
  ipcMain.handle('projects:list', (e) => at(e)?.info());
  // The switch runs on its own; the window hears about it through grid:closing, projects, tasks and state. No
  // question where (the author, 2026-10-11): a group of its own in this window, which Move to New Window takes away.
  const openLater = (p: ProjectEntry, w: AppWindow, n?: number) => {
    setImmediate(() => serial(() => (shell.windows.includes(w) ? openProject(p, w, n) : null)).catch((err) => console.error('[project:open]', err)));
    return w.info();
  };
  ipcMain.handle('project:open', (e, { id, folder, task }: { id?: string; folder?: string; task?: number }) => {
    const p = id ? store.projects().find((x) => x.id === id) : folder && fs.existsSync(folder) ? projectOfFolder(path.resolve(folder)) : null;
    return p ? openLater(p, at(e)!, task) : { error: 'no such project' };
  });
  // New Project…, as JetBrains': its code first (below), then a new or cloned one's folder <location>/<name>, the
  // location ~/Kulisa (every new project's place, as JetBrains' ~/PycharmProjects) unless the human picks another, so
  // they know where the agent's files are. git init when asked, with an empty first commit: tasks get copies of their
  // own (worktrees) from it. Made, not opened: the manager goes on to its configuration (its agents' accounts, its
  // code, its profiles), and New Task there makes its first task (the author, 2026-10-11: a question where to open it,
  // right after Create, came unasked).
  // agents: every account, the agents' own first; clis: the agents a new account can be made of (New Account…).
  const choices = () => {
    const all = shell.accounts.all().filter((a) => !a.agent.custom);
    return { colors: PROJECT_COLORS, icons: PROJECT_ICONS, agents: all.filter((a) => a.choosable).map(({ id, name }) => ({ id, name })),
      clis: all.filter((a) => a.own && a.agent.config?.login).map(({ id, name }) => ({ id, name })) };
  };
  ipcMain.handle('project:new-defaults', () => ({ location: shell.projectsHome, sep: path.sep,
    color: store.nextColor(), ...choices() }));
  // Browse…: where a new or cloned project's folder goes, or (existing) the folder that is the project.
  ipcMain.handle('project:pick-location', async (e, { location, existing }: { location?: string; existing?: boolean }) => {
    const r = await dialog.showOpenDialog(at(e)!.win, { title: existing ? "The project's folder" : 'Where to create the project', defaultPath: location,
      properties: existing ? ['openDirectory'] : ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0] || null;
  });
  // What a new project's folder is now (the New Project form says it as it is typed): not there, there (taken as it
  // is, its files kept), a repository (git init skipped), or a project's already (refused).
  const folderState = async (folder: string): Promise<{ state: string; project?: string }> => {
    if (!fs.existsSync(folder)) return { state: 'new' };
    if (!fs.statSync(folder).isDirectory()) return { state: 'file' };
    const of = store.projectOf(folder);
    if (of) return { state: 'project', project: of.name };
    return { state: (await repoOf(folder)) ? 'repo' : fs.readdirSync(folder).length ? 'files' : 'empty' };
  };
  const full = (f: string | undefined): string | null => {
    f = f?.trim().replace(/^~(?=$|[\\/])/, app.getPath('home'));
    return f && path.isAbsolute(f) ? path.normalize(f) : null;
  };
  // The code comes first (the author, 2026-10-11: a folder made in ~/Kulisa was in the way of code already on the
  // disk or at a URL), one repository or several (a frontend and a backend): from 'new', <location>/<name>; 'folder',
  // the folders given, nothing made, the first the project's; 'clone', one repository cloned into <location>/<name>,
  // several into <location>/<name>/<repo> each.
  const newFolder = ({ from, location, name, folder }: { from?: string; location?: string; name?: string; folder?: string }) => (from === 'folder' ? full(folder)
    : full(location) && name?.trim() ? path.join(full(location)!, name!.trim()) : null);
  ipcMain.handle('project:folder-state', async (_e, args: { from?: string; location?: string; name?: string; folder?: string }) => {
    const folder = newFolder(args);
    return folder ? { folder, ...await folderState(folder) } : null;
  });
  const refusal = (folder: string, there: { state: string; project?: string }) => ({ file: `${folder} is a file, not a folder`, project: `${folder} is the project ${there.project}'s already` } as Record<string, string>)[there.state];
  ipcMain.handle('project:new', async (_e, { from = 'new', name, location, folders = [], urls = [], git, color, icon }: { from?: string; name?: string; location?: string; folders?: string[]; urls?: string[]; git?: boolean; color?: string; icon?: string }) => {
    name = name?.trim();
    const bad = nameError(name) || lookError({ color, icon });
    if (bad) return { error: bad };
    let folder: string, repos: string[] | null = null;
    if (from === 'folder') {
      const given = [...new Set(folders.map((f) => full(f)))];
      if (!given.length || given.includes(null)) return { error: given.length ? 'each folder must be a full path' : 'no folder' };
      const states = await Promise.all(given.map((f) => folderState(f!)));
      for (const [i, f] of given.entries()) {
        if (states[i].state === 'new') return { error: `${f} is not there` };
        if (refusal(f!, states[i])) return { error: refusal(f!, states[i]) };
      }
      for (const [i, f] of given.entries()) {
        if (git && states[i].state !== 'repo') await initRepo(f!).catch((err: GitError) => console.error('[git]', err.stderr || err.message));
      }
      folder = given[0]!;
      if (given.length > 1) repos = given as string[];
    } else {
      const made = newFolder({ location, name });
      if (!made) return { error: 'the location must be the full path of a folder' };
      folder = made;
      const there = await folderState(folder);
      if (refusal(folder, there)) return { error: refusal(folder, there) };
      if (from === 'clone') {
        urls = [...new Set(urls.map((u) => u?.trim()).filter((u) => !!u))];
        if (!urls.length) return { error: 'no repository URL' };
        if (!['new', 'empty'].includes(there.state)) return { error: `${folder} is there already: choose another name or location` };
        const intos = urls.length === 1 ? [folder] : urls.map((u) => path.join(folder, repoName(u)));
        if (intos.includes(folder) && urls.length > 1 || new Set(intos).size < intos.length) return { error: 'two repositories of the same name' };
        fs.mkdirSync(urls.length === 1 ? path.dirname(folder) : folder, { recursive: true }); // git runs there
        for (const [i, u] of urls.entries()) {
          try { await clone(u, intos[i]); } catch (e) {
            const err = e as GitError;
            // None of it kept: a project with half its code would look made.
            for (const f of intos.slice(0, i + 1)) if (f !== folder || there.state === 'new') fs.rmSync(f, { recursive: true, force: true });
            if (there.state === 'new') fs.rmSync(folder, { recursive: true, force: true });
            return { error: `${u}: ${err.stderr || err.message}` };
          }
        }
        if (urls.length > 1) repos = intos;
      } else {
        fs.mkdirSync(folder, { recursive: true });
        if (git && there.state !== 'repo') await initRepo(folder).catch((err: GitError) => console.error('[git]', err.stderr || err.message));
      }
    }
    // Its icon is not asked: its site's favicon, as a folder opened.
    let entry = store.projectFor(folder, name, { color, icon: !icon || icon === 'logo' ? 'favicon' : icon });
    if (repos) entry = store.updateProject(entry.id, { repos })!;
    sendProjects(); // the bar's + lists it
    return { id: entry.id };
  });
  // A project's configuration in the projects' manager (ProjectEditor.vue): its name, color, icon, agents,
  // repositories, profiles and local addresses; its folder is shown, not changed (its tasks' copies are made from it).
  // Open or not.
  ipcMain.handle('project:settings-get', async (_e, { id }: { id: string }): Promise<Sent.ProjectSettings | { error: string }> => {
    const p = store.projects().find((x) => x.id === id);
    if (!p) return { error: `no project ${id}` };
    const r = await reposInfo(p);
    return { name: p.name, folder: p.folder, color: p.color, projectAgents: agentsInfo(shell, p), local: p.local || [],
      ...(await iconChoices(p)), ...r, ...profilesOf(id), ...choices() };
  });
  // Its icons to choose from with their pictures: its favicon looked for again and the file chosen read again (changed
  // meanwhile: the bar shows them too). One not there is not offered, and not shown chosen.
  const iconChoices = async (p: ProjectEntry) => {
    const file = iconFile(p);
    if (file) pictures.delete(file);
    await lookForFavicon(p);
    sendProjects();
    const pics: Record<string, string> = {};
    const favicon = faviconPicture(p), chosen = file && picture(file);
    if (favicon) pics.favicon = favicon;
    if (chosen) pics[p.icon!] = chosen;
    return { icon: pics[p.icon!] ? p.icon! : file && pics.favicon ? 'favicon' : file || p.icon === 'favicon' ? 'logo' : p.icon || 'logo', pictures: pics };
  };
  // Choose File…: a picture in the OS's dialog, in the project's folder, as its icon.
  ipcMain.handle('project:icon-file', async (e, { id }: { id: string }) => {
    const p = store.projects().find((x) => x.id === id);
    if (!p) return { error: `no project ${id}` };
    const r = await dialog.showOpenDialog(at(e)!.win, { title: "The project's icon", defaultPath: p.folder, properties: ['openFile'],
      filters: [{ name: 'Pictures', extensions: Object.keys(PICTURE_TYPES).map((x) => x.slice(1)) }] });
    const file = !r.canceled && r.filePaths[0];
    if (!file) return {};
    pictures.delete(file);
    if (!picture(file)) return { error: `Not a picture Kulisa can show: ${path.basename(file)} (SVG, ICO, WebP or GIF up to 128 KB, or PNG or JPEG)` };
    lookChanged(store.updateProject(id, { icon: iconOfFile(p, file) })!);
    return iconChoices(store.projects().find((x) => x.id === id)!);
  });
  // Its profiles (profile-store.ts): those it has, and those of other projects it can take. A new one comes closed in
  // its tasks (opened in a task, a copy of its master is made there); one let go asks first (projects.ts).
  const profilesOf = (id: string) => {
    const names = (ids: string[]) => ids.filter((x) => x !== id).map((x) => store.projects().find((p) => p.id === x)?.name || x);
    const view = (g: import('./profile-store.ts').StoredProfile) => ({ id: g.id, name: g.name, avatar: g.avatar, description: g.description || '', also: names(g.projects) });
    const all = shell.profileStore.all();
    return { profiles: all.filter((g) => g.projects.includes(id)).map(view), others: all.filter((g) => !g.projects.includes(id)).map(view) };
  };
  ipcMain.handle('project:profile-new', (_e, { id, name }: { id: string; name?: string }) => {
    name = name?.trim();
    const bad = nameError(name);
    if (bad) return { error: bad };
    shell.profileStore.create(id, { name: name!, avatar: nextAvatar(shell.profileStore.of(id).map((g) => g.avatar)) });
    shell.profilesChanged();
    return profilesOf(id);
  });
  ipcMain.handle('project:profile-add', (_e, { id, profile }: { id: string; profile: string }) => {
    const r = shell.profileStore.addTo(profile, id);
    if (refused(r)) return r;
    shell.profilesChanged();
    return profilesOf(id);
  });
  // The project open or not (projects.ts, dropProfile); asked in the manager's window.
  ipcMain.handle('project:profile-remove', (e, { id, profile }: { id: string; profile: string }) => serial(async () => {
    const entry = store.projects().find((x) => x.id === id), g = shell.profileStore.get(profile);
    if (!entry || !g) return { error: entry ? `no profile ${profile}` : `no project ${id}` };
    if (!await askDropProfile(shell, entry, g, 'human', at(e))) return { error: 'the human said no' };
    await dropProfile(shell, entry, g.folder);
    return profilesOf(id);
  }));
  // Its repositories or folders (projects.ts): one picked in the OS's dialog (or given: the tests), cloned from a URL,
  // made the default, removed. Each answers with the project's settings as they are then.
  const settingsOf = async (id: string, r: Result) => (refused(r) ? r : { ...(await reposInfo(store.projects().find((x) => x.id === id)!)) });
  ipcMain.handle('project:repo-add', async (e, { id, folder }: { id: string; folder?: string }) => {
    if (!folder) {
      const r = await dialog.showOpenDialog(at(e)!.win, { title: 'Add a repository or folder to the project', properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths[0]) return {};
      folder = r.filePaths[0];
    }
    return serial(async () => settingsOf(id, await addRepo(shell, id, folder!)));
  });
  ipcMain.handle('project:repo-clone', (_e, { id, url }: { id: string; url: string }) => serial(async () => settingsOf(id, await cloneRepo(shell, id, url))));
  ipcMain.handle('project:repo-default', (_e, { id, folder }: { id: string; folder: string }) => serial(async () => settingsOf(id, await defaultRepo(shell, id, folder))));
  ipcMain.handle('project:repo-remove', (_e, { id, folder }: { id: string; folder: string }) => serial(async () => settingsOf(id, await removeRepo(shell, id, folder))));
  // Its former folder (no git; tasks no longer work in it), in the OS's file manager: the human moves its files.
  ipcMain.handle('project:show-former', (_e, { id }: { id: string }) => { const p = store.projects().find((x) => x.id === id); return p && electronShell.openPath(p.folder); });
  // Its agents (projects.ts): one added, made the default (+ runs it), removed. At once, not on Save.
  ipcMain.handle('project:agent-add', (_e, { id, agent }: { id: string; agent: string }) => addAgent(shell, id, agent));
  ipcMain.handle('project:agent-default', (_e, { id, agent }: { id: string; agent: string | null }) => defaultAgent(shell, id, agent));
  ipcMain.handle('project:agent-remove', (_e, { id, agent }: { id: string; agent: string }) => removeAgent(shell, id, agent));
  // The accounts (Settings → Agents), each with the projects it is in; clis: the agents an account can be made of.
  const accountsInfo = (): Sent.AccountsInfo => {
    const names = new Map(store.projects().map((p) => [p.id, p.name]));
    return { accounts: shell.accounts.all().filter((a) => !a.own).map(({ id, agent, name, email, projects }) => ({ id, agent: agent.id, name, email: email ?? null,
      projects: projects!.map((p) => names.get(p)).filter((n) => n !== undefined) })),
    clis: shell.accounts.all().filter((a) => a.own && a.agent.config?.login).map((a) => a.id) };
  };
  ipcMain.handle('accounts:list', () => accountsInfo());
  // Settings → Profiles (profile-store.ts): every profile, each with the projects it is in; who one is changed (checked
  // in the store), then every loaded task shows it; made in no project; its master to sign in to; deleted after a
  // question (projects.ts, deleteProfile). Each answers with the list as it is then, or { error }.
  const profilesInfo = (): { profiles: Sent.SettingsProfile[] } => {
    const names = new Map(store.projects().map((p) => [p.id, p.name]));
    return { profiles: shell.profileStore.all().map((g) => ({ id: g.id, name: g.name, avatar: g.avatar, description: g.description || '',
      login: g.login?.user || '', hasPassword: !!g.login?.secret, projects: g.projects.map((p) => names.get(p)).filter((n) => n !== undefined) })) };
  };
  const profileChange = (r: Result<{ id: string }>) => { if (refused(r)) return r; shell.profilesChanged(); return { ...profilesInfo(), id: r.id }; };
  ipcMain.handle('profiles:list', () => profilesInfo());
  ipcMain.handle('profiles:new', (_e, { name }: { name: string }) => {
    const bad = shell.profileStore.check({ name });
    if (bad) return { error: bad };
    const g = shell.profileStore.create(null, { name: name.trim(), avatar: nextAvatar(shell.profileStore.all().map((x) => x.avatar)) });
    return { ...profilesInfo(), id: g.id };
  });
  ipcMain.handle('profiles:rename', (_e, { profile, name }: { profile: string; name: string }) => profileChange(shell.profileStore.rename(profile, name)));
  ipcMain.handle('profiles:describe', (_e, { profile, description }: { profile: string; description: string }) => profileChange(shell.profileStore.describe(profile, description)));
  ipcMain.handle('profiles:avatar', (_e, { profile, avatar }: { profile: string; avatar: string }) => profileChange(shell.profileStore.setAvatar(profile, avatar)));
  ipcMain.handle('profiles:login', (_e, { profile, user, password }: { profile: string; user?: string; password?: string }) => {
    const s = shell.loginSecret(password);
    return refused(s) ? s : profileChange(shell.profileStore.setLogin(profile, user, s.secret));
  });
  ipcMain.handle('profiles:master', (_e, { profile }: { profile: string }) => { const g = shell.profileStore.get(profile); return g ? shell.openMaster(g.folder) : { error: `no profile ${profile}` }; });
  ipcMain.handle('profiles:delete', (e, { profile }: { profile: string }) => serial(async () => { const r = await deleteProfile(shell, profile, at(e)); return r.ok ? profilesInfo() : r; }));
  // Delete Account… (projects.ts: refused while a task runs it, asked first). { accounts, clis } or { error }.
  ipcMain.handle('account:delete', (e, { id }: { id: string }) => serial(async () => {
    const r = await deleteAccount(shell, id, at(e));
    if (r.ok) shell.sendProjects(); // +'s right-click menu of the projects that had it
    return r.ok ? accountsInfo() : r;
  }));
  // A new account of an agent, made in Settings → Agents or in a project (tasks.md, Accounts): a folder of its own
  // (accounts.ts), then the agent's own sign-in in it, as /login, in a terminal of the window (key), which ends once signed
  // in; its status says the email it signed in to. Its page opens in the user's own browser, the agent's default: Google
  // refuses its sign-in in an embedded browser (2026-10-12, tasks.md, Accounts). An email stored already is that
  // account, added to the project. Not one change after another
  // (serial): a sign-in takes minutes. In a project (id): { agents } (the project's); in Settings → Agents (no id):
  // { accounts, clis }; or { error } (null: cancelled).
  const signins = shell.signins = new Map<string, Pty>(); // a sign-in terminal's key -> its pty
  const cancel = (key: string) => { const p = signins.get(key); signins.delete(key); if (p) stopTerminal(p); };
  ipcMain.handle('account:signin', async (e, { id, agent: agentId, key }: { id?: string; agent: string; key: string }) => {
    const w = at(e), own = shell.accounts.find(agentId);
    if (id && !store.projects().some((x) => x.id === id)) return { error: `no project ${id}` };
    const config = own?.agent.config;
    if (!own?.own || !config?.login) return { error: `${own?.name || agentId} has no accounts` };
    const found = await findAgent(own.agent, app.getPath('home'));
    if (!found?.path) return { error: `${own.name} is not installed: install it in ☰ → Agents…` };
    const r = shell.accounts.prepare(agentId);
    if (refused(r)) return r;
    const p = await startTerminal((channel, data) => w?.send(channel, data), { command: found.path, args: config.login(),
      cwd: app.getPath('home'), env: { [config.env]: r.dir }, shell: false,
      size: { cols: 100, rows: 8 } }, key); // its terminal is folded away, so no size would come
    signins.set(key, p);
    const code = await new Promise<number>((resolve) => p.onExit(({ exitCode }) => resolve(exitCode)));
    const cancelled = !signins.delete(key);
    forgetTerminal(key);
    const got = await accountEmail(own.agent, found, r.dir);
    // One it has already (the same email): that one; the new folder signed out and gone.
    const existing = got && shell.accounts.byEmail(agentId, got.email);
    if (cancelled || !got || existing) {
      if (got) await signOut(own.agent, found, r.dir);
      shell.accounts.remove(r.dir);
      if (existing) return id ? addAgent(shell, id, existing.id) : { error: `${existing.name} is an account already` };
      return { error: cancelled ? null : `Not signed in: ${own.name} ended with code ${code}.` };
    }
    shell.accounts.create(id, r.id, agentId, got.email);
    return id ? addAgent(shell, id, r.id) : accountsInfo();
  });
  ipcMain.handle('account:signin-cancel', (_e, { key }: { key: string }) => cancel(key));
  // Its name, color and icon (its group's panel too, TaskBar.vue: local not sent, kept as it is).
  ipcMain.handle('project:settings', (_e, { id, name, color, icon, local = store.projects().find((p) => p.id === id)?.local }: { id: string; name?: string; color?: string; icon?: string; local?: string[] }) => {
    name = name?.trim();
    // Its own local addresses (local.ts): hosts, each with its subdomains (a tunnel, its dev domains).
    local = [...new Set((local || []).map((h) => String(h).trim().toLowerCase().replace(/^\*\./, '')).filter(Boolean))];
    const was = store.projects().find((p) => p.id === id);
    // Its icon as it is (a file chosen) is no new choice to check.
    const bad = nameError(name) || lookError({ color, icon: icon === was?.icon ? undefined : icon }) || local.find((h) => !/^[a-z0-9.-]+$/.test(h) || !h.includes('.')) && `not a host name: ${local.find((h) => !/^[a-z0-9.-]+$/.test(h) || !h.includes('.'))}`;
    if (bad) return { error: bad };
    const entry = store.updateProject(id, { name: name!, color, icon: icon === 'logo' ? null : icon, local: local.length ? local : null });
    if (!entry) return { error: `no project ${id}` };
    lookChanged(entry);
    return { id };
  });
  // A project's look changed: its group and its window's title, the bars.
  function lookChanged(entry: ProjectEntry) {
    const open = shell.open.get(entry.id);
    if (open) {
      open.update(entry);
      if (open.window?.current === open) open.window.win.setTitle(`${entry.name} — Kulisa`);
    }
    sendProjects();
  }
  ipcMain.handle('project:close', (e, { id }: { id?: string } = {}) => serial(() => closeProject(id ? shell.open.get(id) : at(e)?.current)));
  // to: the id of the window it goes to (window.ts), none for a new one.
  ipcMain.handle('project:move', (_e, { id, to, terminals }: { id: string; to?: number; terminals: Terminals }) => serial(() => {
    const target = to ? shell.windows.find((w) => w.id === to) : null;
    return to && !target ? { error: 'that window is closed' } : moveProject(shell.open.get(id), terminals, target);
  }));
  // A project's tab dragged (projects.ts): let go on this window's tabs, or where no window took it.
  ipcMain.handle('project:drop', (e, { id, index, terminals }: { id: string; index: number; terminals: Terminals }) => serial(() => dropProject(shell.open.get(id), at(e), index, terminals)));
  ipcMain.handle('project:drag-out', (_e, { id, terminals }: { id: string; terminals: Terminals }) => serial(() => dragOut(shell.open.get(id), terminals)));
  ipcMain.handle('app:quit', (e) => serial(() => quit(at(e))));
  // Kulisa's data of an open project (its profiles, tasks), in the OS's file manager: for the human who wants to
  // know where it is or what takes the disk. Opened, not changed.
  ipcMain.handle('project:show-data', (_e, { id }: { id: string }) => {
    const p = shell.open.get(id);
    return p && electronShell.openPath(store.dirOf(p.entry));
  });
  ipcMain.handle('project:delete', (e, { id }: { id: string }) => serial(() => deleteProject(id, at(e))));
  // A task of another project too (the bar shows every open project's): it becomes that project's, then the
  // project is shown.
  const taskAt = <T>(key: string, fn: (task: Task) => T) => serial(() => { const task = shell.taskByKey(key); return task ? fn(task) : { error: `no task ${key}` }; });
  ipcMain.handle('task:show', (_e, key: string) => taskAt(key, showTask));
  ipcMain.handle('task:new', (e, { project }: { project?: string } = {}) => serial(() => createTask(project ? shell.open.get(project) : at(e)?.current)));
  ipcMain.handle('task:close', (_e, key: string) => taskAt(key, closeTask));
  ipcMain.handle('task:delete', (_e, key: string) => taskAt(key, deleteTask));
  // 🗑 on a closed task's row (the bar's +, its group's menu): its project's group need not be open.
  ipcMain.handle('task:delete-closed', (e, { project, n }: { project: string; n: number }) => serial(async () => {
    const open = shell.open.get(project)?.tasks.get(n);
    if (open) return open.entry.closed ? deleteTask(open) : { error: `task ${n} is open` };
    const p = store.projects().find((x) => x.id === project);
    if (!p) return { error: 'no such project' };
    const r = await deleteClosedTask(shell, p, n, at(e)!);
    if (!refused(r)) sendProjects();
    return r;
  }));
  ipcMain.handle('task:open', (_e, key: string) => taskAt(key, openTask));
  ipcMain.handle('task:rename', (_e, { key, name }: { key: string; name: string }) => taskAt(key, (task) => task.rename(name)));
  ipcMain.handle('project:delete-merged', (_e, { id }: { id: string }) => serial(() => { const p = shell.open.get(id); return p ? deleteMerged(p) : { error: 'the project is not open' }; }));
  ipcMain.handle('project:collapse', (_e, { id, collapsed }: { id: string; collapsed: boolean }) => { shell.open.get(id)?.collapse(collapsed); sendProjects(); });
  // The island's microphone and its language (Dictation.vue in the renderer; Task.voice, dictate).
  // Esc typed into an agent's terminal (its key: "<task>#<id>"): Task.interrupted.
  ipcMain.on('pty:in', (_e, { task, data }: { task: string; data: string }) => { if (data === '\x1b') shell.taskByKey(task.split('#')[0])?.interrupted(task); });
  ipcMain.handle('voice:get', (_e, key: string) => shell.taskByKey(key)?.voice() ?? null);
  ipcMain.handle('voice:record', (_e, { task, on }: { task: string; on: boolean }) => shell.taskByKey(task)?.dictate(on) ?? { recording: false });
  ipcMain.handle('voice:language', (_e, { task, code }: { task: string; code: string }) => shell.taskByKey(task)?.setVoiceLanguage(code) ?? { error: `no task ${task}` });
  ipcMain.handle('task:show-folder', (_e, key: string) => { const task = shell.taskByKey(key); return task && electronShell.openPath(task.folder); });
  ipcMain.handle('tasks:get', (e) => at(e)?.sendTasks());

  const ready = app.whenReady().then(async () => {
    // macOS keeps a menu bar for the app: Electron's default one would reload Kulisa's own page with ⌘R. Its own
    // menu: Quit, Hide (the app's), Copy and Paste (the Edit menu's roles: ⌘C, ⌘V in fields and the terminal), the
    // windows. Kulisa's keys are taken before it (onKey). Elsewhere the windows have no menu (window.ts).
    if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
    shell.sessionCookies = new SessionCookies();
    shell.proxy = new CdpProxy();
    await shell.proxy.listen(0);
    shell.proxy.on('command', (c: import('./cdp-proxy.ts').Command) => bus.emit('agent-command', c));
    const windows = saved.map((s: WindowState) => {
      const w = newWindow(s);
      for (const p of s.tabs) if (!shell.open.has(p.id)) addProject(p, w);
      return { w, shown: s.shown && shell.open.get(s.shown.id)?.window === w ? shell.open.get(s.shown.id)! : w.tabs[0] || null };
    });
    await windows[0].w.load(windows[0].shown?.entry ?? null);
    shell.mcp = await startMcpServer(shell, { port: options.mcpPort ?? 4450 });
    installPicker(shell);
    installGhost(shell);
    installMasters(shell, { preload: path.join(import.meta.dirname, '..', 'preload', 'index.cjs'), colors: () => COLORS[shell.shade()] });

    for (const [i, { w, shown }] of windows.entries()) {
      if (i) await w.load(shown?.entry ?? null);
      if (shown) await serial(() => w.show(shown));
      else { w.sendProjects(); w.sendTasks(); }
    }
    shell.firstStart(windows[0].w);
    shell.saveWindows();
    shell.stopAutosave = shell.sessionCookies.autosave(() => [...allProfiles(), ...shell.cookieSync.masters()]);
    shell.screenshot = async (file) => { await first()!.screenshot(file); };
    // KULISA_SHOT=<file.png>: save a screenshot of the window a few seconds after start (for checking UI changes).
    if (process.env.KULISA_SHOT) setTimeout(() => shell.screenshot(process.env.KULISA_SHOT!).catch((e: Error) => console.error('[shot]', e.message)), Number(process.env.KULISA_SHOT_DELAY || 4000));
    for (const { w } of windows) w.pushState();
    return shell;
  });

  // ---------- agents ----------
  // A task's agents are the human's choice, each in a terminal of its own (agents/; tasks.ts). One not chosen yet or
  // not installed: the window asks (AgentPicker.vue), installing it with its maker's installer if the human wants.
  // Every agent learns where Kulisa is from the environment, set per task (tasks.ts): its MCP server from KULISA_MCP_URL
  // (Claude Code's plugin's .mcp.json), its hooks from KULISA_URL.
  shell.packages = AGENT_PACKAGES;
  const own = options.agent;
  const custom: Agent | undefined = own && { id: 'custom', name: own.name || own.command, maker: '', needs: '', custom: true,
    command: own.command, shell: own.shell, args: () => own.args || [], voice: own.voice, conversation: own.conversation,
    resume: own.resume && (({ sessionId, transcript }) => sessionId && transcript && fs.existsSync(transcript) && own.resume!(sessionId)) };
  const known = [...(custom ? [custom] : []), ...(options.agents || AGENTS)];
  shell.agentFiles = [...new Set(known.flatMap((a) => a.localFiles || []))];
  // The agents with their accounts (accounts.ts); an account is its agent with its config folder in its environment.
  shell.accounts = new Accounts(userData, known, (dir) => store.markDeleted(dir));
  shell.accounts.clean();
  // An account the human deleted (projects.ts, deleteAccount): signed out with its agent's own command (what it keeps outside
  // its folder goes too: Claude Code's Keychain entry on macOS), then its folder.
  shell.dropAccount = async (a) => {
    await signOut(a.agent, await findAgent(a.agent, app.getPath('home')), a.dir!);
    shell.accounts.remove(a.dir!);
  };
  // An agent or account a task may run (any: also an agent itself that has accounts, as for installing it, or a task
  // that ran it before accounts were Kulisa's: its configDir the human's own folder).
  shell.agentFor = (id, { any = false } = {}) => {
    const a = shell.accounts.find(id ?? custom?.id);
    if (!a || (!a.choosable && !any)) return null;
    return { ...a.agent, id: a.id, agentId: a.agent.id, cli: a.agent.name, name: a.name, configDir: a.own ? a.agent.config?.home() ?? null : a.dir,
      env: a.own ? {} : { [a.agent.config!.env]: a.dir! } };
  };
  shell.findAgent = findAgent;
  const choosing = new Map<string, (agent: AgentChoice | null) => void>(); // task key -> resolve(agent or null)
  // Asked in the task's window; Cancel opens none.
  shell.chooseAgent = ((task: Task, agent: AgentChoice | null) => new Promise<AgentChoice | null>((resolve) => {
    choosing.get(task.key)?.(null);
    choosing.set(task.key, resolve);
    task.project.window?.send('agent:choose', { task: task.key, selected: agent?.id ?? null });
  })) as Shell['chooseAgent'];
  shell.chooseAgent.cancel = (task: Task) => { choosing.get(task.key)?.(null); choosing.delete(task.key); };
  ipcMain.on('agent:chosen', (_e, { task, id }: { task: string; id: string | null }) => { const r = choosing.get(task); choosing.delete(task); r?.(id ? shell.agentFor(id) : null); });
  // The agents to choose from; with check, whether each is installed (for the task's folder: its environment);
  // with details (the Agents window), also where it is and its version. Finding them runs the user's login shell and
  // each agent's --version, tenths of a second or more (the author, 2026-10-11: the list should come at once): with
  // cached, what the last look in this folder found, kept in memory, or { list: null } before the first; the window
  // shows it and looks again.
  const seen = new Map<string, { found: import('./agents/index.ts').Found | null; version?: string | null }>(); // `${agent id}\n${folder}` -> { found, version }
  const look = async (a: Agent, cwd: string, details?: boolean) => {
    const found = await findAgent(a, cwd), old = seen.get(`${a.id}\n${cwd}`);
    const s = { found, version: details ? await agentVersion(found) : old?.version };
    seen.set(`${a.id}\n${cwd}`, s);
    return s;
  };
  ipcMain.handle('agents:list', async (e, { check, details, cached }: { check?: boolean; details?: boolean; cached?: boolean } = {}) => {
    const w = at(e), looks = new Map<string, ReturnType<typeof look>>(), cwd = w?.task?.folder || app.getPath('home'); // each agent looked for once, whatever its accounts
    // The project's agents first (Choose the Agent), in its order.
    const mine = w?.current?.agents() || [], rank = (id: string) => (mine.includes(id) ? mine.indexOf(id) : mine.length);
    // Choosing a task's: the project's accounts, and the agents without accounts (the terminal only); never another
    // project's account: it could go with that project while a task here runs it. The Agents window: the agents alone,
    // not the terminal only: nothing of it to set up there (the author, 2026-10-11).
    const accounts = shell.accounts.all().filter((a) => (details ? a.own && a.agent.command : a.choosable && (a.own || mine.includes(a.id))))
      .sort((x, y) => rank(x.id) - rank(y.id)); // stable: the others as they were
    const of = (a: Agent) => {
      if (cached) return seen.get(`${a.id}\n${cwd}`);
      if (!looks.has(a.id)) looks.set(a.id, look(a, cwd, details));
      return looks.get(a.id);
    };
    if (cached && (check || details) && accounts.some(({ agent: a }) => !of(a) || (details && (of(a) as { version?: string | null }).version === undefined))) return { list: null };
    const list = await Promise.all(accounts.map(async ({ id, agent: a, name, dir, own }) => {
      const f = check || details ? (await of(a))!.found : null;
      return {
        id, agent: a.id, name, maker: a.maker, needs: a.needs, site: a.site, install: installLine(a),
        account: own ? null : dir,
        ...((check || details) && { installed: !!f }),
        ...(details && { path: f?.path ?? null, onPath: f?.onPath ?? null, version: (await of(a))!.version }),
      };
    }));
    return { list, home: app.getPath('home') };
  });
  // The maker's installer, run when the human clicks Install (that is their go-ahead); its output goes to the window.
  ipcMain.handle('agents:install', async (e, { id }: { id: string }) => {
    const w = at(e), a = shell.agentFor(id, { any: true });
    if (!a?.install) return { error: `nothing to install for ${id}` };
    const code = await installAgent(a, (data) => w?.send('agents:install-log', data));
    return { code, installed: !!(await look(a, w?.task?.folder || app.getPath('home'), true)).found };
  });

  // A window's handles on the profiles of its shown task (the editor, the panes): each only translates to the
  // task's own (tasks.ts), the same the agent's tools use (mcp-server.ts). A refusal answers { error }.
  // Each names its task (renderer, tasks.ts: act): one sent just as the human switches tasks or
  // projects is refused, not done in the task shown by then.
  const noTask = { error: 'that task is not on screen' };
  const onScreen = (e: Event, key: string) => { const task = at(e)?.task; return task && task.key === key ? task : null; };
  type Args = Record<string, any>; // what a window's message about a profile or a tab carries besides naming it
  const onProfile = (fn: (p: Profile, args: Args) => unknown) => (e: IpcMainInvokeEvent, { task, profile, ...args }: Args) => { const r = onScreen(e, task)?.find(profile) || noTask; return refused(r) ? r : fn(r.profile!, args); };
  const onTab = (fn: (p: Profile, t: Tab, args: Args) => unknown) => (e: IpcMainInvokeEvent, { task, profile, tab, ...args }: Args) => { const r = onScreen(e, task)?.findTab(profile, tab) || noTask; return refused(r) ? r : fn(r.profile, r.tab, args); };
  ipcMain.handle('profile:close', (e, { task, profile }: { task: string; profile: string }) => onScreen(e, task)?.closeProfile(profile) || noTask);
  ipcMain.handle('profile:open', (e, { task, profile }: { task: string; profile: string }) => onScreen(e, task)?.openProfile(profile) || noTask);
  // Let go by the task's project (projects.ts, askDropProfile): Remove from Project… in its pane's menu.
  ipcMain.handle('profile:delete', (e, { task, profile }: { task: string; profile: string }) => onScreen(e, task)?.deleteProfile(profile, 'human') || noTask);
  ipcMain.handle('views:hidden', (e, hidden: boolean, opts?: { snapshots?: boolean }) => at(e)?.hideViews(hidden, opts));
  ipcMain.on('ask:answer', (e, { id, answer }: { id: number; answer: string }) => at(e)?.answer(id, answer));
  ipcMain.handle('layout:load', (e, { task }: { task: string }) => onScreen(e, task)?.store.layout());
  // A profile's master, to sign in to (master.ts), and its cookies brought to this task's copy (tasks.ts).
  ipcMain.handle('profile:master', (e, { task, profile }: { task: string; profile: string }) => onScreen(e, task)?.openMaster(profile) || noTask);
  ipcMain.handle('profile:refresh', (e, { task, profile }: { task: string; profile: string }) => onScreen(e, task)?.refreshProfile(profile) || noTask);
  // The island's tabs (Terminals.vue): + (an agent of the project, a new conversation; or a shell; own: the task's own
  // agent, Ctrl+` on the folded island), the one in front,
  // ×, an agent's tab handed over to another agent (Task.handOver).
  ipcMain.handle('terminal:open', (e, { task, agent, own }: { task: string; agent?: string; own?: boolean }) => {
    const w = onScreen(e, task);
    return !w ? noTask : own ? w.openOwn() : agent ? w.openAgent(agent) : w.openTerminal();
  });
  ipcMain.handle('terminal:show', (e, { task, id }: { task: string; id: number }) => onScreen(e, task)?.show(id) || noTask);
  ipcMain.handle('terminal:close', (e, { task, id }: { task: string; id: number }) => onScreen(e, task)?.closeTab(id) || noTask);
  ipcMain.handle('agent:new-conversation', (e, { task, id }: { task: string; id: number }) => onScreen(e, task)?.newConversation(id) || noTask);
  ipcMain.handle('agent:hand-over', (e, { task, id, agent }: { task: string; id: number; agent: string }) => onScreen(e, task)?.handOver(id, agent) || noTask);
  ipcMain.on('layout:save', (e, { task, layout }: { task: string; layout: unknown }) => at(e)?.saveLayout(task, layout));
  ipcMain.on('layout', (e, { task, rects }: { task: string; rects: Parameters<AppWindow['layout']>[1] }) => at(e)?.layout(task, rects));

  // A tab the human opens (+): the window keeps the keys for its address (ProfilePane.vue). Its page, a native view, takes
  // them as it loads (when, varies), so they go back each time, until the human clicks the page or it goes somewhere.
  ipcMain.handle('tab:new', onProfile((p, { url }) => {
    const tab = p.newTab(url || 'about:blank');
    const wc = tab.wc;
    const back = () => { if (!p.win.isDestroyed()) p.win.webContents.focus(); };
    const clicked = (_e: Electron.Event, i: Electron.MouseInputEvent) => { if (i.type === 'mouseDown') off(); };
    const went = (_e: Electron.Event, u: string, _inPage: boolean, mainFrame: boolean) => { if (mainFrame && u !== 'about:blank') off(); };
    const off = () => { if (wc.isDestroyed()) return; wc.off('focus', back); wc.off('before-mouse-event', clicked); wc.off('did-start-navigation', went); };
    wc.on('focus', back); wc.on('before-mouse-event', clicked); wc.on('did-start-navigation', went as never);
    tab.ready!.then(back);
    return tab.id;
  }));
  // focus: the keyboard was in the tab's page (a key closed or switched it): it goes to the page shown next, as in Chrome.
  ipcMain.handle('tab:close', onTab((p, t, { focus }) => {
    if (focus) p.once('tab-closed', () => setImmediate(() => p.get()?.wc.focus()));
    p.closeTab(t.id);
  }));
  ipcMain.handle('tab:activate', onTab((p, t, { focus }) => { p.activate(t.id); if (focus) t.wc.focus(); }));
  ipcMain.handle('tab:focus', onTab((_p, t) => t.wc.focus()));
  ipcMain.handle('tab:reopen', onProfile((p) => p.reopenTab()?.id ?? null));
  ipcMain.handle('tab:navigate', onTab((p, t, { url }) => p.navigate(t.id, url)));
  ipcMain.handle('tab:back', onTab((p, t) => p.back(t.id)));
  ipcMain.handle('tab:forward', onTab((p, t) => p.forward(t.id)));
  ipcMain.handle('tab:reload', onTab((p, t, { ignoreCache }) => p.reload(t.id, { ignoreCache })));
  ipcMain.handle('tab:dialog', onTab((p, t, { dialog, ok }) => p.answerDialog(t.id, dialog, ok)));
  ipcMain.handle('tab:devtools', onTab((p, t) => p.toggleDevTools(t.id)));
  ipcMain.handle('zoom:get', () => shell.uiZoom);
  ipcMain.handle('theme:set', (_e, theme: Shell['theme']) => ['dark', 'light', 'system'].includes(theme) && shell.setTheme(theme));
  ipcMain.handle('bar:set', (_e, bar: Shell['bar']) => ['top', 'bottom'].includes(bar) && shell.setBar(bar));
  ipcMain.handle('zoom:ui', (_e, dir: number) => shell.setUiZoom(stepZoom(shell.uiZoom, dir)));
  ipcMain.handle('tab:zoom', onTab((p, t, { dir }) => p.zoomSite(t.id, dir)));

  // ---------- keyboard shortcuts (keys.ts) ----------
  // Every key typed in the window or in a profile's page comes here first (before-input-event), before the page
  // gets it: one of Kulisa's is taken (the page never sees it) and done, here or by the window; any other goes on
  // to the page, the terminal's agent or the site.
  const table = keymap();
  const ZOOM: Record<string, number> = { 'zoom.in': 1, 'zoom.out': -1, 'zoom.reset': 0, 'site.zoomIn': 1, 'site.zoomOut': -1, 'site.zoomReset': 0 };
  // A profile's tab by its webContents, of a task shown in a window.
  const tabOf = (wc: WebContents) => {
    for (const w of shell.windows) for (const profile of w.profiles.values()) {
      const tab = profile.tabs.find((t) => t.wc === wc);
      if (tab) return { w, profile, tab };
    }
    return null;
  };
  function onKey(wc: WebContents, e: Electron.Event, input: Electron.Input) {
    if (input.type !== 'keyDown') return;
    const w = shell.windowOf(wc), t = !w && tabOf(wc);
    if (!w && !t) return; // DevTools, a tab of a task not on screen
    const zone = w ? w.keyZone : 'page';
    const pane = zone.startsWith('pane:') ? zone.slice('pane:'.length) : null;
    // The nearest group first: in a page, the page's keys (its zoom, its DevTools); in the window, Kulisa's.
    const hit = match(table, input, zone === 'page' ? ['page', 'global'] : pane ? ['global', 'page'] : ['global'], { always: zone === 'dialog' });
    if (!hit || (hit.id === 'devtools.app' && !appDevTools)) return;
    e.preventDefault();
    const win = w || (t as { w: AppWindow }).w;
    if (hit.id in ZOOM) return hit.id.startsWith('zoom.') ? shell.setUiZoom(stepZoom(shell.uiZoom, ZOOM[hit.id])) : t && t.profile.zoomSite(t.tab.id, ZOOM[hit.id]);
    if (hit.id === 'devtools.app') return win.toggleDevTools();
    if (hit.id === 'devtools.tab') return t && t.profile.toggleDevTools(t.tab.id);
    if (hit.window) win.win.webContents.focus();
    win.send('command', { id: hit.id, n: hit.n, profile: t ? t.profile.id : pane, tab: t ? t.tab.id : null, task: win.task?.key ?? null, page: !!t });
  }
  app.on('web-contents-created', (_e, wc) => wc.on('before-input-event', (e, input) => onKey(wc, e, input)));
  ipcMain.on('keys:zone', (e, zone: string) => { const w = at(e); if (w) w.keyZone = String(zone); });

  // Save session cookies and flush persistent ones before quitting, so sign-ins survive a restart; the windows and
  // their tabs open again at the next start.
  app.on('before-quit', async (e) => {
    if (quitting) return;
    e.preventDefault(); quitting = true;
    for (const w of shell.windows) w.pushState();
    for (const task of allTasks()) if (task !== task.project.window?.task && task.loaded) task.list.saveTabs();
    shell.saveWindows();
    shell.stopAutosave?.();
    for (const folder of [...(shell.masters?.keys() || [])]) await shell.closeMaster(folder); // their tabs and sign-ins saved
    for (const m of shell.cookieSync.masters()) await shell.sessionCookies?.persist(m); // kept in step, not open in a window
    for (const p of allProfiles()) {
      await shell.sessionCookies?.persist(p);
      await p.disconnect();
    }
    for (const task of allTasks()) for (const t of task.terminals.values()) if (t.pty) stopTerminal(t.pty);
    app.quit();
  });
  process.on('SIGINT', () => app.quit());
  process.on('SIGTERM', () => app.quit());
  app.on('window-all-closed', () => app.quit());
  return ready;
}

export { start, AGENT_PACKAGES };
