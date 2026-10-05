// The Kulisa window: profile panes, the agent CLI in a terminal, point-and-tell, the CDP proxy and the MCP server.
// start(options) is used by the entry point (index.js) and by the tests.
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { Profile, stepZoom, zoomKey, wipeSession } = require('./profiles');
const { CdpProxy } = require('./cdp-proxy');
const { Store } = require('./store');
const { installSigninPause } = require('./signin-pause');
const { signinPages } = require('./signin-pages');
const { SessionCookies } = require('./session-cookies');
const { startTerminal, stopTerminal } = require('./terminal');
const { clearHighlights } = require('./mcp-server');

// Electron shows a blocking modal dialog on an uncaught main-process exception, which also stops the proxy and
// the MCP server; log instead.
process.on('uncaughtException', (e) => console.error('[kulisa] uncaught', e));
process.on('unhandledRejection', (e) => console.error('[kulisa] unhandled rejection', e));

const TITLE_BAR_HEIGHT = 44; // keep in sync with #topbar in styles.css
const WINDOW_COLOR = '#2b2d30'; // --window in styles.css
const COLORS = ['#e5534b', '#57ab5a', '#539bf5', '#d29922', '#b083f0', '#39c5cf', '#f778ba'];

// The agent bridge for Claude Code (CLAUDE.md, Architecture, layer 3): a plugin with the MCP config and a skill.
// Outside the asar archive when packaged (forge.config.js, extraResource), because claude reads it from disk.
const CLAUDE_PLUGIN = app.isPackaged ? path.join(process.resourcesPath, 'claude-plugin') : path.join(__dirname, '..', 'agent', 'claude-plugin');

