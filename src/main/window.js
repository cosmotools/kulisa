// A Kulisa window. Usually there is one; Move to New Window puts a project into a window of its own (e.g. on a second
// monitor). Each window has a tab per project open in it (an island in its projects' bar), shows one of them with that
// project's shown workspace (its grid and terminal), and asks its questions in its own dialog; the projects behind its
// other tabs keep running. What a window shows and asks is here. What the app has once (the store, the CDP proxy, the MCP server, the
// agents, the windows, one change after another: serial) is app.js's; what happens to projects and workspaces,
// whichever window shows them, is the core's (projects.js, workspaces.js).
const { BrowserWindow, desktopCapturer, screen, shell: electronShell } = require('electron');
const path = require('path');
const fs = require('fs');
const { stepZoom, zoomKey } = require('./profiles');

const TITLE_BAR_HEIGHT = 44; // keep in sync with #topbar in window.css
// The window's background and the OS buttons' strip, in each theme: --window and --text in tokens.css.
const COLORS = { dark: { window: '#2b2d30', text: '#dfe1e5' }, light: { window: '#ebecf0', text: '#1e1f22' } };
const NONE = new Map(); // the workspaces and profiles when no project is open
let questions = 0, windows = 0;

class AppWindow {
  // shell: the app (app.js). place: where it was ({ bounds, maximized }, settings.json), or { near: a window } for a
  // new one of its size next to it, or under the pointer (at: a point on the screen, where a tab was let go).
  // appDevTools: Kulisa's own DevTools (only when running from source).
  constructor(shell, { bounds, maximized, near, at } = {}, { appDevTools = false } = {}) {
    this.shell = shell;
    this.id = ++windows; // for a page to name another window (project:move)
    this.tabs = []; // the projects open in it (projects.js: Project), its tabs in order
    this.current = null; // the one shown
    // True until the page has laid out the shown workspace's grid (the renderer then shows the views).
    this.viewsHidden = true;
    // From leaving a workspace until the next one's profiles are all loaded: nothing is saved, and the page gets no
    // state (a partial one would build a grid other than the saved one).
    this.switching = true;
    this.stateTimer = null;
    this.picking = new Map(); // profiles in pick mode (picker.js), of the workspace on screen, by id
    this.answers = new Map(); // questions asked in it (ask), by id -> resolve
    this.loaded = false; this.pending = []; // what is sent before its page has loaded goes once it has
    if (near) {
      const b = near.getNormalBounds();
      bounds = at ? { ...b, x: at.x - 120, y: at.y - 20 } : { ...b, x: b.x + 32, y: b.y + 32 };
    } else if (bounds && !onScreen(bounds)) bounds = null;
    const win = (this.win = new BrowserWindow({
      width: 1700, height: 1050, ...bounds, title: 'Kulisa', backgroundColor: COLORS[shell.shade()].window,
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'), // taskbar and window switcher on Linux and Windows
      // One row on top, as in VS Code: no system title bar; the OS window buttons are drawn over the right end of
      // the window's own top bar (left on macOS). The page lays out around them (Window Controls Overlay).
      titleBarStyle: 'hidden', titleBarOverlay: { color: COLORS[shell.shade()].window, symbolColor: COLORS[shell.shade()].text, height: Math.round(TITLE_BAR_HEIGHT * shell.uiZoom) },
      // DevTools of Kulisa's own UI only while developing it; a packaged build has none (profiles' tabs still do).
      webPreferences: { preload: path.join(__dirname, '..', 'preload', 'index.js'), sandbox: false, devTools: appDevTools,
        zoomFactor: shell.uiZoom },
    }));
    if (maximized) win.maximize();
    this.place = this.where();
    // Electron's default File/Edit/View/Window menu adds a row on Linux and Windows and gives nothing (its Ctrl+R
    // reloads the shell). On macOS the menu lives in the system bar and stays (Cmd+C/V need its Edit roles).
    win.removeMenu();
    // Links in the window (the Welcome screen's: the website, GitHub; the terminal's, Open in your browser) open in the
    // user's browser; the window itself never leaves its page.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) electronShell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    // Its title names the shown project (show), not the page's <title>, which may load after.
    win.on('page-title-updated', (e) => e.preventDefault());
    // Questions the page was asking go unanswered once it is gone or loaded again (ask).
    win.webContents.on('render-process-gone', () => this.unanswered());
    win.webContents.on('did-start-navigation', (d) => { if (d.isMainFrame && !d.isSameDocument) this.unanswered(); });
    win.webContents.on('before-input-event', (e, i) => {
      // Ctrl + / - / 0 outside the pages: the Kulisa zoom.
      const dir = zoomKey(i);
      if (dir !== undefined) { e.preventDefault(); shell.setUiZoom(stepZoom(shell.uiZoom, dir)); }
      // F12 or Ctrl+Shift+I anywhere outside a profile's page (bars, terminal): DevTools of Kulisa's own UI.
      if (appDevTools && i.type === 'keyDown' && (i.key === 'F12' || ((i.control || i.meta) && i.shift && i.key.toLowerCase() === 'i'))) {
        e.preventDefault();
        const wc = win.webContents;
        // Detached like the profiles' DevTools: docked ones would sit under the profile views.
        if (wc.isDevToolsOpened()) wc.closeDevTools(); else wc.openDevTools({ mode: 'detach', title: 'Kulisa · DevTools' });
      }
    });
    // Where it was is kept for the next start; the app decides whether it closes now (app.js, closeWindow).
    win.on('close', (e) => { this.place = this.where(); shell.windowClosing(this, e); });
    win.on('closed', () => this.unanswered());
    win.on('focus', () => this.seen());
  }
  get ws() { return this.current?.ws ?? null; }
  get profiles() { return this.ws?.profiles || NONE; }
  get closed() { return this.ws?.closed || NONE; }
  where() { return { bounds: this.win.getNormalBounds(), maximized: this.win.isMaximized() }; }
  // What settings.json keeps of it (store.js, windows).
  saved() {
    return { tabs: this.tabs.map((p) => p.id), shown: this.current?.id ?? null, ...(this.win.isDestroyed() ? this.place : this.where()) };
  }
  focus() { if (this.win.isMinimized()) this.win.restore(); this.win.focus(); }
  destroy() { this.unanswered(); if (!this.win.isDestroyed()) this.win.destroy(); }

