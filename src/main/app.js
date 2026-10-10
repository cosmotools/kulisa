// Kulisa, the app: its windows (window.js) with their project tabs, the open projects, the agents, the CDP proxy and
// the MCP server, the windows' IPC (each message acts in the window it comes from), quitting. start(options) is used by
// the entry point (index.js) and by the tests.
const { app, ipcMain, dialog, screen, nativeTheme, Menu, shell: electronShell } = require('electron');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { stepZoom } = require('./profiles');
const { CdpProxy } = require('./cdp-proxy');
const { Store } = require('./store');
const { signinPages } = require('./signin-pages');
const { SessionCookies } = require('./session-cookies');
const { Project, askRemoveProject, removeProjectData } = require('./projects');
const { AppWindow } = require('./window');
const worktrees = require('./worktrees');
const agents = require('./agents');
const { nameError } = require('./names');
const { stopTerminal } = require('./terminal');
const keys = require('./keys');

// Electron shows a blocking modal dialog on an uncaught main-process exception, which also stops the proxy and
// the MCP server; log instead.
process.on('uncaughtException', (e) => console.error('[kulisa] uncaught', e));
process.on('unhandledRejection', (e) => console.error('[kulisa] unhandled rejection', e));

const NONE = new Map(); // the tasks and profiles when no project is open

