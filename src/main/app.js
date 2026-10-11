// Kulisa, the app: its windows (window.js) with their project tabs, the open projects, the agents, the CDP proxy and
// the MCP server, the windows' IPC (each message acts in the window it comes from), quitting. start(options) is used by
// the entry point (index.js) and by the tests.
const { app, ipcMain, dialog, screen, nativeTheme, Menu, safeStorage, shell: electronShell } = require('electron');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { stepZoom } = require('./profiles');
const { CdpProxy } = require('./cdp-proxy');
const { Store, PROJECT_COLORS } = require('./store');
const { Accounts } = require('./accounts');
const { ProfileStore } = require('./profile-store');
const { CookieSync } = require('./cookie-sync');
const { nextAvatar } = require('./avatars');
const { signinPages } = require('./signin-pages');
const { SessionCookies } = require('./session-cookies');
const { Project, askDeleteProject, deleteProjectData, faviconOf, addRepo, cloneRepo, defaultRepo, removeRepo, reposInfo, askDropProfile, dropProfile,
  agentsInfo, addAgent, defaultAgent, removeAgent, PROJECT_ICONS } = require('./projects');
const { AppWindow, COLORS } = require('./window');
const worktrees = require('./worktrees');
const agents = require('./agents');
const { nameError } = require('./names');
const { startTerminal, stopTerminal, forgetTerminal } = require('./terminal');
const keys = require('./keys');

// Electron shows a blocking modal dialog on an uncaught main-process exception, which also stops the proxy and
// the MCP server; log instead.
process.on('uncaughtException', (e) => console.error('[kulisa] uncaught', e));
process.on('unhandledRejection', (e) => console.error('[kulisa] unhandled rejection', e));

const NONE = new Map(); // the tasks and profiles when no project is open

// The Kulisa plugin's package for Claude Code (CLAUDE.md, Architecture, layer 3): the MCP config, a skill, hooks.
// Outside the asar archive when packaged (forge.config.js, extraResource), because claude reads it from disk.
const CLAUDE_PLUGIN = app.isPackaged ? path.join(process.resourcesPath, 'claude-plugin') : path.join(__dirname, '..', 'agent', 'claude-plugin');
// The BROWSER of an agent's own sign-in (account:signin), there too: the agent runs it.
const OPEN_URL = app.isPackaged ? path.join(process.resourcesPath, 'open-url') : path.join(__dirname, '..', 'agent', 'open-url');

