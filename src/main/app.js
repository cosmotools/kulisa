// The Kulisa window: profile panes, the agent CLI in a terminal, point-and-tell, the CDP proxy and the MCP server.
// start(options) is used by the entry point (index.js) and by the tests.
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell: electronShell } = require('electron');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { stepZoom, zoomKey } = require('./profiles');
const { CdpProxy } = require('./cdp-proxy');
const { Store } = require('./store');
const { signinPages } = require('./signin-pages');
const { SessionCookies } = require('./session-cookies');
const { Workspace } = require('./workspaces');
const worktrees = require('./worktrees');
const agents = require('./agents');
const { nameError } = require('./names');
const { stopTerminal } = require('./terminal');

// Electron shows a blocking modal dialog on an uncaught main-process exception, which also stops the proxy and
// the MCP server; log instead.
process.on('uncaughtException', (e) => console.error('[kulisa] uncaught', e));
process.on('unhandledRejection', (e) => console.error('[kulisa] unhandled rejection', e));

const TITLE_BAR_HEIGHT = 44; // keep in sync with #topbar in styles.css
const WINDOW_COLOR = '#2b2d30'; // --window in styles.css
const NONE = new Map(); // the profiles when no project is open

// The Kulisa plugin's package for Claude Code (CLAUDE.md, Architecture, layer 3): the MCP config, a skill, hooks.
// Outside the asar archive when packaged (forge.config.js, extraResource), because claude reads it from disk.
const CLAUDE_PLUGIN = app.isPackaged ? path.join(process.resourcesPath, 'claude-plugin') : path.join(__dirname, '..', 'agent', 'claude-plugin');