  // Its page, loaded once; its tabs (names, colors), the shown one (shown), the theme and where the projects' bar is
  // come along in the URL, so the window is drawn right at once. The profiles' views stay hidden until the renderer has the grid laid out (views:hidden).
  async load(shown) {
    await this.win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), { query: {
      version: require('../../package.json').version, theme: this.shell.theme, bar: this.shell.bar,
      projects: JSON.stringify({ current: shown?.id ?? null, projects: this.tabs.map(({ id, name, color }) => ({ id, name, color })),
        open: this.tabs.map(({ id }) => ({ id })) }) } });
    this.loaded = true;
    for (const [channel, data] of this.pending.splice(0)) this.send(channel, data);
  }
  send(channel, data) {
    if (this.win.isDestroyed()) return;
    if (this.loaded) this.win.webContents.send(channel, data); else this.pending.push([channel, data]);
  }

  // The projects (store.js), those open in its tabs in order, each with what its agents do, the one shown, those
  // open in another window, and the other windows (to move a project to: their id and their projects' names).
  info() {
    const { shell } = this;
    const others = shell.windows.filter((w) => w !== this && !w.win.isDestroyed());
    return { current: this.current?.id ?? null, projects: shell.store.projects(),
      // Each with its workspaces and the one it shows, for the projects' bar (the shown project's also come as
      // 'workspaces', with whether forks are possible)
      open: this.tabs.map((p) => ({ id: p.id, ws: p.ws?.key ?? null, workspaces: [...p.workspaces.values()].map((w) => w.info()) })),
      elsewhere: [...shell.open.values()].filter((p) => p.window !== this).map((p) => p.id),
      windows: others.map((w) => ({ id: w.id, names: w.tabs.map((p) => p.name) })) };
  }
  sendProjects() { this.send('projects', this.info()); }
  // The shown project's workspaces: their tabs (name, the agent's state), which is shown, and whether the project can
  // have forks (git: 'ok', 'no-commit', 'none'; null without a project).
  sendWorkspaces() {
    const p = this.current;
    this.send('workspaces', { current: this.ws?.key ?? null, list: p ? [...p.workspaces.values()].map((w) => w.info()) : [], git: p?.git ?? null });
  }
  // The shown workspace's profiles, open and closed, for the page to build its grid from; their tabs saved.
  pushState() {
    const ws = this.ws;
    if (!ws || this.switching) return;
    this.send('state', [...ws.profiles.values()].map((p) => p.info()));
    this.send('closed-profiles', [...ws.closed.values()].map(({ cfg, urls }) =>
      ({ key: cfg.folder, id: cfg.id, name: cfg.name, avatar: cfg.avatar, description: cfg.description, tabs: urls.length })));
    ws.list.saveTabs();
  }
  scheduleState() { clearTimeout(this.stateTimer); this.stateTimer = setTimeout(() => this.pushState(), 30); }
  // A workspace of its projects changed: its profiles (now: right away), or its agent's state (shown on its tab and
  // its project's).
  changed(ws, now, agentState) {
    if (agentState) {
      if (ws === this.ws && this.win.isFocused()) ws.see(); // done before the human's eyes: nothing to come and see
      this.sendWorkspaces(); return this.sendProjects();
    }
    if (ws !== this.ws) return ws.loaded && ws.list.saveTabs(); // not one being unloaded
    if (now) this.pushState(); else this.scheduleState();
  }

  // ---------- its tabs ----------
  // A project's tab, at the end or at index; app.js shows it.
  add(project, index = this.tabs.length) { this.tabs.splice(index, 0, project); project.window = this; }
  // A tab dragged to another place among its tabs (index: where, counted before it moves).
  reorder(project, index) {
    const from = this.tabs.indexOf(project);
    this.tabs.splice(from, 1);
    this.tabs.splice(index > from ? index - 1 : index, 0, project);
    this.shell.saveWindows();
    this.sendProjects();
  }
  // Another project on screen: the grid slides towards its tab (none: the window had no project), and its shown
  // workspace comes.
  async show(project) {
    if (project === this.current) return;
    if (this.current) await this.leaveGrid(Math.sign(this.tabs.indexOf(project) - this.tabs.indexOf(this.current)), 'project');
    this.current = project;
    this.shell.saveWindows();
    this.win.setTitle(`${project.name} — Kulisa`);
    this.sendProjects();
    await project.checkGit();
    this.sendWorkspaces();
    await this.showLoaded();
  }
  // The shown workspace: its profiles loaded (the first time it is shown), the page's grid built from its state
  // (terminal panel included, even with no profiles), then its agent started at the terminal's size.
  async showLoaded() {
    const ws = this.ws;
    if (!ws.loaded) await ws.loadProfiles();
    this.switching = false;
    this.pushState();
    this.seen();
    // Not waited for: the human may first have to choose the agent (or switch away meanwhile).
    if (!ws.pty && !ws.starting) ws.starting = ws.startAgent().catch((e) => console.error('[agent]', e)).finally(() => { ws.starting = null; });
  }
  // The page takes the grid down; it gets the next workspace's state once its profiles are loaded. dir: where the
  // next one is (1 right, -1 left, in the projects' bar; 0 none, the window is left with no project), for the page
  // to slide that way; level: 'project' (it slides) or 'workspace' (replaced at once). Pictures of its pages come
  // along, for the page to show them meanwhile (and when it comes back).
  async leaveGrid(dir, level) {
    this.pushState(); // saves the tabs
    this.switching = true;
    clearTimeout(this.stateTimer);
    for (const { cancel } of this.picking.values()) cancel();
    const pics = dir ? await this.pictures() : null;
    this.viewsHidden = true;
    for (const p of this.profiles.values()) p.setHidden(true);
    this.send('grid:closing', { dir, level, ws: this.ws.key, pics });
  }
  // Before a project's tab goes (the project closes, or moves to another window): the tab next to it is shown, or the
  // window is left with none (the Welcome screen).
  async leave(project) {
    if (project !== this.current) return;
    const i = this.tabs.indexOf(project), next = this.tabs[i + 1] || this.tabs[i - 1];
    if (next) await this.show(next); else await this.leaveGrid(0);
  }
  // Then the tab goes, and the page forgets its workspaces (terminals, pictures).
  drop(project) {
    this.tabs.splice(this.tabs.indexOf(project), 1);
    if (project.window === this) project.window = null;
    this.sendProjects();
    if (this.current === project) {
      this.current = null;
      this.win.setTitle('Kulisa');
      this.sendWorkspaces();
    }
    this.send('workspaces:closed', [...project.workspaces.values()].map((w) => w.key));
  }
  // A fork of one of its projects deleted (projects.js): the page forgets it, and its tab goes from its island.
  forkDeleted(ws) {
    this.send('workspaces:closed', [ws.key]);
    if (ws.project === this.current) this.sendWorkspaces();
    this.sendProjects();
  }
  // The human sees the shown workspace: an agent done there has nothing more to show (its ✓ says "come and see").
  seen() { if (this.ws?.see()) { this.sendWorkspaces(); this.sendProjects(); } }
  // Whether a point on the screen is on it (a tab let go there: app.js, dragOut).
  contains({ x, y }) {
    if (this.win.isDestroyed() || this.win.isMinimized()) return false;
    const b = this.win.getBounds();
    return x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
  }
  // A workspace of a project of its tabs; another project's becomes the one it shows when it comes.
  async showWorkspace(next) {
    const project = next.project;
    if (next === project.ws) return;
    if (project === this.current) await this.leaveGrid(Math.sign(next.n - project.ws.n), 'workspace');
    project.select(next);
    if (project !== this.current) return;
    this.sendWorkspaces();
    await this.showLoaded();
  }

  // ---------- the profiles' views ----------
  // The profile editor and the grid's drop targets are HTML; the profiles' views are native and draw above it, so
  // they are hidden meanwhile. With snapshots: first a picture of each page on screen, for the page to show in its
  // place ({ profile id: data URL }).
  async hideViews(hidden, { snapshots = false } = {}) {
    const pics = hidden && snapshots ? await this.pictures() : {};
    // While a project or a workspace is being switched they stay hidden, whatever comes (a closing menu shows them
    // again); the page shows them once it has the next grid laid out.
    this.viewsHidden = !!hidden || this.switching;
    for (const p of this.profiles.values()) p.setHidden(this.viewsHidden);
    return pics;
  }
  // JPEG: a picture shown for a moment, encoded three times faster than PNG (measured 2026-10-07). A page that draws no
  // frame (covered, the monitor off, busy) gives none: its pane is empty meanwhile. Waiting for it held every menu
  // after it closed (the menus' tests failed now and then, 2026-10-07).
  async pictures() {
    const pics = {};
    const later = (ms) => new Promise((ok) => setTimeout(ok, ms, null));
    await Promise.all([...this.profiles.values()].filter((p) => p.visible() && p.get()).map(async (p) => {
      const img = await Promise.race([p.get().wc.capturePage(), later(500)]).catch(() => null);
      if (!img) return;
      pics[p.id] = `data:image/jpeg;base64,${img.toJPEG(90).toString('base64')}`;
    }));
    return pics;
  }
  // Where the grid puts each pane's page (key: the workspace the page laid out), in CSS pixels; the views are placed
  // in window pixels.
  layout(key, rects) {
    if (key !== this.ws?.key) return; // a workspace no longer on screen
    const z = this.win.webContents.getZoomFactor();
    for (const [id, r] of Object.entries(rects)) this.profiles.get(id)?.layout(r.shown === false ? r : Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * z)])));
  }
  saveLayout(key, layout) { if (!this.switching && key === this.ws?.key) this.ws.store.saveLayout(layout); }
  // The Kulisa zoom (app.js): Chromium's zoom of the page, the OS title bar overlay with it.
  setZoom(z) {
    if (this.win.isDestroyed()) return;
    this.win.webContents.setZoomFactor(z);
    if (process.platform !== 'darwin') this.win.setTitleBarOverlay({ height: Math.round(TITLE_BAR_HEIGHT * z) }); // macOS: fixed buttons
    this.send('zoom', z);
  }
  // The theme (app.js): the page's colors (tokens.css: theme, as chosen), the window's background and the OS buttons'
  // strip in the colors shown (shade: dark or light).
  setTheme(theme, shade) {
    if (this.win.isDestroyed()) return;
    this.win.setBackgroundColor(COLORS[shade].window);
    if (process.platform !== 'darwin') this.win.setTitleBarOverlay({ color: COLORS[shade].window, symbolColor: COLORS[shade].text });
    this.send('theme', theme);
  }

  // A question in the window's own dialog (ask.js), as all of Kulisa's dialogs look: a button that does it (ok),
  // maybe a second way (other, as New Window next to This Window), and Cancel. The button clicked: 'ok' or 'other';
  // null for Cancel, or no answer (the page gone).
  ask({ message, detail, ok, other, danger }) {
    return new Promise((resolve) => {
      const id = ++questions;
      this.answers.set(id, resolve);
      this.send('ask', { id, message, detail, ok, other, danger });
    });
  }
  answer(id, answer) { this.answers.get(id)?.(answer === 'ok' || answer === 'other' ? answer : null); this.answers.delete(id); }
  unanswered() { for (const resolve of this.answers.values()) resolve(null); this.answers.clear(); }

  // The whole window, profile views included (BrowserWindow.capturePage misses WebContentsViews), captured like a
  // screen recorder would.
  async screenshot(file) {
    const [width, height] = this.win.getContentSize();
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width, height } });
    const source = sources.find((s) => s.id === this.win.getMediaSourceId());
    if (!source) throw new Error('window not found among capture sources');
    fs.writeFileSync(file, source.thumbnail.toPNG());
    console.log('[kulisa] screenshot', file);
    return file;
  }
}

// A place saved on a monitor that is gone (unplugged since): the window opens where the OS puts it instead.
function onScreen(b) {
  return screen.getAllDisplays().some(({ workArea: a }) => b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y);
}

module.exports = { AppWindow };