// options:
//   userData   folder for Kulisa's data and browser profiles
//   project    a project's folder to open (added to the first window's tabs and shown); default: the windows and tabs
//              open last, else none (the window offers to open one, as VS Code)
//   agent      { name, command, args, resume, shell } to run in every task that has not chosen one, without
//              asking (KULISA_AGENT, the tests); resume(sessionId) gives the arguments that continue a session.
//              Default: the human chooses from agents (agents.js) per task, in the window.
//   agents     the agents to choose from, instead of agents.js's (tests)
//   mcpPort    port of the MCP server (default 4450)
//   mimicChrome  present profiles as Google Chrome (default true)
//   signinHosts  extra sign-in hosts (sign-in pause, tab restore)
function start(options = {}) {
  // direnv's state from where Kulisa was started (a terminal in a folder direnv had loaded) is not Kulisa's: a task's
  // shell took the task's folder for that folder left and undid its .envrc's changes, an agent's account variable
  // with them (its CLAUDE_CONFIG_DIR gone: the agent ran with the user's own sign-in, 2026-10-11). Without it, direnv
  // in each terminal starts clean and loads the task's own .envrc; git and direnv run by Kulisa too.
  for (const k of Object.keys(process.env)) if (k.startsWith('DIRENV_')) delete process.env[k];
  const userData = options.userData || path.join(app.getPath('appData'), 'Kulisa');
  app.setPath('userData', userData);
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
  // The app: the projects open in any window (projects.js: Project, by id) and the windows (window.js: AppWindow).
  // win, current, task, profiles, closed, pty are the first window's (the tests'): its shown project and task, that
  // task's open and closed profiles by id, its agent's terminal.
  const shell = { bus, store, proxy: null, mcp: null, open: new Map(), windows: [], signin: signinPages(options.signinHosts || []) };
  const first = () => shell.windows[0] ?? null;
  // The profiles and their masters (profile-store.js); after who one is changed, or a project got or let go of one,
  // every loaded task shows it (project-profiles.js, refresh), but the one it was changed in, which did.
  shell.profileStore = new ProfileStore(userData, (dir) => store.markDeleted(dir));
  // Real accounts signed in once, in every task: non-local cookies kept in step between masters and copies.
  shell.cookieSync = new CookieSync({ masterDir: (f) => shell.profileStore.masterDir(f), restore: (p) => shell.sessionCookies.restore(p) });
  // Test users' passwords, encrypted with the OS keyring (tasks.js, setLogin); never kept in the clear.
  shell.secrets = {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (s) => safeStorage.encryptString(s).toString('base64'),
    decrypt: (b) => safeStorage.decryptString(Buffer.from(b, 'base64')),
  };
  // Profiles whose test password is being typed (mcp-server.js, browser_type_login): ghost.js shows no text for them.
  shell.typingSecret = new Set();
  shell.profilesChanged = (from) => {
    for (const p of shell.open.values()) for (const t of p.tasks.values()) if (t.loaded && t !== from) { t.list.refresh(); shell.taskChanged(t, true); }
  };
  // Where new projects go, and the folders of copies of tasks with several repositories (projects.js).
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
  const at = (e) => shell.windowOf(e.sender);
  const mimic = options.mimicChrome !== false;
  const appDevTools = options.appDevTools ?? !app.isPackaged;
  let quitting = false; // from before-quit on (below): closing a window asks nothing, tabs closing save nothing
  Object.defineProperty(shell, 'quitting', { get: () => quitting });
  // A task's profiles changed (now: right away), or its agent's state (tasks.js): its window shows it. Not
  // once quitting: the tabs are saved then, and each one closing as Kulisa quits saved its task's tabs again,
  // fewer each time, at last none (one in the background at once: 2026-10-08, the author's tabs all about:blank).
  shell.taskChanged = (task, now, agentState) => quitting || task.project.window?.changed(task, now, agentState);
  // A project for a folder opened (KULISA_PROJECT, project:open with a folder): its site's favicon as its icon when it has one.
  function projectOfFolder(folder) { return store.projectFor(folder, undefined, { icon: faviconOf(folder) ? 'favicon' : undefined }); }
  // A color, icon or agent the window sent for a project: one of those offered, or why not.
  const lookError = ({ color, icon, agent }) => (color && !PROJECT_COLORS.includes(color) ? `no color ${color}`
    : icon && icon !== 'favicon' && !PROJECT_ICONS.includes(icon) ? `no icon ${icon}`
      : agent && !shell.agentFor(agent) ? `no agent ${agent}` : null);
  // The projects as the windows show them: each with its site's favicon when it has one (read once a folder), its icon
  // or one to choose in its group's panel.
  const favicons = new Map();
  const faviconFor = (folder) => (favicons.has(folder) ? favicons.get(folder) : favicons.set(folder, faviconOf(folder)).get(folder));
  // And its tasks (the Welcome screen's list): those open, as made, then the closed ones, the one closed last first.
  const tasksOf = (p) => {
    const list = store.tasksOf(p).list.map(({ n, name, branch, closed, closedAt, merged }) => ({ n, name, branch, closed: !!closed, closedAt, merged: !!merged }));
    return [...list.filter((t) => !t.closed), ...list.filter((t) => t.closed).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0))]
      .map(({ closedAt, ...t }) => t);
  };
  shell.projects = () => store.projects().map((p) => {
    const favicon = faviconFor(p.folder);
    return { ...p, ...(favicon && { favicon }), tasks: tasksOf(p) };
  });
  // A question asked in a window (window.js), the first one when none is named: askWhich gives the button clicked
  // ('ok', 'other') or null; ask whether it was ok. Through shell: the tests answer it.
  shell.askWhich = (q, w = first()) => w.ask(q);
  shell.ask = async (q, w) => (await shell.askWhich(q, w)) === 'ok';
  shell.saveWindows = () => store.saveWindows(shell.windows.map((w) => w.saved()));
  // Every window's tabs and menus: which projects there are, where they are open, their agents (+'s menu).
  const sendProjects = shell.sendProjects = () => { for (const w of shell.windows) w.sendProjects(); };

  // The Kulisa zoom: the whole UI of every window (window.js), and the profiles' pages, which follow it (profiles.js).
  // The panes' boxes come in CSS pixels (window.js, layout).
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
  // Every open profile: the tasks' copies, and the masters open to sign in to (master.js).
  const allProfiles = () => [...allTasks().flatMap((task) => [...task.profiles.values()]), ...[...(shell.masters?.values() || [])].map((m) => m.profile)];

  // ---------- windows, projects and tasks ----------
  // A project is a folder with its tasks (store.js). Each window has a tab per project open in it, as a browser
  // has; it shows one, the others keep running (their agents and pages), until the human closes their tab. Each
  // task has its profiles, grid and agent (tasks.js); a window shows one of its shown project's, the others
  // keep running. Showing another project or task hides this one's pages, and the window builds the next grid in
  // place (the page is not loaded again). A task loads (profiles, agent) the first time it is shown.
  // Opening, showing, creating, moving and closing run one after another, in all windows.
  let queue = Promise.resolve();
  const serial = (fn) => { const r = queue.then(fn); queue = r.catch(() => {}); return r; };
  const newWindow = (place) => { const w = new AppWindow(shell, place, { appDevTools }); shell.windows.push(w); return w; };
  const addProject = (p, w) => { const project = new Project(shell, p); shell.open.set(p.id, project); w.add(project); return project; };
  // A project shown: in a tab of window w at the end, unless it is open already: then its window shows it, brought to
  // the front.
  // A project shown on its task n when asked for (the Welcome screen's tasks), opened again if it was closed.
  const onTask = (project, n) => {
    const task = n != null && project.tasks.get(n);
    if (task) { if (task.entry.closed) project.reopen(task); project.select(task); }
    return project;
  };
  async function openProject(p, w, n) {
    const project = onTask(shell.open.get(p.id) || addProject(p, w), n);
    if (project.window !== w) project.window.focus();
    await project.window.show(project);
    sendProjects();
  }
  // Closing projects, wherever it starts (a tab, main's ×, removing a project, a window's ×): one function, so one
  // rule. The human is asked first, once, in their window w (asked: already, when a project is being removed). Each
  // project's agents stop, its profiles are saved and closed (sign-ins and tabs kept for when it opens again), its tab
  // goes; the one on screen goes last, so the tab next to it is shown, or none is left: the Welcome screen, or the
  // window closes when there is another (as a browser's).
  async function closeProjects(w, projects, { asked = false, window = false } = {}) {
    if (!asked && !await askClosing(w, projects, { window })) return { error: 'the human said no' };
    for (const p of [...projects.filter((p) => p !== w.current), ...projects.filter((p) => p === w.current)]) {
      await w.leave(p);
      await unload(p);
    }
    if (!w.tabs.length && shell.windows.length > 1) dropWindow(w);
    shell.saveWindows();
    sendProjects();
    return { ids: projects.map((p) => p.id) };
  }
  function closeProject(project, options) {
    if (!project || !shell.open.has(project.id)) return { error: 'the project is not open' };
    return closeProjects(project.window, [project], options);
  }
  // The question before closing projects (one, or a window's: window), saying which agents are still working; or before
  // quitting (quit), when the projects come back at the next start: asked only when that would stop a working agent.
  // True: go on.
  function askClosing(w, projects, { quit = false, window = false } = {}) {
    const working = projects.flatMap((p) => [...p.tasks.values()].filter((task) => task.state === 'working')
      .map((task) => (projects.length > 1 ? `${p.name}: ${task.name}` : task.name)));
    const busy = working.length ? `${working.length > 1 ? 'Agents are' : 'An agent is'} still working (${working.join(', ')}): ` : '';
    const it = working.length > 1 ? 'them' : 'it';
    if (quit) {
      return !working.length || shell.ask({ message: 'Quit Kulisa?', ok: 'Quit',
        detail: `${busy}quitting stops ${it}. The windows, their projects and conversations come back at the next start.` }, w);
    }
    const one = !window;
    return shell.ask({ message: one ? `Close the project ${projects[0].name}?` : 'Close the window?', ok: 'Close',
      detail: `${one ? '' : `Its projects close: ${projects.map((p) => p.name).join(', ')}. `}${busy ? `${busy}closing stops ${it}. ` : one ? 'Its agents stop. ' : ''}`
        + `${one ? 'Its' : 'Their'} tabs, sign-ins and conversations come back when ${one ? 'it is' : 'they are'} opened again.` }, w);
  }
  // An open project no longer: its agents stopped, its profiles closed, its tab gone (not on screen any more).
  async function unload(project) {
    await project.unload();
    shell.open.delete(project.id);
    project.window.drop(project);
  }
  // A project into another window (to, its tab at index; none: a window of its own next to its window, or at the
  // point at), as a browser moves a tab; it keeps running: its agents, its pages (the same views, moved, not loaded
  // again), what its terminals showed (terminals: { task key: their contents }, from the window it leaves). The
  // only tab of a window goes to a new one never (nothing would change); into another window, its window closes after
  // it.
  async function moveProject(project, terminals = {}, to = null, { index, at } = {}) {
    const from = project?.window;
    if (!from) return { error: 'the project is not open' };
    if (to === from) return { id: project.id };
    if (!to && from.tabs.length < 2) return { error: 'the project is the only one in its window' };
    for (const task of project.tasks.values()) shell.chooseAgent.cancel(task); // asked again in the other window
    await from.leave(project);
    from.drop(project);
    const target = to || newWindow({ near: from.win, at });
    target.add(project, index);
    project.moveTo(target);
    if (!from.tabs.length) dropWindow(from); // after its pages have left it
    target.send('terminals:restore', terminals); // before any more output (window.js: sent once the page has loaded)
    if (to) {
      to.focus();
      await to.show(project);
      shell.saveWindows();
      sendProjects();
    } else await showInNew(target, project);
    return { id: project.id };
  }
  // A project not open yet, in a window of its own next to window from (the human chose New Window).
  async function openInNewWindow(p, from, n) {
    const to = newWindow({ near: from.win });
    await showInNew(to, onTask(addProject(p, to), n));
  }
  async function showInNew(to, project) {
    const loading = to.load(project);
    await to.show(project);
    await loading;
    shell.saveWindows();
    sendProjects();
  }
  // A project's tab dragged and let go on window w's tabs (index: where): from w, it changes their order; from another
  // window, the project moves to w.
  function dropProject(project, w, index, terminals) {
    if (!project || !w) return { error: 'the project is not open' };
    if (project.window !== w) return moveProject(project, terminals, w, { index });
    w.reorder(project, index);
    return { id: project.id };
  }
  // A tab let go where no Kulisa window took it: outside them all, a new window there; on one (cancelled, or let go
  // elsewhere in a window), nothing.
  shell.pointer = () => screen.getCursorScreenPoint(); // where the pointer is on the screen (the tests set it)
  function dragOut(project, terminals) {
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
  async function closeWindow(w) {
    if (!shell.windows.includes(w)) return;
    if (shell.windows.length > 1) return w.tabs.length ? closeProjects(w, [...w.tabs], { window: true }) : dropWindow(w);
    return quit(w);
  }
  // Quitting Kulisa (the last window's ×, ☰ → Exit): every window and project comes back at the next start, so it asks
  // only when an agent works; w: the window to ask in.
  async function quit(w) { if (await askClosing(w, [...shell.open.values()], { quit: true })) app.quit(); }
  function dropWindow(w) { shell.windows.splice(shell.windows.indexOf(w), 1); w.destroy(); }
  // A new task of a project (+ in its group: projects.js), then shown. Without git it would work in the folder another
  // open task works in: the human is told first.
  // agent: New Task with (+'s right-click menu): one of the project's agents instead of its default.
  async function createTask(project, agent) {
    if (!project) return { error: 'the project is not open' };
    if (agent && !project.agents().includes(agent)) return { error: `${agent} is not one of ${project.name}'s agents` };
    await project.checkGit();
    if (project.sharesFolder() && !await shell.ask({ message: `Another task of ${project.name} works in its folder`, ok: 'Create Anyway',
      detail: `Without git, tasks have no copies of their own: both agents would work in ${project.folder}, and may get in each other's way.` }, project.window)) {
      return { error: 'the human said no' };
    }
    const task = await project.createTask(agent);
    if (task.error) return task;
    await showTask(task);
    return { n: task.n, key: task.key };
  }
  // A task of any open project shown: it becomes that project's, then the project is shown.
  async function showTask(task) {
    const win = task.project.window;
    await win.showTask(task);
    if (win.current !== task.project) await win.show(task.project);
  }
  // Before a task of a project leaves its bar (closed or deleted): the project shows the open task next to it.
  async function leaveTask(task) {
    const project = task.project, open = project.open(), i = open.indexOf(task);
    if (project.task === task) await project.window.showTask(open[i + 1] || open[i - 1]);
  }
  // × on a task's tab: its agent stops, its tabs close, all else stays (projects.js, closeTask); asked first only when
  // its agent is working. The last open task closes its project, as Chrome closes a window with its last tab (with
  // closing a project's question); the project opens on it again.
  async function closeTask(task) {
    const project = task.project;
    if (project.open().length === 1) {
      const r = await closeProject(project);
      if (!r.error) await project.closeTask(task);
      return r;
    }
    if (task.state === 'working' && !await shell.ask({ message: `Close the task ${task.name}?`, ok: 'Close',
      detail: "Its agent is still working: closing stops it. Its conversation, code and profiles stay; open it again from its project's group." }, project.window)) {
      return { error: 'the human said no' };
    }
    await leaveTask(task);
    await project.closeTask(task);
    project.window.taskGone(task);
    project.checkMerged().then((found) => found && sendProjects()).catch(() => {});
    return { n: task.n };
  }
  // Delete in a task's menu (open or closed), after the human says yes: everything of it goes (projects.js). The last
  // open one closes its project first.
  async function deleteTask(task) {
    const project = task.project;
    if (!await project.askDeleteTask(task)) return { error: 'the human said no' };
    if (!task.entry.closed && project.open().length === 1) {
      const r = await closeProject(project, { asked: true });
      if (r.error) return r;
    } else if (!task.entry.closed) await leaveTask(task);
    await project.deleteTask(task);
    project.window?.taskGone(task);
    if (!project.window) sendProjects();
    return { n: task.n };
  }
  // Delete Merged Tasks… (its group's menu): its closed tasks whose PR is merged, after one question naming them;
  // nothing of them is lost (projects.js, checkMerged).
  async function deleteMerged(project) {
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
  async function openTask(task) {
    task.project.reopen(task);
    await showTask(task);
    return { n: task.n };
  }
  // Removing a project, from wherever a window asks for it (w): the human confirms, then it is closed if it is open,
  // and its data deleted (projects.js).
  async function deleteProject(id, w) {
    const p = store.projects().find((x) => x.id === id);
    if (!p) return { error: `no project ${id}` };
    if (!await askDeleteProject(shell, p, shell.open.get(id)?.window || w)) return { error: 'the human said no' };
    if (shell.open.has(id)) await closeProject(shell.open.get(id), { asked: true });
    await deleteProjectData(shell, p);
    sendProjects();
    return { id };
  }
  ipcMain.handle('projects:list', (e) => at(e)?.info());
  // The switch runs on its own; the window hears about it through grid:closing, projects, tasks and state. A
  // project not open yet, asked for in a window with projects open: the human chooses where, as in JetBrains: in a tab
  // of this window, or in a new window.
  const openLater = (p, w, n) => {
    setImmediate(async () => {
      const where = shell.open.has(p.id) || !w.tabs.length ? 'ok' : await shell.askWhich({ message: `Where to open the project ${p.name}?`,
        detail: `This Window: in a tab of its own here; the projects open here keep running. New Window: in a window of its own.`,
        ok: 'This Window', other: 'New Window' }, w);
      if (!where || !shell.windows.includes(w)) return;
      await serial(() => (where === 'other' && !shell.open.has(p.id) ? openInNewWindow(p, w, n) : openProject(p, w, n)));
    });
    return w.info();
  };
  ipcMain.handle('project:open', (e, { id, folder, task }) => {
    const p = id ? store.projects().find((x) => x.id === id) : folder && fs.existsSync(folder) ? projectOfFolder(path.resolve(folder)) : null;
    return p ? openLater(p, at(e), task) : { error: 'no such project' };
  });
  // New Project…, as JetBrains': the folder <location>/<name>, the location ~/Kulisa (every new project's place, as
  // JetBrains' ~/PycharmProjects) unless the human picks another, so they know where the agent's files are. A folder
  // that is there already must be empty; git init in it when asked, with an empty first commit: tasks get copies of
  // their own (worktrees) from it. With its color and icon (ProjectEditor.vue). Made, not opened: the manager goes on to
  // its configuration (its agents' accounts, its code, its profiles), and Open there opens it (the author, 2026-10-11:
  // a question where to open it, right after Create, came unasked).
  // agents: every account, the agents' own first; clis: the agents a new account can be made of (New Account…).
  const choices = () => {
    const all = shell.accounts.all().filter((a) => !a.agent.custom);
    return { colors: PROJECT_COLORS, icons: PROJECT_ICONS, agents: all.filter((a) => a.choosable).map(({ id, name }) => ({ id, name })),
      clis: all.filter((a) => a.own && a.agent.config?.login).map(({ id, name }) => ({ id, name })) };
  };
  ipcMain.handle('project:new-defaults', () => ({ location: shell.projectsHome, sep: path.sep,
    color: store.nextColor(), ...choices() }));
  ipcMain.handle('project:pick-location', async (e, { location }) => {
    const r = await dialog.showOpenDialog(at(e).win, { title: 'Where to create the project', defaultPath: location, properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0] || null;
  });
  // What a new project's folder is now (the New Project form says it as the location is typed): not there (made), there
  // (taken as it is, its files kept), a repository (git init skipped), or a project's already (refused).
  const folderState = async (folder) => {
    if (!fs.existsSync(folder)) return { state: 'new' };
    if (!fs.statSync(folder).isDirectory()) return { state: 'file' };
    const of = store.projectOf(folder);
    if (of) return { state: 'project', project: of.name };
    return { state: (await worktrees.repoOf(folder)) ? 'repo' : fs.readdirSync(folder).length ? 'files' : 'empty' };
  };
  const newFolder = (location, name) => {
    location = location?.trim().replace(/^~(?=$|[\\/])/, app.getPath('home'));
    return location && path.isAbsolute(location) && name?.trim() ? path.join(location, name.trim()) : null;
  };
  ipcMain.handle('project:folder-state', async (e, { location, name }) => {
    const folder = newFolder(location, name);
    return folder ? { folder, ...await folderState(folder) } : null;
  });
  // New Project… is the one way in (the author, 2026-10-11; Open Folder… was not clear): a folder at its location that
  // is there already, with files or a repository, is taken as it is.
  ipcMain.handle('project:new', async (e, { name, location, git, color, icon }) => {
    name = name?.trim();
    const bad = nameError(name) || lookError({ color, icon });
    if (bad) return { error: bad };
    const folder = newFolder(location, name);
    if (!folder) return { error: 'the location must be the full path of a folder' };
    const there = await folderState(folder);
    if (there.state === 'file') return { error: `${folder} is a file, not a folder` };
    if (there.state === 'project') return { error: `${folder} is the project ${there.project}'s already` };
    fs.mkdirSync(folder, { recursive: true });
    if (git && there.state !== 'repo') await worktrees.initRepo(folder).catch((err) => console.error('[git]', err.stderr || err.message));
    const entry = store.projectFor(folder, name, { color, icon });
    sendProjects(); // the projects' menus and the Welcome screen list it
    return { id: entry.id };
  });
  // A project's configuration in the projects' manager (ProjectEditor.vue): its name, color, icon, agents,
  // repositories, profiles and local addresses; its folder is shown, not changed (its tasks' copies are made from it).
  // Open or not.
  ipcMain.handle('project:settings-get', (e, { id }) => {
    const p = store.projects().find((x) => x.id === id);
    return p ? reposInfo(p).then((r) => ({ id, name: p.name, folder: p.folder, color: p.color, icon: p.icon || 'logo', projectAgents: agentsInfo(shell, p), local: p.local || [],
      favicon: faviconOf(p.folder), ...r, ...profilesOf(id), ...choices() })) : { error: `no project ${id}` };
  });
  // Its profiles (profile-store.js): those it has, and those of other projects it can take. A new one comes closed in
  // its tasks (opened in a task, a copy of its master is made there); one let go asks first (projects.js).
  const profilesOf = (id) => {
    const names = (ids) => ids.filter((x) => x !== id).map((x) => store.projects().find((p) => p.id === x)?.name || x);
    const view = (g) => ({ id: g.id, name: g.name, avatar: g.avatar, description: g.description || '', also: names(g.projects) });
    const all = shell.profileStore.all();
    return { profiles: all.filter((g) => g.projects.includes(id)).map(view), others: all.filter((g) => !g.projects.includes(id)).map(view) };
  };
  ipcMain.handle('project:profile-new', (e, { id, name }) => {
    name = name?.trim();
    const bad = nameError(name);
    if (bad) return { error: bad };
    shell.profileStore.create(id, { name, avatar: nextAvatar(shell.profileStore.of(id).map((g) => g.avatar)) });
    shell.profilesChanged();
    return profilesOf(id);
  });
  ipcMain.handle('project:profile-add', (e, { id, profile }) => {
    const r = shell.profileStore.addTo(profile, id);
    if (r.error) return r;
    shell.profilesChanged();
    return profilesOf(id);
  });
  // The project open or not (projects.js, dropProfile); asked in the manager's window.
  ipcMain.handle('project:profile-remove', (e, { id, profile }) => serial(async () => {
    const entry = store.projects().find((x) => x.id === id), g = shell.profileStore.get(profile);
    if (!entry || !g) return { error: entry ? `no profile ${profile}` : `no project ${id}` };
    if (!await askDropProfile(shell, entry, g, 'human', at(e))) return { error: 'the human said no' };
    await dropProfile(shell, entry, g.folder);
    return profilesOf(id);
  }));
  // Its repositories or folders (projects.js): one picked in the OS's dialog (or given: the tests), cloned from a URL,
  // made the default, removed. Each answers with the project's settings as they are then.
  const settingsOf = async (id, r) => (r.error ? r : { ...(await reposInfo(store.projects().find((x) => x.id === id))) });
  ipcMain.handle('project:repo-add', async (e, { id, folder }) => {
    if (!folder) {
      const r = await dialog.showOpenDialog(at(e).win, { title: 'Add a repository or folder to the project', properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths[0]) return {};
      folder = r.filePaths[0];
    }
    return serial(async () => settingsOf(id, await addRepo(shell, id, folder)));
  });
  ipcMain.handle('project:repo-clone', (e, { id, url }) => serial(async () => settingsOf(id, await cloneRepo(shell, id, url))));
  ipcMain.handle('project:repo-default', (e, { id, folder }) => serial(async () => settingsOf(id, await defaultRepo(shell, id, folder))));
  ipcMain.handle('project:repo-remove', (e, { id, folder }) => serial(async () => settingsOf(id, await removeRepo(shell, id, folder))));
  // Its former folder (no git; tasks no longer work in it), in the OS's file manager: the human moves its files.
  ipcMain.handle('project:show-former', (e, { id }) => { const p = store.projects().find((x) => x.id === id); return p && electronShell.openPath(p.folder); });
  // Its agents (projects.js): one added, made the default (+ runs it), removed. At once, not on Save.
  ipcMain.handle('project:agent-add', (e, { id, agent }) => addAgent(shell, id, agent));
  ipcMain.handle('project:agent-default', (e, { id, agent }) => defaultAgent(shell, id, agent));
  ipcMain.handle('project:agent-remove', (e, { id, agent }) => serial(() => removeAgent(shell, id, agent, at(e))));
  // A new account of an agent, made in a project (the projects' manager; tasks.md, Accounts): a folder of its own
  // (accounts.js), then the agent's own sign-in in it, as /login, in a terminal of the window (key), which ends once signed
  // in; its status says the email it signed in to. The page it opens comes to Kulisa (its BROWSER: open-url, through the
  // local server with a token of this sign-in) and is shown in a clean browser of Kulisa's (master.js), not the user's
  // browser, already signed in to other accounts; it closes when the sign-in ends, and closed by the human it ends the
  // sign-in. Claude Code reads BROWSER on Linux (checked in 2.1.296); not set on Windows (a sh script). An email stored
  // already is that account, added to the project. Not one change after another
  // (serial): a sign-in takes minutes. { agents } or { error } (null: cancelled).
  const signins = shell.signins = new Map(); // a sign-in terminal's key -> its pty
  const openers = new Map(); // a sign-in's token -> what opens its page
  shell.signinOpen = (token, url) => { const open = openers.get(token); if (!open || !/^https?:\/\//.test(url)) return false; open(url); return true; };
  const cancel = (key) => { const p = signins.get(key); signins.delete(key); if (p) stopTerminal(p); };
  ipcMain.handle('account:signin', async (e, { id, agent: agentId, key }) => {
    const w = at(e), own = shell.accounts.find(agentId);
    if (!store.projects().some((x) => x.id === id)) return { error: `no project ${id}` };
    if (!own?.own || !own.agent.config?.login) return { error: `${own?.name || agentId} has no accounts` };
    const found = await agents.findAgent(own.agent, app.getPath('home'));
    if (!found?.path) return { error: `${own.name} is not installed: install it in ☰ → Agents…` };
    const r = shell.accounts.prepare(agentId);
    if (r.error) return r;
    const token = crypto.randomUUID();
    let page = null;
    openers.set(token, async (url) => {
      if (page) return;
      page = shell.openSigninWindow(url, `Signing in to ${own.name}: a clean browser, closed when done`)
        .catch((err) => { console.error('[accounts] sign-in window:', err.message); return null; });
      (await page)?.closed.then(() => cancel(key)); // closed by the human: no sign-in (closed when done: it ended already)
    });
    const browser = process.platform === 'win32' ? {} : { BROWSER: OPEN_URL, KULISA_OPEN_URL: `${shell.mcp.base}/signin/${token}/open` };
    const p = await startTerminal((channel, data) => w?.send(channel, data), { command: found.path, args: own.agent.config.login(),
      cwd: app.getPath('home'), env: { [own.agent.config.env]: r.dir, ...browser }, shell: false }, key);
    signins.set(key, p);
    const code = await new Promise((resolve) => p.onExit(({ exitCode }) => resolve(exitCode)));
    const cancelled = !signins.delete(key);
    openers.delete(token);
    forgetTerminal(key);
    await (await page)?.close();
    const got = await agents.accountEmail(own.agent, found, r.dir);
    // One it has already (the same email): that one; the new folder signed out and gone.
    const existing = got && shell.accounts.byEmail(agentId, got.email);
    if (cancelled || !got || existing) {
      if (got) await agents.signOut(own.agent, found, r.dir);
      shell.accounts.remove(r.dir);
      if (existing) return addAgent(shell, id, existing.id);
      return { error: cancelled ? null : `Not signed in: ${own.name} ended with code ${code}.` };
    }
    shell.accounts.create(id, r.id, agentId, got.email);
    return addAgent(shell, id, r.id);
  });
  ipcMain.handle('account:signin-cancel', (e, { key }) => cancel(key));
  // Its name, color and icon (its group's panel too, ProjectBar.vue: local not sent, kept as it is).
  ipcMain.handle('project:settings', (e, { id, name, color, icon, local = store.projects().find((p) => p.id === id)?.local }) => {
    name = name?.trim();
    // Its own local addresses (local.js): hosts, each with its subdomains (a tunnel, its dev domains).
    local = [...new Set((local || []).map((h) => String(h).trim().toLowerCase().replace(/^\*\./, '')).filter(Boolean))];
    const bad = nameError(name) || lookError({ color, icon }) || local.find((h) => !/^[a-z0-9.-]+$/.test(h) || !h.includes('.')) && `not a host name: ${local.find((h) => !/^[a-z0-9.-]+$/.test(h) || !h.includes('.'))}`;
    if (bad) return { error: bad };
    const entry = store.updateProject(id, { name, color, icon: icon === 'logo' ? null : icon, local: local.length ? local : null });
    if (!entry) return { error: `no project ${id}` };
    favicons.delete(entry.folder);
    const open = shell.open.get(id);
    if (open) {
      open.update(entry);
      if (open.window?.current === open) open.window.win.setTitle(`${entry.name} — Kulisa`);
    }
    sendProjects();
    return { id };
  });
  // A project open in any window: that window shows it (brought to the front).
  ipcMain.handle('project:show', (e, { id }) => serial(() => {
    const p = shell.open.get(id);
    return p && openProject(p.entry, p.window);
  }));
  ipcMain.handle('project:close', (e, { id } = {}) => serial(() => closeProject(id ? shell.open.get(id) : at(e)?.current)));
  // to: the id of the window it goes to (window.js), none for a new one.
  ipcMain.handle('project:move', (e, { id, to, terminals }) => serial(() => {
    const target = to ? shell.windows.find((w) => w.id === to) : null;
    return to && !target ? { error: 'that window is closed' } : moveProject(shell.open.get(id), terminals, target);
  }));
  // A project's tab dragged (projects.js): let go on this window's tabs, or where no window took it.
  ipcMain.handle('project:drop', (e, { id, index, terminals }) => serial(() => dropProject(shell.open.get(id), at(e), index, terminals)));
  ipcMain.handle('project:drag-out', (e, { id, terminals }) => serial(() => dragOut(shell.open.get(id), terminals)));
  ipcMain.handle('app:quit', (e) => serial(() => quit(at(e))));
  // Kulisa's data of an open project (its profiles, tasks), in the OS's file manager: for the human who wants to
  // know where it is or what takes the disk. Opened, not changed.
  ipcMain.handle('project:show-data', (e, { id }) => {
    const p = shell.open.get(id);
    return p && electronShell.openPath(store.dirOf(p.entry));
  });
  ipcMain.handle('project:delete', (e, { id }) => serial(() => deleteProject(id, at(e))));
  // A task of another project too (the bar shows every open project's): it becomes that project's, then the
  // project is shown.
  const taskAt = (key, fn) => serial(() => { const task = shell.taskByKey(key); return task ? fn(task) : { error: `no task ${key}` }; });
  ipcMain.handle('task:show', (e, key) => taskAt(key, showTask));
  ipcMain.handle('task:new', (e, { project, agent } = {}) => serial(() => createTask(project ? shell.open.get(project) : at(e)?.current, agent)));
  ipcMain.handle('task:close', (e, key) => taskAt(key, closeTask));
  ipcMain.handle('task:delete', (e, key) => taskAt(key, deleteTask));
  ipcMain.handle('task:open', (e, key) => taskAt(key, openTask));
  ipcMain.handle('task:rename', (e, { key, name }) => taskAt(key, (task) => task.rename(name)));
  ipcMain.handle('project:delete-merged', (e, { id }) => serial(() => { const p = shell.open.get(id); return p ? deleteMerged(p) : { error: 'the project is not open' }; }));
  ipcMain.handle('project:collapse', (e, { id, collapsed }) => { shell.open.get(id)?.collapse(collapsed); sendProjects(); });
  // The terminal's microphone and its language (Dictation.vue in the renderer; Task.voice, dictate).
  // Esc typed into an agent's terminal (its key is the task's): Task.interrupted.
  ipcMain.on('pty:in', (e, { task, data }) => { if (data === '\x1b') shell.taskByKey(task)?.interrupted(); });
  ipcMain.handle('voice:get', (e, key) => shell.taskByKey(key)?.voice() ?? null);
  ipcMain.handle('voice:record', (e, { task, on }) => shell.taskByKey(task)?.dictate(on) ?? { recording: false });
  ipcMain.handle('voice:language', (e, { task, code }) => shell.taskByKey(task)?.setVoiceLanguage(code) ?? { error: `no task ${task}` });
  ipcMain.handle('task:show-folder', (e, key) => { const task = shell.taskByKey(key); return task && electronShell.openPath(task.folder); });
  ipcMain.handle('tasks:get', (e) => at(e)?.sendTasks());

  const ready = app.whenReady().then(async () => {
    // macOS keeps a menu bar for the app: Electron's default one would reload Kulisa's own page with ⌘R. Its own
    // menu: Quit, Hide (the app's), Copy and Paste (the Edit menu's roles: ⌘C, ⌘V in fields and the terminal), the
    // windows. Kulisa's keys are taken before it (onKey). Elsewhere the windows have no menu (window.js).
    if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
    shell.sessionCookies = new SessionCookies();
    shell.proxy = new CdpProxy();
    await shell.proxy.listen(0);
    shell.proxy.on('command', (c) => bus.emit('agent-command', c));
    const windows = saved.map((s) => {
      const w = newWindow(s);
      for (const p of s.tabs) if (!shell.open.has(p.id)) addProject(p, w);
      return { w, shown: s.shown && shell.open.get(s.shown.id)?.window === w ? shell.open.get(s.shown.id) : w.tabs[0] || null };
    });
    // The first window's page tells how Chromium presents itself, before any profile is made.
    await windows[0].w.load(windows[0].shown);
    const mimicChrome = require('./mimic-chrome');
    shell.chromeIdentity = mimic ? mimicChrome.chromeIdentity(await mimicChrome.nativeIdentity(windows[0].w.win.webContents)) : null;
    shell.mcp = await require('./mcp-server').startMcpServer(shell, { port: options.mcpPort ?? 4450 });
    require('./picker').installPicker(shell);
    require('./ghost').installGhost(shell);
    require('./master').installMasters(shell, { preload: path.join(__dirname, '..', 'preload', 'index.js'), colors: () => COLORS[shell.shade()] });

    for (const [i, { w, shown }] of windows.entries()) {
      if (i) await w.load(shown);
      if (shown) await serial(() => w.show(shown));
      else { w.sendProjects(); w.sendTasks(); }
    }
    shell.saveWindows();
    shell.stopAutosave = shell.sessionCookies.autosave(() => [...allProfiles(), ...shell.cookieSync.masters()]);
    shell.screenshot = (file) => first().screenshot(file);
    // KULISA_SHOT=<file.png>: save a screenshot of the window a few seconds after start (for checking UI changes).
    if (process.env.KULISA_SHOT) setTimeout(() => shell.screenshot(process.env.KULISA_SHOT).catch((e) => console.error('[shot]', e.message)), Number(process.env.KULISA_SHOT_DELAY || 4000));
    for (const { w } of windows) w.pushState();
    return shell;
  });

  // ---------- agents ----------
  // Each task runs the agent the human chose for it (agents.js; saved in its agent.json). One not chosen yet or
  // not installed: the window asks (AgentPicker.vue), installing it with its maker's installer if the human wants.
  // The Kulisa plugin reads where Kulisa is from the environment, set per task (tasks.js): .mcp.json from
  // KULISA_MCP_URL, its hooks from KULISA_URL. Other agent CLIs get them too.
  shell.plugin = CLAUDE_PLUGIN;
  const custom = options.agent && { id: 'custom', name: options.agent.name || options.agent.command, custom: true,
    command: options.agent.command, shell: options.agent.shell, args: () => options.agent.args || [], voice: options.agent.voice,
    resume: options.agent.resume && (({ sessionId, transcript }) => sessionId && transcript && fs.existsSync(transcript) && options.agent.resume(sessionId)) };
  const known = [...(custom ? [custom] : []), ...(options.agents || agents.AGENTS)];
  // The agents with their accounts (accounts.js); an account is its agent with its config folder in its environment.
  shell.accounts = new Accounts(userData, known, (dir) => store.markDeleted(dir));
  shell.accounts.clean();
  // An account no project has any more (projects.js): signed out with its agent's own command (what it keeps outside
  // its folder goes too: Claude Code's Keychain entry on macOS), then its folder.
  shell.dropAccount = async (a) => {
    await agents.signOut(a.agent, await agents.findAgent(a.agent, app.getPath('home')), a.dir);
    shell.accounts.remove(a.dir);
  };
  // An agent or account a task may run (any: also an agent itself that has accounts, as for installing it, or a task
  // that ran it before accounts were Kulisa's: its configDir the human's own folder).
  shell.agentFor = (id, { any = false } = {}) => {
    const a = shell.accounts.find(id ?? custom?.id);
    if (!a || (!a.choosable && !any)) return null;
    return { ...a.agent, id: a.id, agentId: a.agent.id, name: a.name, configDir: a.own ? a.agent.config?.home() ?? null : a.dir,
      env: a.own ? {} : { [a.agent.config.env]: a.dir } };
  };
  shell.findAgent = agents.findAgent;
  const choosing = new Map(); // task key -> resolve(agent or null)
  // Asked in the task's window. cancel: the human may leave it as it is (changing the agent; not when there is
  // none yet).
  shell.chooseAgent = (task, agent, { cancel = false } = {}) => new Promise((resolve) => {
    choosing.get(task.key)?.(null);
    choosing.set(task.key, resolve);
    task.project.window?.send('agent:choose', { task: task.key, selected: agent?.id ?? null, cancel });
  });
  shell.chooseAgent.cancel = (task) => { choosing.get(task.key)?.(null); choosing.delete(task.key); };
  ipcMain.on('agent:chosen', (_e, { task, id }) => { const r = choosing.get(task); choosing.delete(task); r?.(id ? shell.agentFor(id) : null); });
  // The agents to choose from; with check, whether each is installed (for the task's folder: its environment);
  // with details (the Agents window), also where it is and its version.
  ipcMain.handle('agents:list', async (e, { check, details } = {}) => {
    const w = at(e), found = new Map(); // each agent looked for once, whatever its accounts
    // The project's agents first (Change agent…, Choose the Agent), in its order.
    const mine = w?.current?.agents() || [], rank = (id) => (mine.includes(id) ? mine.indexOf(id) : mine.length);
    // Choosing a task's: the project's accounts, and the agents without accounts (the terminal only); never another
    // project's account: it could go with that project while a task here runs it. The Agents window: the agents alone.
    const accounts = shell.accounts.all().filter((a) => (details ? a.own : a.choosable && (a.own || mine.includes(a.id))))
      .sort((x, y) => rank(x.id) - rank(y.id)); // stable: the others as they were
    const list = await Promise.all(accounts.map(async ({ id, agent: a, name, dir, own }) => {
      if ((check || details) && !found.has(a.id)) found.set(a.id, agents.findAgent(a, w?.task?.folder || app.getPath('home')));
      const f = await found.get(a.id);
      return {
        id, agent: a.id, name, maker: a.maker, needs: a.needs, site: a.site, install: agents.installLine(a),
        account: own ? null : dir,
        ...((check || details) && { installed: !!f }),
        ...(details && { path: f?.path ?? null, onPath: f?.onPath ?? null, version: await agents.agentVersion(f) }),
      };
    }));
    return { list, home: app.getPath('home') };
  });
  // The maker's installer, run when the human clicks Install (that is their go-ahead); its output goes to the window.
  ipcMain.handle('agents:install', async (e, { id }) => {
    const w = at(e), a = shell.agentFor(id, { any: true });
    if (!a?.install) return { error: `nothing to install for ${id}` };
    const code = await agents.installAgent(a, (data) => w?.send('agents:install-log', data));
    return { code, installed: !!(await agents.findAgent(a, w?.task?.folder || app.getPath('home'))) };
  });

  // A window's handles on the profiles of its shown task (the editor, the panes): each only translates to the
  // task's own (tasks.js), the same the agent's tools use (mcp-server.js). A refusal answers { error }.
  // Each names its task (renderer, tasks.js: act): one sent just as the human switches tasks or
  // projects is refused, not done in the task shown by then.
  const noTask = { error: 'that task is not on screen' };
  const onScreen = (e, key) => { const task = at(e)?.task; return task && task.key === key ? task : null; };
  const onProfile = (fn) => (e, { task, profile, ...args }) => { const r = onScreen(e, task)?.find(profile) || noTask; return r.error ? r : fn(r.profile, args); };
  const onTab = (fn) => (e, { task, profile, tab, ...args }) => { const r = onScreen(e, task)?.findTab(profile, tab) || noTask; return r.error ? r : fn(r.profile, r.tab, args); };
  ipcMain.handle('profile:new', (e, { task, name, description, avatar }) => onScreen(e, task)?.createProfile(name, description, avatar) || noTask);
  ipcMain.handle('profile:close', (e, { task, profile }) => onScreen(e, task)?.closeProfile(profile) || noTask);
  ipcMain.handle('profile:open', (e, { task, profile }) => onScreen(e, task)?.openProfile(profile) || noTask);
  ipcMain.handle('profile:rename', (e, { task, profile, name }) => onScreen(e, task)?.renameProfile(profile, name) || noTask);
  ipcMain.handle('profile:describe', (e, { task, profile, description }) => onScreen(e, task)?.describeProfile(profile, description) || noTask);
  ipcMain.handle('profile:avatar', (e, { task, profile, avatar }) => onScreen(e, task)?.setProfileAvatar(profile, avatar) || noTask);
  ipcMain.handle('profile:delete', (e, { task, profile }) => onScreen(e, task)?.deleteProfile(profile, 'human') || noTask);
  ipcMain.handle('views:hidden', (e, hidden, opts) => at(e)?.hideViews(hidden, opts));
  ipcMain.on('ask:answer', (e, { id, answer }) => at(e)?.answer(id, answer));
  ipcMain.handle('layout:load', (e, { task }) => onScreen(e, task)?.store.layout());
  // A profile's master, to sign in to (master.js), and its cookies brought to this task's copy (tasks.js).
  ipcMain.handle('profile:master', (e, { task, profile }) => onScreen(e, task)?.openMaster(profile) || noTask);
  ipcMain.handle('profile:login', (e, { task, profile, user, password }) => onScreen(e, task)?.setLogin(profile, user, password) || noTask);
  ipcMain.handle('profile:refresh', (e, { task, profile }) => onScreen(e, task)?.refreshProfile(profile) || noTask);
  ipcMain.handle('agent:change', (e, { task }) => { const w = onScreen(e, task); return w ? w.changeAgent() : noTask; });
  ipcMain.handle('terminal:open', (e, { task }) => { const w = onScreen(e, task); return w ? w.openTerminal() : noTask; });
  ipcMain.handle('terminal:close', (e, { task, id }) => onScreen(e, task)?.closeTerminal(id) || noTask);
  ipcMain.on('layout:save', (e, { task, layout }) => at(e)?.saveLayout(task, layout));
  ipcMain.on('layout', (e, { task, rects }) => at(e)?.layout(task, rects));

  // A tab the human opens (+): the window keeps the keys for its address (ProfilePane.vue). Its page, a native view, takes
  // them as it loads (when, varies), so they go back each time, until the human clicks the page or it goes somewhere.
  ipcMain.handle('tab:new', onProfile((p, { url }) => {
    const tab = p.newTab(url || 'about:blank');
    const wc = tab.wc;
    const back = () => { if (!p.win.isDestroyed()) p.win.webContents.focus(); };
    const clicked = (_e, i) => { if (i.type === 'mouseDown') off(); };
    const went = (_e, u, _inPage, mainFrame) => { if (mainFrame && u !== 'about:blank') off(); };
    const off = () => { if (wc.isDestroyed()) return; wc.off('focus', back); wc.off('before-mouse-event', clicked); wc.off('did-start-navigation', went); };
    wc.on('focus', back); wc.on('before-mouse-event', clicked); wc.on('did-start-navigation', went);
    tab.ready.then(back);
    return tab.id;
  }));
  // focus: the keyboard was in the tab's page (a key closed or switched it): it goes to the page shown next, as in Chrome.
  ipcMain.handle('tab:close', onTab((p, t, { focus }) => {
    if (focus) p.once('tab-closed', () => setImmediate(() => p.get()?.wc.focus()));
    p.closeTab(t.id);
  }));
  ipcMain.handle('tab:activate', onTab((p, t, { focus }) => { p.activate(t.id); if (focus) t.wc.focus(); }));
  ipcMain.handle('tab:focus', onTab((p, t) => t.wc.focus()));
  ipcMain.handle('tab:reopen', onProfile((p) => p.reopenTab()?.id ?? null));
  ipcMain.handle('tab:navigate', onTab((p, t, { url }) => p.navigate(t.id, url)));
  ipcMain.handle('tab:back', onTab((p, t) => p.back(t.id)));
  ipcMain.handle('tab:forward', onTab((p, t) => p.forward(t.id)));
  ipcMain.handle('tab:reload', onTab((p, t, { ignoreCache }) => p.reload(t.id, { ignoreCache })));
  ipcMain.handle('tab:dialog', onTab((p, t, { dialog, ok }) => p.answerDialog(t.id, dialog, ok)));
  ipcMain.handle('tab:devtools', onTab((p, t) => p.toggleDevTools(t.id)));
  ipcMain.handle('zoom:get', () => shell.uiZoom);
  ipcMain.handle('theme:set', (_e, theme) => ['dark', 'light', 'system'].includes(theme) && shell.setTheme(theme));
  ipcMain.handle('bar:set', (_e, bar) => ['top', 'bottom'].includes(bar) && shell.setBar(bar));
  ipcMain.handle('zoom:ui', (_e, dir) => shell.setUiZoom(stepZoom(shell.uiZoom, dir)));
  ipcMain.handle('tab:zoom', onTab((p, t, { dir }) => p.zoomSite(t.id, dir)));

  // ---------- keyboard shortcuts (keys.js) ----------
  // Every key typed in the window or in a profile's page comes here first (before-input-event), before the page
  // gets it: one of Kulisa's is taken (the page never sees it) and done, here or by the window; any other goes on
  // to the page, the terminal's agent or the site.
  const keymap = keys.keymap();
  const ZOOM = { 'zoom.in': 1, 'zoom.out': -1, 'zoom.reset': 0, 'site.zoomIn': 1, 'site.zoomOut': -1, 'site.zoomReset': 0 };
  // A profile's tab by its webContents, of a task shown in a window.
  const tabOf = (wc) => {
    for (const w of shell.windows) for (const profile of w.profiles.values()) {
      const tab = profile.tabs.find((t) => t.wc === wc);
      if (tab) return { w, profile, tab };
    }
    return null;
  };
  function onKey(wc, e, input) {
    if (input.type !== 'keyDown') return;
    const w = shell.windowOf(wc), t = !w && tabOf(wc);
    if (!w && !t) return; // DevTools, a tab of a task not on screen
    const zone = w ? w.keyZone : 'page';
    const pane = zone.startsWith('pane:') ? zone.slice('pane:'.length) : null;
    // The nearest group first: in a page, the page's keys (its zoom, its DevTools); in the window, Kulisa's.
    const hit = keys.match(keymap, input, zone === 'page' ? ['page', 'global'] : pane ? ['global', 'page'] : ['global'], { always: zone === 'dialog' });
    if (!hit || (hit.id === 'devtools.app' && !appDevTools)) return;
    e.preventDefault();
    const win = w || t.w;
    if (hit.id in ZOOM) return hit.id.startsWith('zoom.') ? shell.setUiZoom(stepZoom(shell.uiZoom, ZOOM[hit.id])) : t.profile.zoomSite(t.tab.id, ZOOM[hit.id]);
    if (hit.id === 'devtools.app') return win.toggleDevTools();
    if (hit.id === 'devtools.tab') return t.profile.toggleDevTools(t.tab.id);
    if (hit.window) win.win.webContents.focus();
    win.send('command', { id: hit.id, n: hit.n, profile: t ? t.profile.id : pane, tab: t ? t.tab.id : null, task: win.task?.key ?? null, page: !!t });
  }
  app.on('web-contents-created', (_e, wc) => wc.on('before-input-event', (e, input) => onKey(wc, e, input)));
  ipcMain.on('keys:zone', (e, zone) => { const w = at(e); if (w) w.keyZone = String(zone); });

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
    for (const task of allTasks()) for (const p of [task.pty, ...[...task.terminals.values()].map((t) => t.pty)]) if (p) stopTerminal(p);
    app.quit();
  });
  process.on('SIGINT', () => app.quit());
  process.on('SIGTERM', () => app.quit());
  app.on('window-all-closed', () => app.quit());
  return ready;
}

module.exports = { start, CLAUDE_PLUGIN };
