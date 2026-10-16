// Kulisa, the app: the shell every module gets (shell.ts) put together, its windows with their open tasks
// (open-tasks.ts), the agents, the CDP proxy and the MCP server, the windows' handles (ipc/), quitting. start(options)
// is used by the entry point (index.ts) and by the tests.
import { app, nativeTheme, Menu, safeStorage } from 'electron';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { CdpProxy } from './cdp-proxy.ts';
import { Store } from './store.ts';
import { Accounts } from './accounts.ts';
import { ProfileStore } from './profile-store.ts';
import { CookieSync } from './cookie-sync.ts';
import { signinPages } from './signin-pages.ts';
import { SessionCookies } from './session-cookies.ts';
import { pictureOf } from './projects.ts';
import { COLORS } from './window.ts';
import { findFavicon } from './favicons.ts';
import { AGENTS, findAgent, signOut } from './agents/index.ts';
import { stopTerminal } from './terminal.ts';
import { startMcpServer } from './mcp-server.ts';
import { installPicker } from './picker.ts';
import { installGhost } from './ghost.ts';
import { startDiscarding } from './discard.ts';
import { installMasters } from './master.ts';
import { installSettings } from './settings-window.ts';
import { openTasks } from './open-tasks.ts';
import { installShortcuts } from './shortcuts.ts';
import { registerTasks } from './ipc/tasks.ts';
import { registerProjects } from './ipc/projects.ts';
import { registerProfiles } from './ipc/profiles.ts';
import { registerAgents } from './ipc/agents.ts';
import { registerPanes } from './ipc/panes.ts';
import { registerWindow } from './ipc/window.ts';
import type { Ipc, IpcEvent } from './ipc.ts';
import type { Shell } from './shell.ts';
import type { Agent } from './agents/index.ts';
import type { ProjectEntry } from './store.ts';