// The Kulisa plugin's package for Claude Code (CLAUDE.md, Architecture, layer 3): the MCP config, a skill, hooks.
// Outside the asar archive when packaged (forge.config.js, extraResource), because claude reads it from disk.
const CLAUDE_PLUGIN = app.isPackaged ? path.join(process.resourcesPath, 'claude-plugin') : path.join(__dirname, '..', 'agent', 'claude-plugin');

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
  const userData = options.userData || path.join(app.getPath('appData'), 'Kulisa');
  app.setPath('userData', userData);
  const store = new Store(userData);
  // The windows open at the start, each with its tabs and the one it shows: those open last (or KULISA_PROJECT's,
  // added to the first); one with none at first start.
  const saved = store.windows().filter((w, i) => i === 0 || w.tabs.length);
  if (!saved.length) saved.push({ tabs: [], shown: null });
  if (options.project) {
    const p = store.projectFor(path.resolve(options.project));
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
  // A task's profiles changed (now: right away), or its agent's state (tasks.js): its window shows it. Not
  // once quitting: the tabs are saved then, and each one closing as Kulisa quits saved its task's tabs again,
  // fewer each time, at last none (one in the background at once: 2026-10-08, the author's tabs all about:blank).
  shell.taskChanged = (task, now, agentState) => quitting || task.project.window?.changed(task, now, agentState);
  // A question asked in a window (window.js), the first one when none is named: askWhich gives the button clicked
  // ('ok', 'other') or null; ask whether it was ok. Through shell: the tests answer it.
  shell.askWhich = (q, w = first()) => w.ask(q);
  shell.ask = async (q, w) => (await shell.askWhich(q, w)) === 'ok';
  shell.saveWindows = () => store.saveWindows(shell.windows.map((w) => w.saved()));
  // Every window's tabs and menus: which projects there are and where they are open.
  const sendProjects = () => { for (const w of shell.windows) w.sendProjects(); };

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
  const allProfiles = () => allTasks().flatMap((task) => [...task.profiles.values()]);

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
  async function openProject(p, w) {
    const project = shell.open.get(p.id) || addProject(p, w);
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
  async function openInNewWindow(p, from) {
    const to = newWindow({ near: from.win });
    await showInNew(to, addProject(p, to));
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
  async function createTask(project) {
    if (!project) return { error: 'the project is not open' };
    await project.checkGit();
    if (project.sharesFolder() && !await shell.ask({ message: `Another task of ${project.name} works in its folder`, ok: 'Create Anyway',
      detail: `Without git, tasks have no copies of their own: both agents would work in ${project.folder}, and may get in each other's way.` }, project.window)) {
      return { error: 'the human said no' };
    }
    const task = await project.createTask();
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
  // A closed task listed in its project's group menu, opened again: shown, its agent resumed.
  async function openTask(task) {
    task.project.reopen(task);
    await showTask(task);
    return { n: task.n };
  }
  // Removing a project, from wherever a window asks for it (w): the human confirms, then it is closed if it is open,
  // and its data deleted (projects.js).
  async function removeProject(id, w) {
    const p = store.projects().find((x) => x.id === id);
    if (!p) return { error: `no project ${id}` };
    if (!await askRemoveProject(shell, p, shell.open.get(id)?.window || w)) return { error: 'the human said no' };
    if (shell.open.has(id)) await closeProject(shell.open.get(id), { asked: true });
    await removeProjectData(shell, p);
    sendProjects();
    return { id };
  }
  ipcMain.handle('projects:list', (e) => at(e)?.info());
  // The switch runs on its own; the window hears about it through grid:closing, projects, tasks and state. A
  // project not open yet, asked for in a window with projects open: the human chooses where, as in JetBrains: in a tab
  // of this window, or in a new window.
  const openLater = (p, w) => {
    setImmediate(async () => {
      const where = shell.open.has(p.id) || !w.tabs.length ? 'ok' : await shell.askWhich({ message: `Where to open the project ${p.name}?`,
        detail: `This Window: in a tab of its own here; the projects open here keep running. New Window: in a window of its own.`,
        ok: 'This Window', other: 'New Window' }, w);
      if (!where || !shell.windows.includes(w)) return;
      await serial(() => (where === 'other' && !shell.open.has(p.id) ? openInNewWindow(p, w) : openProject(p, w)));
    });
    return w.info();
  };
  ipcMain.handle('project:open', (e, { id, folder }) => {
    const p = id ? store.projects().find((x) => x.id === id) : folder && fs.existsSync(folder) ? store.projectFor(path.resolve(folder)) : null;
    return p ? openLater(p, at(e)) : { error: 'no such project' };
  });
  ipcMain.handle('project:open-folder', async (e) => {
    const w = at(e);
    const r = await dialog.showOpenDialog(w.win, { title: 'Open a project folder', properties: ['openDirectory', 'createDirectory'] });
    return r.canceled || !r.filePaths[0] ? w.info() : openLater(store.projectFor(r.filePaths[0]), w);
  });
  // New Project…, as JetBrains': the folder <location>/<name>, the location the home folder unless the human picks
  // another, so they know where the agent's files are. A folder that is there already must be empty; git init in it
  // when asked, with an empty first commit: tasks get copies of their own (worktrees) from it.
  ipcMain.handle('project:new-defaults', () => ({ location: options.projectsHome || app.getPath('home'), sep: path.sep }));
  ipcMain.handle('project:pick-location', async (e, { location }) => {
    const r = await dialog.showOpenDialog(at(e).win, { title: 'Where to create the project', defaultPath: location, properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0] || null;
  });
  ipcMain.handle('project:new', async (e, { name, location, git }) => {
    name = name?.trim();
    const bad = nameError(name);
    if (bad) return { error: bad };
    location = location?.trim().replace(/^~(?=$|[\\/])/, app.getPath('home'));
    if (!location || !path.isAbsolute(location)) return { error: 'the location must be the full path of a folder' };
    const folder = path.join(location, name);
    if (fs.existsSync(folder) && (!fs.statSync(folder).isDirectory() || fs.readdirSync(folder).length)) {
      return { error: `${folder} is already there and not empty; to work in it, use Open Folder…` };
    }
    fs.mkdirSync(folder, { recursive: true });
    if (git) await worktrees.initRepo(folder).catch((err) => console.error('[git]', err.stderr || err.message));
    return openLater(store.projectFor(folder, name), at(e));
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
  ipcMain.handle('project:remove', (e, { id }) => serial(() => removeProject(id, at(e))));
  // A task of another project too (the bar shows every open project's): it becomes that project's, then the
  // project is shown.
  const taskAt = (key, fn) => serial(() => { const task = shell.taskByKey(key); return task ? fn(task) : { error: `no task ${key}` }; });
  ipcMain.handle('task:show', (e, key) => taskAt(key, showTask));
  ipcMain.handle('task:new', (e, { project } = {}) => serial(() => createTask(project ? shell.open.get(project) : at(e)?.current)));
  ipcMain.handle('task:close', (e, key) => taskAt(key, closeTask));
  ipcMain.handle('task:delete', (e, key) => taskAt(key, deleteTask));
  ipcMain.handle('task:open', (e, key) => taskAt(key, openTask));
  ipcMain.handle('task:rename', (e, { key, name }) => taskAt(key, (task) => task.rename(name)));
  ipcMain.handle('project:collapse', (e, { id, collapsed }) => { shell.open.get(id)?.collapse(collapsed); sendProjects(); });
  // The terminal's microphone and its language (voice.js in the renderer; Task.voice, dictate).
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

    for (const [i, { w, shown }] of windows.entries()) {
      if (i) await w.load(shown);
      if (shown) await serial(() => w.show(shown));
      else { w.sendProjects(); w.sendTasks(); }
    }
    shell.saveWindows();
    shell.stopAutosave = shell.sessionCookies.autosave(allProfiles);
    shell.screenshot = (file) => first().screenshot(file);
    // KULISA_SHOT=<file.png>: save a screenshot of the window a few seconds after start (for checking UI changes).
    if (process.env.KULISA_SHOT) setTimeout(() => shell.screenshot(process.env.KULISA_SHOT).catch((e) => console.error('[shot]', e.message)), Number(process.env.KULISA_SHOT_DELAY || 4000));
    for (const { w } of windows) w.pushState();
    return shell;
  });

  // ---------- agents ----------
  // Each task runs the agent the human chose for it (agents.js; saved in its agent.json). One not chosen yet or
  // not installed: the window asks (agent-picker.js), installing it with its maker's installer if the human wants.
  // The Kulisa plugin reads where Kulisa is from the environment, set per task (tasks.js): .mcp.json from
  // KULISA_MCP_URL, its hooks from KULISA_URL. Other agent CLIs get them too.
  shell.plugin = CLAUDE_PLUGIN;
  const custom = options.agent && { id: 'custom', name: options.agent.name || options.agent.command, custom: true,
    command: options.agent.command, shell: options.agent.shell, args: () => options.agent.args || [], voice: options.agent.voice,
    resume: options.agent.resume && (({ sessionId, transcript }) => sessionId && transcript && fs.existsSync(transcript) && options.agent.resume(sessionId)) };
  const known = [...(custom ? [custom] : []), ...(options.agents || agents.AGENTS)];
  shell.agentFor = (id) => known.find((a) => a.id === (id ?? custom?.id)) || null;
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
    const w = at(e);
    const list = await Promise.all(known.map(async (a) => {
      const found = (check || details) && await agents.findAgent(a, w?.task?.folder || app.getPath('home'));
      return {
        id: a.id, name: a.name, maker: a.maker, needs: a.needs, site: a.site, install: agents.installLine(a),
        ...((check || details) && { installed: !!found }),
        ...(details && { path: found?.path ?? null, onPath: found?.onPath ?? null, version: await agents.agentVersion(found) }),
      };
    }));
    return { list, home: app.getPath('home') };
  });
  // The maker's installer, run when the human clicks Install (that is their go-ahead); its output goes to the window.
  ipcMain.handle('agents:install', async (e, { id }) => {
    const w = at(e), a = shell.agentFor(id);
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
  ipcMain.handle('agent:change', (e, { task }) => { const w = onScreen(e, task); return w ? w.changeAgent() : noTask; });
  ipcMain.handle('terminal:open', (e, { task }) => { const w = onScreen(e, task); return w ? w.openTerminal() : noTask; });
  ipcMain.handle('terminal:close', (e, { task, id }) => onScreen(e, task)?.closeTerminal(id) || noTask);
  ipcMain.on('layout:save', (e, { task, layout }) => at(e)?.saveLayout(task, layout));
  ipcMain.on('layout', (e, { task, rects }) => at(e)?.layout(task, rects));

  // A tab the human opens (+): the window keeps the keys for its address (renderer.js). Its page, a native view, takes
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