// options:
//   userData   folder for Kulisa's data and browser profiles
//   project    the project's folder to open; default: the project opened last, else defaultFolder. The agent runs
//              there and notes go to <project>/.kulisa/notes
//   defaultFolder  the project at first start (and the one data from before projects goes to)
//   agent      { command, args, resume } to run in the terminal; default: claude with the Kulisa plugin
//              (src/agent). resume(sessionId) gives the arguments that continue a session.
//   mcpPort    port of the MCP server (default 4450)
//   mimicChrome  present profiles as Google Chrome (default true)
//   signinHosts  extra sign-in hosts (sign-in pause, tab restore)
function start(options = {}) {
  const userData = options.userData || path.join(app.getPath('appData'), 'Kulisa');
  const defaultFolder = path.resolve(options.defaultFolder || process.cwd());
  app.setPath('userData', userData);
  const store = new Store(userData, { defaultFolder });
  const firstProject = options.project ? store.projectFor(path.resolve(options.project)) : store.lastProject() || store.projectFor(defaultFolder);
  const bus = new EventEmitter(); // profile-added, agent-command, agent-action
  // viewsHidden: true until the window has laid out its grid (the renderer then shows the views, see loadWindow).
  // closed: profiles of the project the human closed (no tabs, no memory; sign-ins kept): id -> { cfg, urls }.
  const shell = { bus, store, profiles: new Map(), closed: new Map(), viewsHidden: true, win: null, proxy: null, pty: null, mcp: null,
    project: null, notesDir: null };
  const mimic = options.mimicChrome !== false;
  const appDevTools = options.appDevTools ?? !app.isPackaged;
  const signin = signinPages(options.signinHosts || []);

  let stateTimer = null;
  const scheduleState = () => { clearTimeout(stateTimer); stateTimer = setTimeout(pushState, 30); };
  function pushState() {
    if (!shell.win || shell.win.isDestroyed() || switching) return;
    shell.win.webContents.send('state', [...shell.profiles.values()].map((p) => p.info()));
    shell.win.webContents.send('closed-profiles', [...shell.closed.values()].map(({ cfg, urls }) =>
      ({ key: cfg.partition, id: cfg.id, name: cfg.name, color: cfg.color, tabs: urls.length })));
    const tabs = Object.fromEntries([...shell.closed].map(([id, c]) => [id, c.urls]));
    for (const p of shell.profiles.values()) tabs[p.id] = savedUrls(p);
    store.saveTabs(tabs);
  }
  // Where a profile's tabs are, to open them again. Sign-in pages are one-time URLs: where the sign-in started
  // instead (signin-pages.js). A tab still loading: the URL it is opening.
  const savedUrls = (p) => p.tabs.filter((t) => !t.wc.isDestroyed()).map((t) => signin.restoreUrl(t.wc) || t.pendingUrl).filter((u) => u && u !== 'about:blank');
  const saveProfiles = () => store.saveProfiles([...shell.profiles.values(),
    ...[...shell.closed.values()].map(({ cfg }) => ({ ...cfg, siteZoom: cfg.zoom, closed: true }))]);

  // The Kulisa zoom: the whole window UI (Chromium's zoom of the shell's page), the OS title bar overlay with it, and
  // the profiles' pages, which follow it (profiles.js). The panes' boxes come in CSS pixels ('layout' below).
  shell.uiZoom = store.settings().uiZoom || 1;
  function setUiZoom(z) {
    shell.uiZoom = z;
    const win = shell.win;
    win.webContents.setZoomFactor(z);
    if (process.platform !== 'darwin') win.setTitleBarOverlay({ height: Math.round(TITLE_BAR_HEIGHT * z) }); // macOS: fixed buttons
    for (const p of shell.profiles.values()) p.setBaseZoom(z);
    store.saveSettings({ ...store.settings(), uiZoom: z });
    win.webContents.send('zoom', z);
  }

  async function addProfile(cfg, urls = ['about:blank']) {
    const profile = new Profile(shell.win, cfg, { mimic: shell.chromeIdentity });
    profile.hidden = shell.viewsHidden;
    shell.profiles.set(profile.id, profile);
    shell.proxy.addProfile(profile);
    profile.endpoint = shell.proxy.endpoint(profile.id);
    profile.setBaseZoom(shell.uiZoom);
    profile.on('changed', scheduleState);
    profile.on('zoom', saveProfiles);
    installSigninPause(profile, signin.isSigninUrl);
    await shell.sessionCookies.restore(profile); // before the first request of any tab
    await Promise.all(urls.map((u, i) => profile.newTab(u, { activate: i === 0 }).ready));
    if (!profile.signinMode) await profile.connect(profile.endpoint);
    bus.emit('profile-added', profile);
    profile.on('signin-mode', (on) => { if (!on) bus.emit('profile-added', profile); });
    return profile;
  }

  // The first color no profile uses yet.
  const nextColor = () => {
    const used = new Set([...shell.profiles.values(), ...[...shell.closed.values()].map((c) => c.cfg)].map((p) => p.color));
    return COLORS.find((c) => !used.has(c)) || COLORS[shell.profiles.size % COLORS.length];
  };

  const idFor = (name, except) => {
    const base = name.trim().toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '') || 'profile';
    let id = base, n = 2;
    while ((shell.profiles.has(id) || shell.closed.has(id)) && id !== except) id = `${base}-${n++}`;
    return id;
  };

  // ---------- projects ----------
  // A project is a folder with its own profiles, grid and agent (store.js). One is open in the window at a time;
  // opening another closes this one (tabs, sign-ins and the grid saved, the agent stopped) and the window builds the
  // other's grid in place (the page is not loaded again: the title bar and the terminal stay).
  // From closing a project (or the start) until the next project's profiles are all loaded: nothing is saved, and the
  // window gets no state (a partial one would build a grid other than the saved one).
  let switching = true;
  async function loadProfiles(p) {
    store.openProject(p);
    shell.project = p.folder;
    shell.notesDir = path.join(p.folder, '.kulisa', 'notes');
    shell.win.setTitle(`${p.name} — Kulisa`);
    shell.win.webContents.send('projects', projectsInfo());
    const tabs = store.tabs();
    for (const cfg of store.profiles()) {
      if (cfg.closed) shell.closed.set(cfg.id, { cfg, urls: tabs[cfg.id] || [] });
      else await addProfile(cfg, tabs[cfg.id]?.length ? tabs[cfg.id] : ['about:blank']);
    }
    switching = false;
    pushState(); // the renderer builds the grid, terminal panel included, on the first state, even with no profiles
  }
  // The agent in the project's folder; Claude Code continues the project's last conversation, if it has one.
  async function startAgent() {
    const { sessionId, transcript } = store.agent();
    const resume = sessionId && transcript && fs.existsSync(transcript) && shell.agent.resume?.(sessionId);
    shell.resumedSession = resume ? sessionId : null;
    shell.pty = await startTerminal(shell.win, { ...shell.agent, args: [...(shell.agent.args || []), ...(resume || [])], cwd: shell.project });
  }
  // The agent's hooks report its session (agent-hooks.js).
  shell.agentSession = (s) => { if (store.projectDir && !switching) store.saveAgent(s); };
  async function closeProject() {
    pushState(); // saves the tabs
    switching = true;
    shell.viewsHidden = true; // until the renderer has the next grid laid out
    for (const p of shell.profiles.values()) p.setHidden(true);
    shell.win.webContents.send('project:closing');
    clearTimeout(stateTimer);
    for (const { cancel } of shell.picking?.values() || []) cancel();
    if (shell.pty) { stopTerminal(shell.pty); shell.pty = null; }
    for (const p of [...shell.profiles.values()]) await unload(p);
    shell.profiles.clear();
    shell.closed.clear();
  }
  // A profile's tabs closed and its automation gone; its sign-ins saved (session cookies too) for when it opens again.
  async function unload(p) {
    await clearHighlights(p.id);
    await shell.sessionCookies.save(p).catch((err) => console.error('[session-cookies]', err.message));
    await p.session.cookies.flushStore().catch(() => {});
    shell.proxy.removeProfile(p);
    await p.close();
  }
  // The window's page, loaded once; the first project's name and color come along in the URL, so the title bar is
  // drawn right at once. The profiles' views stay hidden until the renderer has the grid laid out (views:hidden).
  const loadWindow = (p) => shell.win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'),
    { query: { project: JSON.stringify({ name: p.name, color: p.color }) } });
  shell.openProject = async (p) => {
    if (p.id === store.project?.id) return;
    await closeProject();
    await loadProfiles(p);
    await startAgent();
  };
  const projectsInfo = () => ({ current: store.project?.id, projects: store.projects() });
  ipcMain.handle('projects:list', projectsInfo);
  // The switch runs on its own; the renderer hears about it through project:closing, projects and state.
  const openLater = (p) => { setImmediate(() => shell.openProject(p).catch((e) => console.error('[project]', e))); return projectsInfo(); };
  ipcMain.handle('project:open', (_e, { id, folder }) => {
    const p = id ? store.projects().find((x) => x.id === id) : folder && fs.existsSync(folder) ? store.projectFor(path.resolve(folder)) : null;
    return p ? openLater(p) : { error: 'no such project' };
  });
  ipcMain.handle('project:open-folder', async () => {
    const r = await dialog.showOpenDialog(shell.win, { title: 'Open a project folder', properties: ['openDirectory', 'createDirectory'] });
    return r.canceled || !r.filePaths[0] ? projectsInfo() : openLater(store.projectFor(r.filePaths[0]));
  });
  // A project for someone without a repository: Kulisa makes its folder, ~/Kulisa/<name>.
  ipcMain.handle('project:new', (_e, { name }) => {
    name = name?.trim();
    if (!name) return { error: 'no name' };
    const folder = path.join(options.projectsHome || path.join(app.getPath('home'), 'Kulisa'), name.replace(/[\\/:*?"<>|]+/g, '-'));
    fs.mkdirSync(folder, { recursive: true });
    return openLater(store.projectFor(folder, name));
  });

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
    shell.sessionCookies = new SessionCookies(path.join(userData, 'session-cookies'));
    shell.proxy = new CdpProxy();
    await shell.proxy.listen(0);
    shell.proxy.on('command', (c) => bus.emit('agent-command', c));
    await loadWindow(firstProject);
    const mimicChrome = require('./mimic-chrome');
    shell.chromeIdentity = mimic ? mimicChrome.chromeIdentity(await mimicChrome.nativeIdentity(win.webContents)) : null;

    await loadProfiles(firstProject);

    require('./picker').installPicker(shell);
    require('./ghost').installGhost(shell);
    shell.mcp = await require('./mcp-server').startMcpServer(shell, { port: options.mcpPort ?? 4450 });
    // The plugin reads where Kulisa is from the environment: .mcp.json from KULISA_MCP_URL, its hooks from
    // KULISA_URL. Other agent CLIs can use them too.
    shell.agent = { ...(options.agent || { command: 'claude', args: ['--plugin-dir', CLAUDE_PLUGIN], resume: (id) => ['--resume', id] }),
      env: { KULISA_MCP_URL: shell.mcp.url, KULISA_URL: shell.mcp.base } };
    await startAgent();
    shell.stopAutosave = shell.sessionCookies.autosave(() => shell.profiles.values());
    shell.screenshot = (file) => screenshotWindow(win, file);
    // KULISA_SHOT=<file.png>: save a screenshot of the window a few seconds after start (for checking UI changes).
    if (process.env.KULISA_SHOT) setTimeout(() => shell.screenshot(process.env.KULISA_SHOT).catch((e) => console.error('[shot]', e.message)), Number(process.env.KULISA_SHOT_DELAY || 4000));
    pushState();
    return shell;
  });

  // A new profile; from the editor and from the agent (MCP profile_create).
  shell.createProfile = async (name) => {
    if (!name || !name.trim()) return { error: 'no name' };
    const id = idFor(name);
    await addProfile({ id, name: name.trim(), color: nextColor(), partition: store.freePartition(id) });
    saveProfiles(); pushState();
    return { id };
  };
  ipcMain.handle('profile:new', (_e, { name }) => shell.createProfile(name));
  // Close: the pane and tabs go (their memory too); the profile stays in the project, signed in, and opens again with
  // the same tabs (by the human, or the agent: profile_open). Closed profiles stay closed across restarts.
  shell.closeProfile = async (id) => {
    const p = shell.profiles.get(id);
    if (!p) return { error: `no open profile ${id}` };
    shell.picking?.get(id)?.cancel();
    const urls = savedUrls(p);
    shell.profiles.delete(id);
    shell.closed.set(id, { cfg: { id, name: p.name, color: p.color, partition: p.partition, zoom: p.siteZoom }, urls });
    await unload(p);
    saveProfiles(); pushState();
    return { id };
  };
  shell.openProfile = async (id) => {
    const c = shell.closed.get(id);
    if (!c) return shell.profiles.has(id) ? { id } : { error: `no profile ${id}` };
    shell.closed.delete(id);
    await addProfile(c.cfg, c.urls.length ? c.urls : ['about:blank']);
    saveProfiles(); pushState();
    return { id };
  };
  ipcMain.handle('profile:close', (_e, { profile }) => shell.closeProfile(profile));
  ipcMain.handle('profile:open', (_e, { profile }) => shell.openProfile(profile));
  // Rename: new name and id; the profile (partition), tabs and the agent connection stay.
  ipcMain.handle('profile:rename', async (_e, { profile: oldId, name }) => {
    if (!name || !name.trim()) return { error: 'bad rename' };
    const closed = shell.closed.get(oldId);
    if (closed) {
      const id = idFor(name, oldId);
      Object.assign(closed.cfg, { id, name: name.trim() });
      const entries = [...shell.closed].map(([k, v]) => [k === oldId ? id : k, v]);
      shell.closed.clear(); for (const [k, v] of entries) shell.closed.set(k, v);
      saveProfiles(); pushState();
      return { id };
    }
    const p = shell.profiles.get(oldId);
    if (!p) return { error: 'bad rename' };
    const id = idFor(name, oldId);
    p.name = name.trim();
    if (id !== oldId) {
      // Rebuild the map in the same order, so the pane keeps its place.
      const entries = [...shell.profiles].map(([k, v]) => (k === oldId ? [id, v] : [k, v]));
      shell.profiles.clear(); for (const [k, v] of entries) shell.profiles.set(k, v);
      shell.proxy.profiles.delete(oldId); p.id = id; shell.proxy.profiles.set(id, p);
      p.endpoint = shell.proxy.endpoint(id);
    }
    saveProfiles(); pushState();
    return { id };
  });

  // Delete: the profile's tabs, sign-ins and storage are gone for good. The human confirms first (the editor, or
  // agentDeletesProfile below).
  shell.deleteProfile = async (id) => {
    const closed = shell.closed.get(id);
    if (closed) {
      shell.closed.delete(id);
      store.markDeleted(closed.cfg.partition);
      shell.sessionCookies.forget(closed.cfg);
      await wipeSession(session.fromPartition(closed.cfg.partition));
      saveProfiles(); pushState();
      return { id };
    }
    const p = shell.profiles.get(id);
    if (!p) return { error: `no profile ${id}` };
    shell.profiles.delete(id);
    shell.proxy.removeProfile(p);
    store.markDeleted(p.partition);
    shell.sessionCookies.forget(p);
    await p.destroy();
    saveProfiles(); pushState();
    return { id };
  };
  ipcMain.handle('profile:delete', (_e, { profile }) => shell.deleteProfile(profile));
  // The agent deletes only what the human confirms: sign-ins are made by hand and cannot be made again by code.
  shell.agentDeletesProfile = async (id) => {
    const p = shell.profiles.get(id) || shell.closed.get(id)?.cfg;
    if (!p) return { error: `no profile ${id}` };
    const ok = await ask({ message: `The agent asks to delete the profile ${p.name}.`, ok: 'Delete',
      detail: 'Its sign-ins, cookies, storage and tabs are removed for good.' });
    return ok ? shell.deleteProfile(id) : { error: 'the human said no' };
  };
  // The profile editor and the grid's drop targets are HTML; the profiles' views are native and draw above it,
  // so hide them meanwhile. With snapshots: first a picture of each page on screen, for the renderer to show in
  // its place ({ profile id: data URL }).
  ipcMain.handle('views:hidden', async (_e, hidden, { snapshots = false } = {}) => {
    const pics = {};
    if (hidden && snapshots) {
      await Promise.all([...shell.profiles.values()].filter((p) => p.visible() && p.get()).map(async (p) => {
        pics[p.id] = (await p.get().wc.capturePage().catch(() => null))?.toDataURL();
      }));
    }
    // While a project is being switched they stay hidden, whatever comes (a closing menu shows them again); the
    // window shows them once it has the next grid laid out.
    shell.viewsHidden = !!hidden || switching;
    for (const p of shell.profiles.values()) p.setHidden(shell.viewsHidden);
    return pics;
  });
  // A question with a button that does it and Cancel, as the OS draws it (deleting a profile).
  const ask = async ({ message, detail, ok }) =>
    (await dialog.showMessageBox(shell.win, { type: 'warning', message, detail, buttons: [ok, 'Cancel'], defaultId: 1, cancelId: 1 })).response === 0;
  ipcMain.handle('confirm', (_e, q) => ask(q));
  ipcMain.handle('layout:load', () => store.layout());
  ipcMain.on('layout:save', (_e, layout) => { if (!switching) store.saveLayout(layout); });

  const P = (id) => shell.profiles.get(id);
  ipcMain.handle('tab:new', (_e, { profile, url }) => { P(profile).newTab(url || 'about:blank'); });
  ipcMain.handle('tab:close', (_e, { profile, tab }) => P(profile).closeTab(tab));
  ipcMain.handle('tab:activate', (_e, { profile, tab }) => P(profile).activate(tab));
  ipcMain.handle('tab:navigate', (_e, { profile, tab, url }) => P(profile).navigate(tab, normalizeUrl(url)));
  ipcMain.handle('tab:back', (_e, { profile, tab }) => P(profile).back(tab));
  ipcMain.handle('tab:forward', (_e, { profile, tab }) => P(profile).forward(tab));
  ipcMain.handle('tab:reload', (_e, { profile, tab }) => P(profile).reload(tab));
  ipcMain.handle('tab:devtools', (_e, { profile, tab }) => P(profile).toggleDevTools(tab));
  ipcMain.on('layout', (_e, rects) => {
    const z = shell.win.webContents.getZoomFactor();
    for (const [id, r] of Object.entries(rects)) P(id)?.layout(r.shown === false ? r : Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * z)])));
  });
  ipcMain.handle('zoom:get', () => shell.uiZoom);
  ipcMain.handle('zoom:ui', (_e, dir) => setUiZoom(stepZoom(shell.uiZoom, dir)));
  ipcMain.handle('tab:zoom', (_e, { profile, tab, dir }) => P(profile).zoomSite(tab, dir));

  // Save session cookies and flush persistent ones before quitting, so sign-ins survive a restart.
  let quitting = false;
  app.on('before-quit', async (e) => {
    if (quitting) return;
    e.preventDefault(); quitting = true;
    if (!switching) pushState();
    shell.stopAutosave?.();
    for (const p of shell.profiles.values()) {
      await shell.sessionCookies?.save(p).catch((err) => console.error('[session-cookies]', err.message));
      await p.session.cookies.flushStore().catch(() => {});
      await p.disconnect();
    }
    if (shell.pty) stopTerminal(shell.pty);
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