// What start takes (below).
interface Options {
  userData?: string; project?: string; projectsHome?: string; mcpPort?: number; signinHosts?: string[];
  appDevTools?: boolean; agents?: Agent[];
  agent?: { name?: string; command: string; args?: string[]; resume?: (sessionId: string) => string[]; shell?: Agent['shell']; voice?: Agent['voice']; conversation?: Agent['conversation'] };
}

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
  // The windows open at the start, each with its tasks' tabs and the one it shows: those open last (KULISA_PROJECT's
  // task in the first: ready, below); one with none at first start.
  const saved = store.windows().filter((w, i) => i === 0 || w.tabs.length);
  if (!saved.length) saved.push({ tabs: [], shown: null });
  const bus = new EventEmitter(); // profile-added, agent-command, agent-action
  // The app: the loaded projects (projects.ts: Project, by id: those with a task open in any window) and the windows
  // (window.ts: AppWindow). win, current, task, profiles, closed, pty are the first window's (the tests'): its shown
  // task's project, that task, its open and closed profiles by id, its agent a pick goes to (Task.promptTarget).
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
    current: { get: () => first()?.task?.project ?? null },
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
  const at = (e: IpcEvent) => shell.windowOf(e.sender);
  // The tasks' window a message is about: its own, or Settings' parent (settings-window.ts): its shown task's project
  // and folder.
  const owner = (e: IpcEvent) => at(e) ?? (shell.settings && shell.settings.win.webContents === e.sender ? shell.settings.parent : null);
  const appDevTools = options.appDevTools ?? !app.isPackaged;
  let quitting = false; // from before-quit on (below): closing a window asks nothing, tabs closing save nothing
  Object.defineProperty(shell, 'quitting', { get: () => quitting });
  // A task's profiles changed (now: right away), or its agent's state (tasks.ts): its window shows it. Not
  // once quitting: the tabs are saved then, and each one closing as Kulisa quits saved its task's tabs again,
  // fewer each time, at last none (one in the background at once: 2026-10-08, the author's tabs all about:blank).
  shell.taskChanged = (task, now, agentState) => quitting || task.window?.changed(task, now, agentState);
  // A project for a folder opened (KULISA_PROJECT, project:open with a folder).
  function projectOfFolder(folder: string) { return store.projectFor(folder); }
  // The projects' icons as the windows show them (docs/tasks.md, Projects: nothing to choose): the picture of its
  // site's favicon, read once, again when its settings are opened (a favicon changed meanwhile). A favicon is looked for
  // without holding the window up: it comes when found. The window takes its color from it (lib/project-color.ts).
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
  // And its tasks (the bar's + lists the closed ones): those open, as made, then the closed ones, the one closed last first.
  const tasksOf = (p: ProjectEntry) => {
    const list = store.tasksOf(p).list.map(({ n, name, branch, closed, closedAt, merged, about }) => ({ n, name, branch, closed: !!closed, closedAt, merged: !!merged, about }));
    return [...list.filter((t) => !t.closed), ...list.filter((t) => t.closed).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0))]
      .map(({ closedAt, ...t }) => t);
  };
  shell.projects = () => store.projects().map((p) => {
    const favicon = faviconPicture(p);
    return { ...p, ...(favicon && { favicon }), tasks: tasksOf(p) };
  });
  // A question asked in a window (window.ts), the first one when none is named; in Settings' while it is open, as the
  // tasks' windows take no input then (settings-window.ts): askWhich gives the button clicked
  // ('ok', 'other') or null; ask whether it was ok. Through shell: the tests answer it.
  shell.askWhich = (q, w = first()) => (shell.settings ? shell.settings.questions.ask(q) : w!.ask(q));
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
    shell.settings?.setZoom(z);
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
    shell.settings?.setTheme(shell.theme, shell.shade());
  };
  nativeTheme.on('updated', () => { if (shell.theme === 'system') shell.setTheme(); });
  // The language the human speaks with the agents (☰ → Language; docs/window.md, Language): Kulisa's one, written into
  // each agent's own language setting (agents/, language) in every account of it, here and at an agent's start
  // (tasks.ts), never into the human's own folder. Agents without one are not told it otherwise (the author,
  // 2026-10-13: Kulisa gives the agents' own settings a place and keeps them in step, it adds no behavior).
  // English by default, as the agents are without it.
  const agentKinds = () => shell.accounts.all().filter((a) => a.own).map((a) => a.agent);
  shell.language = store.settings().language || 'en';
  shell.languageInfo = () => {
    const kinds = agentKinds().filter((a) => a.command);
    return { language: shell.language, languages: [...new Set(kinds.flatMap((a) => a.language?.languages || []))],
      agents: kinds.map((a) => ({ name: a.name, has: !!a.language })) };
  };
  shell.setLanguage = (code) => {
    if (!shell.languageInfo().languages.includes(code)) return { error: `not a language any agent takes: ${code}` };
    shell.language = code;
    store.saveSettings({ ...store.settings(), language: code });
    for (const a of shell.accounts.all()) {
      const r = !a.own && a.dir ? a.agent.language?.set(a.dir, code) : null;
      if (r?.error) console.warn('[agents] language:', r.error);
    }
    for (const w of shell.windows) w.send('language', shell.languageInfo());
    return { language: code };
  };
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

  // The windows' open tasks (open-tasks.ts): one change to them after another, in all windows.
  const tasks = openTasks(shell, { appDevTools });
  const { serial, newWindow, loadProject, unloadIdle, openProject } = tasks;
  // The windows' handles (ipc/): each message acts in the window it comes from.
  const ipc: Ipc = { shell, at, owner, serial, tasks };
  registerTasks(ipc);
  registerProjects(ipc, { lookForFavicon });
  registerProfiles(ipc);
  registerAgents(ipc);
  registerPanes(ipc);
  registerWindow(ipc);
  const ready = app.whenReady().then(async () => {
    // macOS keeps a menu bar for the app: Electron's default one would reload Kulisa's own page with ⌘R. Its own
    // menu: Quit, Hide (the app's), Copy and Paste (the Edit menu's roles: ⌘C, ⌘V in fields and the terminal), the
    // windows. Kulisa's keys are taken before it (onKey). Elsewhere the windows have no menu (window.ts).
    if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
    // Run from source, the Dock shows Electron's own icon (its bundle's); a packaged Kulisa has its own (forge.config.ts).
    if (!app.isPackaged) app.dock?.setIcon(path.join(import.meta.dirname, '..', '..', 'assets', 'icon.png'));
    shell.sessionCookies = new SessionCookies();
    shell.proxy = new CdpProxy();
    await shell.proxy.listen(0);
    shell.proxy.on('command', (c: import('./cdp-proxy.ts').Command) => bus.emit('agent-command', c));
    // Each window's tasks as saved, by key; then every project's open tasks no window has (tasks.json says open:
    // a crash, or windows saved by an older Kulisa) into the first window's bar, so none is lost.
    const projectOf = (key: string) => { const p = store.projects().find((x) => key.startsWith(`${x.id}/`)); return p && loadProject(p); };
    const windows = saved.map((s) => {
      const w = newWindow(s);
      for (const key of s.tabs) { const task = projectOf(key)?.taskByKey(key); if (task && !task.entry.closed && !task.window) w.add(task); }
      return { w, shown: (s.shown && w.tabs.find((t) => t.key === s.shown)) || w.tabs[0] || null };
    });
    if (!windows.length) windows.push({ w: newWindow({}), shown: null });
    for (const p of store.projects()) {
      const open = store.tasksOf(p).list.filter((t) => !t.closed);
      if (open.length) for (const task of loadProject(p).open()) if (!task.window) windows[0]!.w.add(task);
    }
    unloadIdle();
    for (const win of windows) win.shown ||= win.w.tabs[0] || null;
    await windows[0]!.w.load(windows[0]!.shown);
    shell.mcp = await startMcpServer(shell, { port: options.mcpPort ?? 4450 });
    installPicker(shell);
    installGhost(shell);
    installMasters(shell, { preload: path.join(import.meta.dirname, '..', 'preload', 'index.cjs'), colors: () => COLORS[shell.shade()] });
    installSettings(shell, { preload: path.join(import.meta.dirname, '..', 'preload', 'index.cjs'), appDevTools });

    for (const [i, { w, shown }] of windows.entries()) {
      if (i) await w.load(shown);
      if (shown) await serial(() => w.show(shown));
      else w.sendProjects();
    }
    // KULISA_PROJECT (npm start, the tests): that project's task shown in the first window: its first open one, else
    // the one closed last opened again, else a new one.
    if (options.project) {
      const p = projectOfFolder(path.resolve(options.project)), project = loadProject(p), w = windows[0]!.w;
      const task = project.open()[0] || project.closedTasks()[0];
      await serial(() => openProject(p, w, task?.n ?? null));
    }
    shell.firstStart(windows[0]!.w);
    shell.saveWindows();
    shell.stopAutosave = shell.sessionCookies.autosave(() => [...allProfiles(), ...shell.cookieSync.masters()]);
    shell.discard = startDiscarding(shell);
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
  installShortcuts(shell, { appDevTools });

  // Save session cookies and flush persistent ones before quitting, so sign-ins survive a restart; the windows and
  // their tabs open again at the next start.
  app.on('before-quit', async (e) => {
    if (quitting) return;
    e.preventDefault(); quitting = true;
    for (const w of shell.windows) w.pushState();
    for (const task of allTasks()) if (task !== task.window?.task && task.loaded) task.list.saveTabs();
    shell.saveWindows();
    shell.stopAutosave?.();
    shell.discard?.stop();
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
