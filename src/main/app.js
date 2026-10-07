// Kulisa, the app: its windows (window.js) with their project tabs, the open projects, the agents, the CDP proxy and
// the MCP server, the windows' IPC (each message acts in the window it comes from), quitting. start(options) is used by
// the entry point (index.js) and by the tests.
const { app, ipcMain, dialog, screen, nativeTheme } = require('electron');
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

// Electron shows a blocking modal dialog on an uncaught main-process exception, which also stops the proxy and
// the MCP server; log instead.
process.on('uncaughtException', (e) => console.error('[kulisa] uncaught', e));
process.on('unhandledRejection', (e) => console.error('[kulisa] unhandled rejection', e));

const NONE = new Map(); // the workspaces and profiles when no project is open

// The Kulisa plugin's package for Claude Code (CLAUDE.md, Architecture, layer 3): the MCP config, a skill, hooks.
// Outside the asar archive when packaged (forge.config.js, extraResource), because claude reads it from disk.
const CLAUDE_PLUGIN = app.isPackaged ? path.join(process.resourcesPath, 'claude-plugin') : path.join(__dirname, '..', 'agent', 'claude-plugin');

// options:
//   userData   folder for Kulisa's data and browser profiles
//   project    a project's folder to open (added to the first window's tabs and shown); default: the windows and tabs
//              open last, else none (the window offers to open one, as VS Code)
//   agent      { name, command, args, resume, shell } to run in every workspace that has not chosen one, without
//              asking (KULISA_AGENT, the tests); resume(sessionId) gives the arguments that continue a session.
//              Default: the human chooses from agents (agents.js) per workspace, in the window.
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
  // win, current, ws, profiles, closed, pty are the first window's (the tests'): its shown project and workspace, that
  // workspace's open and closed profiles by id, its agent's terminal.
  const shell = { bus, store, proxy: null, mcp: null, open: new Map(), windows: [], signin: signinPages(options.signinHosts || []) };
  const first = () => shell.windows[0] ?? null;
  Object.defineProperties(shell, {
    win: { get: () => first()?.win ?? null },
    current: { get: () => first()?.current ?? null },
    ws: { get: () => first()?.ws ?? null },
    profiles: { get: () => first()?.profiles || NONE },
    closed: { get: () => first()?.closed || NONE },
    pty: { get: () => first()?.ws?.pty || null },
    resumedSession: { get: () => first()?.ws?.resumedSession ?? null },
  });
  // A workspace of an open project: by the project's id and its number (the MCP server's URLs), or by its key (the
  // windows', the CDP proxy's).
  shell.workspaceOf = (id, n) => shell.open.get(id)?.workspaces.get(n) || null;
  shell.workspace = (key) => { for (const p of shell.open.values()) { const ws = p.workspace(key); if (ws) return ws; } return null; };
  // The window a page's message comes from (IPC: event.sender).
  shell.windowOf = (sender) => shell.windows.find((w) => !w.win.isDestroyed() && w.win.webContents === sender) || null;
  const at = (e) => shell.windowOf(e.sender);
  const mimic = options.mimicChrome !== false;
  const appDevTools = options.appDevTools ?? !app.isPackaged;
  // A workspace's profiles changed (now: right away), or its agent's state (workspaces.js): its window shows it.
  shell.wsChanged = (ws, now, agentState) => ws.project.window?.changed(ws, now, agentState);
  // A question asked in a window (window.js), the first one when none is named: askWhich gives the button clicked
  // ('ok', 'other') or null; ask whether it was ok. Through shell: the tests answer it.
  shell.askWhich = (q, w = first()) => w.ask(q);
  shell.ask = async (q, w) => (await shell.askWhich(q, w)) === 'ok';
  shell.saveWindows = () => store.saveWindows(shell.windows.map((w) => w.saved()));
  // Every window's tabs and menus: which projects there are and where they are open.
  const sendProjects = () => { for (const w of shell.windows) w.sendProjects(); };
  let quitting = false; // from before-quit on (below): closing a window asks nothing

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
  const allWorkspaces = () => [...shell.open.values()].flatMap((p) => [...p.workspaces.values()]);
  const allProfiles = () => allWorkspaces().flatMap((ws) => [...ws.profiles.values()]);

  // ---------- windows, projects and workspaces ----------
  // A project is a folder with its workspaces (store.js). Each window has a tab per project open in it, as a browser
  // has; it shows one, the others keep running (their agents and pages), until the human closes their tab. Each
  // workspace has its profiles, grid and agent (workspaces.js); a window shows one of its shown project's, the others
  // keep running. Showing another project or workspace hides this one's pages, and the window builds the next grid in
  // place (the page is not loaded again). A workspace loads (profiles, agent) the first time it is shown.
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
    const working = projects.flatMap((p) => [...p.workspaces.values()].filter((ws) => ws.state === 'working')
      .map((ws) => (projects.length > 1 ? `${p.name}: ${ws.name}` : ws.name)));
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
  // again), what its terminals showed (terminals: { workspace key: their contents }, from the window it leaves). The
  // only tab of a window goes to a new one never (nothing would change); into another window, its window closes after
  // it.
  async function moveProject(project, terminals = {}, to = null, { index, at } = {}) {
    const from = project?.window;
    if (!from) return { error: 'the project is not open' };
    if (to === from) return { id: project.id };
    if (!to && from.tabs.length < 2) return { error: 'the project is the only one in its window' };
    for (const ws of project.workspaces.values()) shell.chooseAgent.cancel(ws); // asked again in the other window
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
    if (await askClosing(w, [...shell.open.values()], { quit: true })) app.quit();
  }
  function dropWindow(w) { shell.windows.splice(shell.windows.indexOf(w), 1); w.destroy(); }
  // A fork of a project's main (projects.js), then shown.
  async function createWorkspace(project, name, agent) {
    if (!project) return { error: 'no project is open' };
    const ws = await project.createFork(name, agent);
    if (ws.error) return ws;
    await project.window.showWorkspace(ws);
    return { n: ws.n, key: ws.key };
  }
  // Closing a fork deletes it, after the human says yes (projects.js); main is the project itself: closing it closes
  // the project.
  async function closeWorkspace(ws) {
    const project = ws.project;
    if (ws.main) return closeProject(project);
    if (!await project.askDeleteFork(ws)) return { error: 'the human said no' };
    if (project.ws === ws) await project.window.showWorkspace(project.main);
    await project.deleteFork(ws);
    project.window.forkDeleted(ws);
    return { n: ws.n };
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
  // The switch runs on its own; the window hears about it through grid:closing, projects, workspaces and state. A
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
  // when asked (workspaces need git).
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
    if (git) await worktrees.initRepo(folder).catch((err) => console.error('[git]', err.message));
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
  ipcMain.handle('project:remove', (e, { id }) => serial(() => removeProject(id, at(e))));
  ipcMain.handle('ws:show', (e, key) => serial(() => { const ws = shell.workspace(key); return ws && ws.project.window.showWorkspace(ws); }));
  ipcMain.handle('ws:new', (e, { name, agent }) => serial(() => createWorkspace(at(e)?.current, name, agent)));
  ipcMain.handle('ws:close', (e, key) => serial(() => { const ws = shell.workspace(key); return ws ? closeWorkspace(ws) : { error: `no workspace ${key}` }; }));
  // git init in the shown project's folder, only on the human's click, after they confirm.
  ipcMain.handle('ws:git-init', async (e) => {
    const project = at(e)?.current;
    if (await project?.initGit() && project === project.window?.current) project.window.sendWorkspaces();
  });
  // The window asks again when the pointer comes to the strip: the human may have made the first commit meanwhile.
  ipcMain.handle('workspaces:get', async (e) => { const w = at(e); await w?.current?.checkGit(); w?.sendWorkspaces(); });

  const ready = app.whenReady().then(async () => {
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
      else { w.sendProjects(); w.sendWorkspaces(); }
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
  // Each workspace runs the agent the human chose for it (agents.js; saved in its agent.json). One not chosen yet or
  // not installed: the window asks (agent-picker.js), installing it with its maker's installer if the human wants.
  // The Kulisa plugin reads where Kulisa is from the environment, set per workspace (workspaces.js): .mcp.json from
  // KULISA_MCP_URL, its hooks from KULISA_URL. Other agent CLIs get them too.
  shell.plugin = CLAUDE_PLUGIN;
  const custom = options.agent && { id: 'custom', name: options.agent.name || options.agent.command, custom: true,
    command: options.agent.command, shell: options.agent.shell, args: () => options.agent.args || [],
    resume: options.agent.resume && (({ sessionId, transcript }) => sessionId && transcript && fs.existsSync(transcript) && options.agent.resume(sessionId)) };
  const known = [...(custom ? [custom] : []), ...(options.agents || agents.AGENTS)];
  shell.agentFor = (id) => known.find((a) => a.id === (id ?? custom?.id)) || null;
  shell.findAgent = agents.findAgent;
  const choosing = new Map(); // workspace key -> resolve(agent or null)
  // Asked in the workspace's window. cancel: the human may leave it as it is (changing the agent; not when there is
  // none yet).
  shell.chooseAgent = (ws, agent, { cancel = false } = {}) => new Promise((resolve) => {
    choosing.get(ws.key)?.(null);
    choosing.set(ws.key, resolve);
    ws.project.window?.send('agent:choose', { ws: ws.key, selected: agent?.id ?? null, cancel });
  });
  shell.chooseAgent.cancel = (ws) => { choosing.get(ws.key)?.(null); choosing.delete(ws.key); };
  ipcMain.on('agent:chosen', (_e, { ws, id }) => { const r = choosing.get(ws); choosing.delete(ws); r?.(id ? shell.agentFor(id) : null); });
  ipcMain.handle('agent:change', (e) => at(e)?.ws?.changeAgent());
  // The agents to choose from; with check, whether each is installed (for the workspace's folder: its environment);
  // with details (the Agents window), also where it is and its version.
  ipcMain.handle('agents:list', async (e, { check, details } = {}) => {
    const w = at(e);
    const list = await Promise.all(known.map(async (a) => {
      const found = (check || details) && await agents.findAgent(a, w?.ws?.folder || app.getPath('home'));
      return {
        id: a.id, name: a.name, maker: a.maker, needs: a.needs, site: a.site, install: agents.installLine(a),
        ...((check || details) && { installed: !!found }),
        ...(details && { path: found?.path ?? null, onPath: found?.onPath ?? null, version: await agents.agentVersion(found) }),
      };
    }));
    return { list, main: w?.current?.main.store.agent().agent ?? custom?.id ?? null, home: app.getPath('home') };
  });
  // The maker's installer, run when the human clicks Install (that is their go-ahead); its output goes to the window.
  ipcMain.handle('agents:install', async (e, { id }) => {
    const w = at(e), a = shell.agentFor(id);
    if (!a?.install) return { error: `nothing to install for ${id}` };
    const code = await agents.installAgent(a, (data) => w?.send('agents:install-log', data));
    return { code, installed: !!(await agents.findAgent(a, w?.ws?.folder || app.getPath('home'))) };
  });

  // A window's handles on the profiles of its shown workspace (the editor, the panes): each only translates to the
  // workspace's own (workspaces.js), the same the agent's tools use (mcp-server.js). A refusal answers { error }.
  const noWs = { error: 'no workspace is open' };
  const wsOf = (e) => at(e)?.ws;
  const onProfile = (fn) => (e, { profile, ...args }) => { const r = wsOf(e)?.find(profile) || noWs; return r.error ? r : fn(r.profile, args); };
  const onTab = (fn) => (e, { profile, tab, ...args }) => { const r = wsOf(e)?.findTab(profile, tab) || noWs; return r.error ? r : fn(r.profile, r.tab, args); };
  ipcMain.handle('profile:new', (e, { name }) => wsOf(e)?.createProfile(name) || noWs);
  ipcMain.handle('profile:close', (e, { profile }) => wsOf(e)?.closeProfile(profile) || noWs);
  ipcMain.handle('profile:open', (e, { profile }) => wsOf(e)?.openProfile(profile) || noWs);
  ipcMain.handle('profile:rename', (e, { profile, name }) => wsOf(e)?.renameProfile(profile, name) || noWs);
  ipcMain.handle('profile:delete', (e, { profile }) => wsOf(e)?.deleteProfile(profile, 'human') || noWs);
  ipcMain.handle('views:hidden', (e, hidden, opts) => at(e)?.hideViews(hidden, opts));
  ipcMain.on('ask:answer', (e, { id, answer }) => at(e)?.answer(id, answer));
  ipcMain.handle('layout:load', (e) => wsOf(e)?.store.layout());
  ipcMain.on('layout:save', (e, { ws, layout }) => at(e)?.saveLayout(ws, layout));
  ipcMain.on('layout', (e, { ws, rects }) => at(e)?.layout(ws, rects));

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
  ipcMain.handle('tab:close', onTab((p, t) => p.closeTab(t.id)));
  ipcMain.handle('tab:activate', onTab((p, t) => p.activate(t.id)));
  ipcMain.handle('tab:navigate', onTab((p, t, { url }) => p.navigate(t.id, url)));
  ipcMain.handle('tab:back', onTab((p, t) => p.back(t.id)));
  ipcMain.handle('tab:forward', onTab((p, t) => p.forward(t.id)));
  ipcMain.handle('tab:reload', onTab((p, t) => p.reload(t.id)));
  ipcMain.handle('tab:devtools', onTab((p, t) => p.toggleDevTools(t.id)));
  ipcMain.handle('zoom:get', () => shell.uiZoom);
  ipcMain.handle('theme:set', (_e, theme) => ['dark', 'light', 'system'].includes(theme) && shell.setTheme(theme));
  ipcMain.handle('zoom:ui', (_e, dir) => shell.setUiZoom(stepZoom(shell.uiZoom, dir)));
  ipcMain.handle('tab:zoom', onTab((p, t, { dir }) => p.zoomSite(t.id, dir)));

  // Save session cookies and flush persistent ones before quitting, so sign-ins survive a restart; the windows and
  // their tabs open again at the next start.
  app.on('before-quit', async (e) => {
    if (quitting) return;
    e.preventDefault(); quitting = true;
    for (const w of shell.windows) w.pushState();
    for (const ws of allWorkspaces()) if (ws !== ws.project.window?.ws && ws.loaded) ws.list.saveTabs();
    shell.saveWindows();
    shell.stopAutosave?.();
    for (const p of allProfiles()) {
      await shell.sessionCookies?.persist(p);
      await p.disconnect();
    }
    for (const ws of allWorkspaces()) if (ws.pty) stopTerminal(ws.pty);
    app.quit();
  });
  process.on('SIGINT', () => app.quit());
  process.on('SIGTERM', () => app.quit());
  app.on('window-all-closed', () => app.quit());
  return ready;
}

module.exports = { start, CLAUDE_PLUGIN };