// options:
//   userData   folder for Kulisa's data and browser profiles
//   project    the project's folder to open; default: the project opened last, else none (the window offers to open
//              one, as VS Code). Its main workspace's agent runs there
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
  const firstProject = options.project ? store.projectFor(path.resolve(options.project)) : store.lastProject();
  const bus = new EventEmitter(); // profile-added, agent-command, agent-action
  // The open project's workspaces by number (workspaces.js) and the one on screen (ws). The window's controls act on
  // the shown one: profiles, closed (its open and closed profiles by id), pty (its agent's terminal).
  // viewsHidden: true until the window has laid out the shown workspace's grid (the renderer then shows the views).
  const shell = { bus, store, viewsHidden: true, win: null, proxy: null, mcp: null, project: null, ws: null, workspaces: new Map(),
    signin: signinPages(options.signinHosts || []), git: null };
  Object.defineProperties(shell, {
    profiles: { get: () => shell.ws?.profiles || NONE },
    closed: { get: () => shell.ws?.closed || NONE },
    pty: { get: () => shell.ws?.pty || null },
    resumedSession: { get: () => shell.ws?.resumedSession ?? null },
  });
  const mimic = options.mimicChrome !== false;
  const appDevTools = options.appDevTools ?? !app.isPackaged;
  const send = (channel, data) => { if (shell.win && !shell.win.isDestroyed()) shell.win.webContents.send(channel, data); };

  let stateTimer = null;
  const scheduleState = () => { clearTimeout(stateTimer); stateTimer = setTimeout(pushState, 30); };
  function pushState() {
    const ws = shell.ws;
    if (!ws || switching) return;
    send('state', [...ws.profiles.values()].map((p) => p.info()));
    send('closed-profiles', [...ws.closed.values()].map(({ cfg, urls }) =>
      ({ key: cfg.folder, id: cfg.id, name: cfg.name, color: cfg.color, tabs: urls.length })));
    ws.list.saveTabs();
  }
  // A workspace's profiles changed (now: right away), or its agent's state (workspaces.js).
  shell.wsChanged = (ws, now, agentState) => {
    if (agentState) return sendWorkspaces();
    if (ws !== shell.ws) return ws.list.saveTabs();
    if (now) pushState(); else scheduleState();
  };

  // The Kulisa zoom: the whole window UI (Chromium's zoom of the shell's page), the OS title bar overlay with it, and
  // the profiles' pages, which follow it (profiles.js). The panes' boxes come in CSS pixels ('layout' below).
  shell.uiZoom = store.settings().uiZoom || 1;
  function setUiZoom(z) {
    shell.uiZoom = z;
    const win = shell.win;
    win.webContents.setZoomFactor(z);
    if (process.platform !== 'darwin') win.setTitleBarOverlay({ height: Math.round(TITLE_BAR_HEIGHT * z) }); // macOS: fixed buttons
    for (const p of allProfiles()) p.setBaseZoom(z);
    store.saveSettings({ ...store.settings(), uiZoom: z });
    win.webContents.send('zoom', z);
  }
  const allProfiles = () => [...shell.workspaces.values()].flatMap((ws) => [...ws.profiles.values()]);

  // ---------- projects and workspaces ----------
  // A project is a folder with its workspaces (store.js); one is open in the window at a time. Each workspace has its
  // profiles, grid and agent (workspaces.js); the window shows one, the others keep running. Opening another project
  // closes this one (tabs, sign-ins and grids saved, the agents stopped); showing another workspace hides this one's
  // pages. Either way the window builds the next grid in place (the page is not loaded again).
  // From then until the next workspace's profiles are all loaded: nothing is saved, and the window gets no state (a
  // partial one would build a grid other than the saved one).
  let switching = true;
  // Opening, showing, creating and closing run one after another.
  let queue = Promise.resolve();
  const serial = (fn) => { const r = queue.then(fn); queue = r.catch(() => {}); return r; };

  // What the window shows of the workspaces: their tabs (name, the agent's state), which is shown, and whether the
  // project can have forks (git: 'ok', 'no-commit', 'none'; null without a project).
  function sendWorkspaces() {
    send('workspaces', { current: shell.ws?.n ?? null, list: [...shell.workspaces.values()].map((w) => w.info()), git: shell.git });
  }
  async function checkGit() {
    const repo = shell.project && await worktrees.repoOf(shell.project);
    shell.git = !shell.project ? null : repo?.commit ? 'ok' : repo ? 'no-commit' : 'none';
  }
  async function openProject(p) {
    await store.openProject(p);
    shell.project = p.folder;
    shell.win.setTitle(`${p.name} — Kulisa`);
    send('projects', projectsInfo());
    const { list, current } = store.workspaces();
    for (const e of list) shell.workspaces.set(e.n, new Workspace(shell, e, p.folder));
    shell.ws = shell.workspaces.get(current) || shell.workspaces.get(1);
    await checkGit();
    sendWorkspaces();
    await showLoaded();
  }
  // The shown workspace: its profiles loaded (the first time it is shown), the window's grid built from its state
  // (terminal panel included, even with no profiles), then its agent started at the terminal's size.
  async function showLoaded() {
    const ws = shell.ws;
    if (!ws.loaded) await ws.loadProfiles();
    switching = false;
    pushState();
    // Not waited for: the human may first have to choose the agent (or switch away meanwhile).
    if (!ws.pty && !ws.starting) ws.starting = ws.startAgent().catch((e) => console.error('[agent]', e)).finally(() => { ws.starting = null; });
  }
  // The window takes the grid down; it gets the next workspace's state once its profiles are loaded. dir: where the
  // next one is in the strip (1 right, -1 left, 0 another project), for the window to slide that way.
  // Pictures of its pages come along, for the window to slide them out (and in when it comes back).
  async function leaveGrid(dir) {
    pushState(); // saves the tabs
    switching = true;
    clearTimeout(stateTimer);
    for (const { cancel } of shell.picking?.values() || []) cancel();
    const pics = dir ? await pictures() : null;
    shell.viewsHidden = true;
    for (const p of shell.profiles.values()) p.setHidden(true);
    send('grid:closing', { dir, ws: shell.ws.n, pics });
  }
  async function closeProject() {
    if (!shell.ws) return;
    await leaveGrid(0);
    for (const ws of shell.workspaces.values()) await ws.unload();
    shell.workspaces.clear();
    shell.ws = null;
  }
  async function showWorkspace(n) {
    const next = shell.workspaces.get(n);
    if (!next || next === shell.ws) return;
    await leaveGrid(Math.sign(next.n - shell.ws.n));
    shell.ws = next;
    store.saveWorkspaces({ ...store.workspaces(), current: n });
    sendWorkspaces();
    await showLoaded();
  }
  // A fork of main (whichever workspace is shown): a worktree with its own branch, copies of main's profiles, a new
  // agent session in its folder; a port offset no other workspace of the project has. Then it is shown.
  async function createWorkspace(name, agent) {
    name = name?.trim();
    const bad = nameError(name);
    if (bad) return { error: bad };
    const main = shell.workspaces.get(1);
    let wt;
    try { wt = await worktrees.createWorktree(main.folder, name); } catch (e) { return { error: e.stderr || e.message }; }
    const w = store.workspaces();
    const n = w.next;
    let offset = 100;
    while (w.list.some((e) => (e.offset || 0) === offset)) offset += 100;
    const entry = { n, name, branch: wt.branch, worktree: wt.worktree, folder: wt.folder, base: wt.base, offset };
    await main.forkProfilesInto(store.workspace(n), offset);
    store.workspace(n).saveAgent({ agent: agent || main.store.agent().agent });
    store.saveWorkspaces({ ...w, next: n + 1, list: [...w.list, entry] });
    shell.workspaces.set(n, new Workspace(shell, entry, main.folder));
    await showWorkspace(n);
    return { n };
  }
  // Closing a fork deletes it: its worktree, branch, profile copies and conversation. The human confirms first, told
  // what goes and what work not in main goes with it (deleteQuestion). Main is the project itself: closing it closes
  // the project (the Welcome screen).
  async function closeWorkspace(n) {
    const ws = shell.workspaces.get(n);
    if (!ws) return { error: `no workspace ${n}` };
    if (ws.main) { await leaveProject(); return { n }; }
    const main = shell.workspaces.get(1);
    const what = changesText(await worktrees.changes(main.folder, ws.entry));
    const ok = await ask(deleteQuestion({ message: `Delete the workspace ${ws.name}?`, ok: 'Delete', goes: [
      `its folder ${ws.entry.worktree}`, `its branch ${ws.entry.branch}`, 'its profiles (copies of main\'s) with their sign-ins',
      "its agent's conversations in that folder"], notInMain: what && [what] }));
    if (!ok) return { error: 'the human said no' };
    if (shell.ws === ws) await showWorkspace(1);
    await ws.unload();
    shell.workspaces.delete(n);
    const w = store.workspaces();
    store.saveWorkspaces({ ...w, current: shell.ws.n, list: w.list.filter((e) => e.n !== n) });
    await deleteWorkspace(store.project, ws.entry);
    sendWorkspaces();
    return { n };
  }
  // A workspace deleted for good, the one way it is done (closing a fork, removing a project), once it is not running:
  // a fork's worktree folder and branch (worktrees.js) and all its agent keeps of its folder (agents.js, forget); its data
  // folder, profiles with their sign-ins included. Main: its data only; the project's folder stays, and so does what
  // its agent keeps of the project (the human's own, as without Kulisa).
  async function deleteWorkspace(p, entry) {
    const data = store.workspaceOf(p, entry.n);
    if (entry.n !== 1) {
      if (entry.worktree) await worktrees.removeWorktree(p.folder, entry);
      const saved = data.agent();
      const main = { folder: p.folder, ...store.workspaceOf(p, 1).agent() };
      try { shell.agentFor(saved.agent)?.forget?.({ folder: entry.folder, saved, main }); } catch (e) { console.warn('[agents] forget:', e.message); }
    }
    // Its profiles' sessions stay open in Electron until Kulisa quits: whatever cannot go now goes at the next start.
    store.markDeleted(data.dir);
    try { fs.rmSync(data.dir, { recursive: true, force: true }); } catch (e) { console.warn('[workspaces]', e.message); }
  }
  // The question before deleting, the same for a workspace and a project: what goes for good, the work not in main
  // that goes with it, what stays.
  const deleteQuestion = ({ message, ok, goes, notInMain, stays }) => ({ message, ok, danger: true, detail: [
    `Deleted for good:\n${goes.map((g) => `• ${g}`).join('\n')}`,
    notInMain?.length && `Work not in main, deleted with it:\n${notInMain.map((g) => `• ${g}`).join('\n')}`,
    stays,
  ].filter(Boolean).join('\n\n') });
  // What a fork has that main has not, in words; '' when nothing.
  const changesText = ({ commits, dirty }) => [commits && `${commits} commit${commits === 1 ? '' : 's'} of its own`,
    dirty && `${dirty} uncommitted file${dirty === 1 ? '' : 's'}`].filter(Boolean).join(' and ');
  // Removing a project, from wherever the window asks for it: each of its workspaces deleted (deleteWorkspace, forks
  // first), then what is the project's as a whole (store.js: its entry, its data folder). Never the project's own
  // folder. The human confirms, told what goes and which forks have work not in main; then the project is closed if
  // it is open, and removed.
  async function removeProject(id) {
    const p = store.projects().find((x) => x.id === id);
    if (!p) return { error: `no project ${id}` };
    const all = store.workspacesOf(p).list;
    const forks = all.filter((e) => e.n !== 1);
    const changed = [];
    for (const e of forks) {
      const what = changesText(await worktrees.changes(p.folder, e));
      if (what) changed.push(`${e.name}: ${what}`);
    }
    const ok = await ask(deleteQuestion({ message: `Remove the project ${p.name}?`, ok: 'Remove', goes: [
      'its profiles with their sign-ins, and its layouts',
      ...forks.map((e) => `its workspace ${e.name}: the folder ${e.worktree}, the branch ${e.branch}, its profiles and its agent's conversations`)],
    notInMain: changed, stays: `The project's folder ${p.folder} stays as it is.` }));
    if (!ok) return { error: 'the human said no' };
    if (store.project?.id === id) await leaveProject();
    for (const e of [...forks, ...all.filter((x) => x.n === 1)]) await deleteWorkspace(p, e);
    store.removeProject(p);
    send('projects', projectsInfo());
    return { id };
  }
  // No project open: the Welcome screen (Close Project, or main closed).
  async function leaveProject() {
    await closeProject();
    store.closeProject();
    shell.project = null;
    shell.git = null;
    shell.win.setTitle('Kulisa');
    send('projects', projectsInfo());
    sendWorkspaces();
  }
  // The window's page, loaded once; the first project's name and color come along in the URL, so the title bar is
  // drawn right at once. The profiles' views stay hidden until the renderer has the grid laid out (views:hidden).
  const loadWindow = (p) => shell.win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'),
    { query: { version: require('../../package.json').version, ...(p ? { project: JSON.stringify({ name: p.name, color: p.color }) } : {}) } });
  shell.openProject = (p) => serial(async () => {
    if (p.id === store.project?.id) return;
    await closeProject();
    await openProject(p);
  });
  shell.showWorkspace = (n) => serial(() => showWorkspace(n));
  shell.createWorkspace = (name, agent) => serial(() => createWorkspace(name, agent));
  shell.closeWorkspace = (n) => serial(() => closeWorkspace(n));
  shell.closeProject = () => serial(leaveProject);
  shell.removeProject = (id) => serial(() => removeProject(id));
  const projectsInfo = () => ({ current: store.project?.id ?? null, projects: store.projects() });
  ipcMain.handle('projects:list', projectsInfo);
  // The switch runs on its own; the renderer hears about it through grid:closing, projects, workspaces and state.
  const openLater = (p) => { setImmediate(() => shell.openProject(p).catch((e) => console.error('[project]', e))); return projectsInfo(); };
  ipcMain.handle('project:open', (_e, { id, folder }) => {
    const p = id ? store.projects().find((x) => x.id === id) : folder && fs.existsSync(folder) ? store.projectFor(path.resolve(folder)) : null;
    return p ? openLater(p) : { error: 'no such project' };
  });
  ipcMain.handle('project:open-folder', async () => {
    const r = await dialog.showOpenDialog(shell.win, { title: 'Open a project folder', properties: ['openDirectory', 'createDirectory'] });
    return r.canceled || !r.filePaths[0] ? projectsInfo() : openLater(store.projectFor(r.filePaths[0]));
  });
  // New Project…, as JetBrains': the folder <location>/<name>, the location the home folder unless the human picks
  // another, so they know where the agent's files are. A folder that is there already must be empty; git init in it
  // when asked (workspaces need git).
  ipcMain.handle('project:new-defaults', () => ({ location: options.projectsHome || app.getPath('home'), sep: path.sep }));
  ipcMain.handle('project:pick-location', async (_e, { location }) => {
    const r = await dialog.showOpenDialog(shell.win, { title: 'Where to create the project', defaultPath: location, properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0] || null;
  });
  ipcMain.handle('project:new', async (_e, { name, location, git }) => {
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
    if (git) await worktrees.initRepo(folder).catch((e) => console.error('[git]', e.message));
    return openLater(store.projectFor(folder, name));
  });
  ipcMain.handle('project:close', () => shell.closeProject());
  ipcMain.handle('project:remove', (_e, { id }) => shell.removeProject(id));
  ipcMain.handle('ws:show', (_e, n) => shell.showWorkspace(n));
  ipcMain.handle('ws:new', (_e, { name, agent }) => shell.createWorkspace(name, agent));
  ipcMain.handle('ws:close', (_e, n) => shell.closeWorkspace(n));
  // git init in the project's folder, only on the human's click, after they confirm.
  ipcMain.handle('ws:git-init', async () => {
    if (!shell.project || shell.git !== 'none') return;
    const ok = await ask({ message: `Initialize git in ${shell.project}?`, ok: 'Initialize git',
      detail: 'Workspaces need git: each one is a branch of the project in a folder of its own. Kulisa runs git init there and commits nothing; make the first commit yourself.' });
    if (!ok) return;
    await worktrees.initRepo(shell.project).catch((e) => console.error('[git]', e.message));
    await checkGit();
    sendWorkspaces();
  });
  // The window asks again when the pointer comes to the strip: the human may have made the first commit meanwhile.
  ipcMain.handle('workspaces:get', async () => { await checkGit(); sendWorkspaces(); });

  const ready = app.whenReady().then(async () => {
    const win = (shell.win = new BrowserWindow({
      width: 1700, height: 1050, title: 'Kulisa', backgroundColor: WINDOW_COLOR,
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'), // taskbar and window switcher on Linux and Windows
      // One row on top, as in VS Code: no system title bar; the OS window buttons are drawn over the right end of
      // the window's own top bar (left on macOS). The page lays out around them (Window Controls Overlay).
      titleBarStyle: 'hidden', titleBarOverlay: { color: WINDOW_COLOR, symbolColor: '#dfe1e5', height: Math.round(TITLE_BAR_HEIGHT * shell.uiZoom) },
      // DevTools of Kulisa's own UI only while developing it; a packaged build has none (profiles' tabs still do).
      webPreferences: { preload: path.join(__dirname, '..', 'preload', 'index.js'), sandbox: false, devTools: appDevTools,
        zoomFactor: shell.uiZoom },
    }));
    // Electron's default File/Edit/View/Window menu adds a row on Linux and Windows and gives nothing (its Ctrl+R
    // reloads the shell). On macOS the menu lives in the system bar and stays (Cmd+C/V need its Edit roles).
    win.removeMenu();
    // Links in the window (the Welcome screen's: the website, GitHub) open in the user's browser; the window itself
    // never leaves its page.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//.test(url)) electronShell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    // Questions the page was asking go unanswered once it is gone or loaded again (shell.ask).
    win.webContents.on('render-process-gone', unanswered);
    win.webContents.on('did-start-navigation', (d) => { if (d.isMainFrame && !d.isSameDocument) unanswered(); });
    // F12 or Ctrl+Shift+I anywhere outside a profile's page (bars, terminal): DevTools of Kulisa's own UI.
    win.webContents.on('before-input-event', (e, i) => {
      // Ctrl + / - / 0 outside the pages: the Kulisa zoom.
      const dir = zoomKey(i);
      if (dir !== undefined) { e.preventDefault(); setUiZoom(stepZoom(shell.uiZoom, dir)); }
      if (appDevTools && i.type === 'keyDown' && (i.key === 'F12' || ((i.control || i.meta) && i.shift && i.key.toLowerCase() === 'i'))) {
        e.preventDefault();
        const wc = win.webContents;
        // Detached like the profiles' DevTools: docked ones would sit under the profile views.
        if (wc.isDevToolsOpened()) wc.closeDevTools(); else wc.openDevTools({ mode: 'detach', title: 'Kulisa · DevTools' });
      }
    });
    shell.sessionCookies = new SessionCookies();
    shell.proxy = new CdpProxy();
    await shell.proxy.listen(0);
    shell.proxy.on('command', (c) => bus.emit('agent-command', c));
    await loadWindow(firstProject);
    const mimicChrome = require('./mimic-chrome');
    shell.chromeIdentity = mimic ? mimicChrome.chromeIdentity(await mimicChrome.nativeIdentity(win.webContents)) : null;
    shell.mcp = await require('./mcp-server').startMcpServer(shell, { port: options.mcpPort ?? 4450 });
    require('./picker').installPicker(shell);
    require('./ghost').installGhost(shell);

    if (firstProject) await serial(() => openProject(firstProject));
    else { send('projects', projectsInfo()); sendWorkspaces(); }
    shell.stopAutosave = shell.sessionCookies.autosave(allProfiles);
    shell.screenshot = (file) => screenshotWindow(win, file);
    // KULISA_SHOT=<file.png>: save a screenshot of the window a few seconds after start (for checking UI changes).
    if (process.env.KULISA_SHOT) setTimeout(() => shell.screenshot(process.env.KULISA_SHOT).catch((e) => console.error('[shot]', e.message)), Number(process.env.KULISA_SHOT_DELAY || 4000));
    pushState();
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
  const choosing = new Map(); // workspace number -> resolve(agent or null)
  // cancel: the human may leave it as it is (changing the agent; not when there is none yet).
  shell.chooseAgent = (ws, agent, { cancel = false } = {}) => new Promise((resolve) => {
    choosing.get(ws.n)?.(null);
    choosing.set(ws.n, resolve);
    send('agent:choose', { ws: ws.n, selected: agent?.id ?? null, cancel });
  });
  shell.chooseAgent.cancel = (ws) => { choosing.get(ws.n)?.(null); choosing.delete(ws.n); };
  ipcMain.on('agent:chosen', (_e, { ws, id }) => { const r = choosing.get(ws); choosing.delete(ws); r?.(id ? shell.agentFor(id) : null); });
  ipcMain.handle('agent:change', () => shell.ws?.changeAgent());
  // The agents to choose from; with check, whether each is installed (for the workspace's folder: its environment).
  ipcMain.handle('agents:list', async (_e, { check } = {}) => Promise.all(known.map(async (a) => ({
    id: a.id, name: a.name, maker: a.maker, needs: a.needs, install: agents.installLine(a),
    ...(check && { installed: !!(await agents.findAgent(a, shell.ws?.folder || app.getPath('home'))) }),
  }))).then((list) => ({ list, main: shell.workspaces.get(1)?.store.agent().agent ?? custom?.id ?? null })));
  // The maker's installer, run when the human clicks Install (that is their go-ahead); its output goes to the window.
  ipcMain.handle('agents:install', async (_e, { id }) => {
    const a = shell.agentFor(id);
    if (!a?.install) return { error: `nothing to install for ${id}` };
    const code = await agents.installAgent(a, (data) => send('agents:install-log', data));
    return { code, installed: !!(await agents.findAgent(a, shell.ws?.folder || app.getPath('home'))) };
  });

  // Profiles of the shown workspace: from the editor and the panes. Closed profiles stay closed across restarts.
  shell.createProfile = (name) => shell.ws.createProfile(name);
  shell.closeProfile = (id) => shell.ws.closeProfile(id);
  shell.openProfile = (id) => shell.ws.openProfile(id);
  shell.deleteProfile = (id) => shell.ws.deleteProfile(id); // the human confirms first: the editor, or agentDeletesProfile
  ipcMain.handle('profile:new', (_e, { name }) => shell.ws?.createProfile(name));
  ipcMain.handle('profile:close', (_e, { profile }) => shell.ws?.closeProfile(profile));
  ipcMain.handle('profile:open', (_e, { profile }) => shell.ws?.openProfile(profile));
  ipcMain.handle('profile:rename', (_e, { profile, name }) => shell.ws?.list.rename(profile, name));
  ipcMain.handle('profile:delete', (_e, { profile }) => shell.ws?.deleteProfile(profile));
  // The profile editor and the grid's drop targets are HTML; the profiles' views are native and draw above it,
  // so hide them meanwhile. With snapshots: first a picture of each page on screen, for the renderer to show in
  // its place ({ profile id: data URL }).
  async function pictures() {
    const pics = {};
    await Promise.all([...shell.profiles.values()].filter((p) => p.visible() && p.get()).map(async (p) => {
      pics[p.id] = (await p.get().wc.capturePage().catch(() => null))?.toDataURL();
    }));
    return pics;
  }
  ipcMain.handle('views:hidden', async (_e, hidden, { snapshots = false } = {}) => {
    const pics = hidden && snapshots ? await pictures() : {};
    // While a project or a workspace is being switched they stay hidden, whatever comes (a closing menu shows them
    // again); the window shows them once it has the next grid laid out.
    shell.viewsHidden = !!hidden || switching;
    for (const p of shell.profiles.values()) p.setHidden(shell.viewsHidden);
    return pics;
  });
  // A question with a button that does it and Cancel (deleting a profile, a workspace, a project), asked in the
  // window's own dialog (ask.js), as all of Kulisa's dialogs look. No answer (the window's page gone) is a no.
  const answers = new Map(); // question id -> resolve
  let questions = 0;
  shell.ask = ({ message, detail, ok, danger }) => new Promise((resolve) => {
    const id = ++questions;
    answers.set(id, resolve);
    shell.win.webContents.send('ask', { id, message, detail, ok, danger });
  });
  const ask = (q) => shell.ask(q); // through shell: the tests answer it
  const unanswered = () => { for (const resolve of answers.values()) resolve(false); answers.clear(); };
  ipcMain.on('ask:answer', (_e, { id, ok }) => { answers.get(id)?.(ok === true); answers.delete(id); });
  ipcMain.handle('confirm', (_e, q) => ask(q));
  ipcMain.handle('layout:load', () => shell.ws?.store.layout());
  ipcMain.on('layout:save', (_e, { ws, layout }) => { if (!switching && ws === shell.ws?.n) shell.ws.store.saveLayout(layout); });

  const P = (id) => shell.profiles.get(id);
  ipcMain.handle('tab:new', (_e, { profile, url }) => { P(profile)?.newTab(url || 'about:blank'); });
  ipcMain.handle('tab:close', (_e, { profile, tab }) => P(profile)?.closeTab(tab));
  ipcMain.handle('tab:activate', (_e, { profile, tab }) => P(profile)?.activate(tab));
  ipcMain.handle('tab:navigate', (_e, { profile, tab, url }) => P(profile)?.navigate(tab, normalizeUrl(url)));
  ipcMain.handle('tab:back', (_e, { profile, tab }) => P(profile)?.back(tab));
  ipcMain.handle('tab:forward', (_e, { profile, tab }) => P(profile)?.forward(tab));
  ipcMain.handle('tab:reload', (_e, { profile, tab }) => P(profile)?.reload(tab));
  ipcMain.handle('tab:devtools', (_e, { profile, tab }) => P(profile)?.toggleDevTools(tab));
  ipcMain.on('layout', (_e, { ws, rects }) => {
    if (ws !== shell.ws?.n) return; // a workspace no longer on screen
    const z = shell.win.webContents.getZoomFactor();
    for (const [id, r] of Object.entries(rects)) P(id)?.layout(r.shown === false ? r : Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * z)])));
  });
  ipcMain.handle('zoom:get', () => shell.uiZoom);
  ipcMain.handle('zoom:ui', (_e, dir) => setUiZoom(stepZoom(shell.uiZoom, dir)));
  ipcMain.handle('tab:zoom', (_e, { profile, tab, dir }) => P(profile)?.zoomSite(tab, dir));

  // Save session cookies and flush persistent ones before quitting, so sign-ins survive a restart.
  let quitting = false;
  app.on('before-quit', async (e) => {
    if (quitting) return;
    e.preventDefault(); quitting = true;
    if (!switching) pushState();
    for (const ws of shell.workspaces.values()) if (ws !== shell.ws) ws.list.saveTabs();
    shell.stopAutosave?.();
    for (const p of allProfiles()) {
      await shell.sessionCookies?.persist(p);
      await p.disconnect();
    }
    for (const ws of shell.workspaces.values()) if (ws.pty) stopTerminal(ws.pty);
    app.quit();
  });
  process.on('SIGINT', () => app.quit());
  process.on('SIGTERM', () => app.quit());
  app.on('window-all-closed', () => app.quit());
  return ready;
}

// The whole window, profile views included (BrowserWindow.capturePage misses WebContentsViews), captured like a
// screen recorder would.
async function screenshotWindow(win, file) {
  const [width, height] = win.getContentSize();
  const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width, height } });
  const source = sources.find((s) => s.id === win.getMediaSourceId());
  if (!source) throw new Error('window not found among capture sources');
  fs.writeFileSync(file, source.thumbnail.toPNG());
  console.log('[kulisa] screenshot', file);
  return file;
}

function normalizeUrl(u) {
  if (/^[a-z]+:/i.test(u)) return u;
  if (/^(localhost|127\.)/.test(u)) return 'http://' + u;
  if (/^[\w.-]+(:\d+)?(\/|$)/.test(u)) return 'https://' + u;
  return 'https://www.google.com/search?q=' + encodeURIComponent(u);
}

module.exports = { start, CLAUDE_PLUGIN };
