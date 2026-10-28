// A Kulisa window. Usually there is one; Move to New Window puts a task into a window of its own (e.g. on a second
// monitor). Each window has a tab per task open in it (in its tasks' bar, in the bar's order, of any
// projects), shows one of them (its grid and terminal), and asks its questions in its own dialog; the tasks behind its
// other tabs keep running. What a window shows and asks is here. What the app has once (the store, the CDP proxy, the MCP server, the
// agents, the windows) is app.ts's, the open tasks with their one change after another (serial) open-tasks.ts's; what happens to projects and tasks,
// whichever window shows them, is the core's (projects.ts, tasks.ts).
import { BrowserWindow, desktopCapturer, screen, shell as electronShell } from 'electron';
import path from 'path';
import fs from 'fs';
import { page } from './pages.ts';
import { log } from './log.ts';
import { focusWindow } from './page-focus.ts';
import { Thumbnails } from '../screenshots/main/index.ts';
import type { Rectangle, Point } from 'electron';
import type { Shell } from './shell.ts';
import type { Task } from './tasks.ts';
import type { Profile, Bounds } from './profiles.ts';
import type * as Sent from '../shared/types.ts'; // what the window gets: its one definition
import type { Arg, Events } from '../shared/ipc.ts';
type Question = Sent.Question;

// Where a window was ({ bounds, maximized }), or where a new one goes: next to a window (near), under a point (at).
interface Place { bounds?: Rectangle | null; maximized?: boolean; near?: Electron.BrowserWindow; at?: Point }
type Shade = 'dark' | 'light';

const TITLE_BAR_HEIGHT = 44; // the title bar's (components/TopBar.tsx): keep in step
// macOS's window buttons: their height and Electron's place for them from the left, in pt (measured).
const MAC_BUTTONS = { height: 14, x: 7 };
// The window's background and the OS buttons' strip, in each theme: --background and --foreground of src/ui/theme.css;
// page: an empty tab's, as the pane's box under it (--card).
const COLORS: Record<Shade, { window: string; text: string; page: string }> = {
  dark: { window: '#0a0a0a', text: '#fafafa', page: '#171717' }, light: { window: '#ffffff', text: '#0a0a0a', page: '#ffffff' } };
// The smallest window whose UI still works (the top bar with the OS buttons, ☰ and a task's tab, something under
// it), as VS Code's: fixed, times the Kulisa zoom, in DIP. Not the grid's own minimum: with five profiles in a row it
// would keep the window from half a screen next to the human's IDE. The OS holds it for the human's drag only;
// the constructor's bounds and setSize pass below it, so a window is raised to it here.
const MIN_SIZE = { width: 640, height: 400 };
const minSize = (z: number) => ({ width: Math.round(MIN_SIZE.width * z), height: Math.round(MIN_SIZE.height * z) });
const CLEAR = '#0000'; // the OS buttons' strip
const NONE = new Map<string, never>(); // the profiles when no task is open
let windows = 0;

const PRELOAD = path.join(import.meta.dirname, '..', 'preload', 'index.cjs');

class AppWindow {
  shell: Shell; id: number; tabs: Task[]; current: Task | null; viewsHidden: boolean; switching: boolean; leaving: Profile[];
  stateTimer: NodeJS.Timeout | undefined; picking: Map<string, { profile: Profile; page: import('playwright-core').Page; cancel: () => unknown }>;
  questions: Questions; loaded: boolean; pending: [string, unknown[]][]; keyZone: string;
  thumbnails: Thumbnails; // a screenshot's, in its pane's corner (src/screenshots)
  win: Electron.BrowserWindow; place: { bounds: Rectangle; maximized: boolean }; barHeight: number; // the title bar's, as the window was made
  // shell: the app (app.ts). place: where it was ({ bounds, maximized }, settings.json), or { near: a window } for a
  // new one of its size next to it, or under the pointer (at: a point on the screen, where a tab was let go).
  // appDevTools: Kulisa's own DevTools (only when running from source).
  constructor(shell: Shell, { bounds, maximized, near, at }: Place = {}, { appDevTools = false } = {}) {
    this.shell = shell;
    this.id = ++windows; // for a page to name another window (task:move)
    this.tabs = []; // the tasks open in it (tasks.ts: Task), its tabs in order
    this.current = null; // the one shown
    // True until the page has laid out the shown task's grid (the renderer then shows the views).
    this.viewsHidden = true;
    // The pages of the task left for another, on screen until the page has the next grid laid out (hideViews).
    this.leaving = [];
    // From leaving a task until the next one's profiles are all loaded: nothing is saved, and the page gets no
    // state (a partial one would build a grid other than the saved one).
    this.switching = true;
    this.stateTimer = undefined;
    this.picking = new Map(); // profiles in pick mode (picker.ts), of the task on screen, by id
    this.questions = new Questions((q) => this.send('ask', q));
    this.loaded = false; this.pending = []; // what is sent before its page has loaded goes once it has
    // Where the keyboard is in its page, for the keys (shortcuts.ts, keys.ts): 'window', 'terminal', 'dialog', or
    // 'pane:<profile id>' (an address bar, a pane's toolbar), as the page tells.
    this.keyZone = 'window';
    if (near) {
      const b = near.getNormalBounds();
      bounds = at ? { ...b, x: at.x - 120, y: at.y - 20 } : { ...b, x: b.x + 32, y: b.y + 32 };
    } else if (bounds && !onScreen(bounds)) bounds = null;
    const min = minSize(shell.uiZoom);
    this.barHeight = Math.round(TITLE_BAR_HEIGHT * shell.uiZoom);
    if (bounds) bounds = { ...bounds, width: Math.max(bounds.width, min.width), height: Math.max(bounds.height, min.height) };
    const win = (this.win = new BrowserWindow({
      width: 1700, height: 1050, ...(bounds || {}), minWidth: min.width, minHeight: min.height, title: 'Kulisa', backgroundColor: COLORS[shell.shade()].window,
      icon: path.join(import.meta.dirname, '..', '..', 'assets', 'icon.png'), // taskbar and window switcher on Linux and Windows
      // One row on top, as in VS Code: no system title bar; the OS window buttons are drawn over the right end of
      // the window's own top bar (left on macOS). The page lays out around them (Window Controls Overlay).
      // Its color is see-through, as macOS's traffic lights have no strip of their own: the top bar under it shows, and a
      // dialog's backdrop dims it with the rest.
      titleBarStyle: 'hidden', titleBarOverlay: { color: CLEAR, symbolColor: COLORS[shell.shade()].text, height: this.barHeight },
      // DevTools of Kulisa's own UI only while developing it; a packaged build has none (profiles' tabs still do).
      webPreferences: { preload: PRELOAD, sandbox: true, devTools: appDevTools,
        zoomFactor: shell.uiZoom },
    }));
    if (maximized) win.maximize();
    this.place = this.where();
    // Send to Agent: its file's path into the prompt of the shown task's agent.
    this.thumbnails = new Thumbnails(win, { page: page('thumbnail.html'), preload: PRELOAD, send: (text) => this.task?.typeForAgent(text) });
    // Electron's default File/Edit/View/Window menu adds a row on Linux and Windows and gives nothing (its Ctrl+R
    // reloads the shell). On macOS the menu lives in the system bar and stays (Cmd+C/V need its Edit roles).
    win.removeMenu();
    // GNOME (X11) shows its window menu for a right-click on the title bar's drag region at a NaN place: invisible,
    // it holds the pointer and keyboard of the whole desktop until the overview opens (docs/window.md, The title bar).
    if (process.platform === 'linux') win.on('system-context-menu', (e) => e.preventDefault());
    keepPage(win);
    // Its title names the shown task (show), not the page's <title>, which may load after.
    win.on('page-title-updated', (e) => e.preventDefault());
    // Questions the page was asking go unanswered once it is gone or loaded again (ask).
    win.webContents.on('render-process-gone', () => this.unanswered());
    win.webContents.on('did-start-navigation', (d) => { if (d.isMainFrame && !d.isSameDocument) this.unanswered(); });
    // Where it was is kept for the next start; the app decides whether it closes now (app.ts, closeWindow).
    win.on('close', (e) => { this.place = this.where(); shell.windowClosing(this, e); });
    win.on('closed', () => this.unanswered());
    win.on('focus', () => this.seen());
    win.on('blur', () => { if (this.task) this.shell.dictation.letGo(this.task.key); this.send('window:blur'); });
  }
  get task() { return this.current; }
  get profiles(): Map<string, Profile> { return this.task?.profiles || NONE; }
  get closed(): Task['closed'] { return this.task?.closed || NONE; }
  where() { return { bounds: this.win.getNormalBounds(), maximized: this.win.isMaximized() }; }
  // What settings.json keeps of it (store.ts, windows): its tasks' keys in order, the shown one.
  saved() {
    return { tabs: this.tabs.map((t) => t.key), shown: this.current?.key ?? null, ...(this.win.isDestroyed() ? this.place : this.where()) };
  }
  // How another window's menu names it (Move to Window: …): its shown task, and how many more it holds.
  label() {
    const more = this.tabs.length - 1;
    return this.current ? `${this.current.displayName}${more > 0 ? ` (+${more})` : ''}` : 'empty';
  }
  focus() { if (this.win.isMinimized()) this.win.restore(); if (!this.win.isVisible()) this.win.show(); this.win.focus(); }
  // Kulisa's own DevTools (only when running from source: appDevTools), detached like the profiles' DevTools: docked
  // ones would sit under the profile views.
  toggleDevTools() {
    const wc = this.win.webContents;
    if (wc.isDevToolsOpened()) wc.closeDevTools(); else wc.openDevTools({ mode: 'detach', title: 'Kulisa · DevTools' });
  }
  destroy() { this.unanswered(); this.thumbnails.destroy(); if (!this.win.isDestroyed()) this.win.destroy(); }

  // Its page, loaded once; its tabs, the one to be shown (shown), the theme, where the tasks' bar is and
  // the keyboard shortcuts (keys.ts: for menus and tooltips) come along in the URL, so the window is drawn right at once. The profiles' views stay hidden until the renderer has the grid laid out (views:hidden).
  async load(shown: Task | null) {
    await this.win.loadFile(page('index.html'), { query: {
      theme: this.shell.theme, bar: this.shell.bar, keys: JSON.stringify(this.shell.keys()),
      projects: JSON.stringify(this.info(shown)) } });
    this.loaded = true;
    for (const [channel, data] of this.pending.splice(0)) this.win.webContents.send(channel, ...data);
  }
  send<C extends keyof Events>(channel: C, ...data: Arg<Events[C]>) {
    if (this.win.isDestroyed()) return;
    if (this.loaded) this.win.webContents.send(channel, ...data); else this.pending.push([channel, data]);
  }

  // The projects (store.ts), its tabs in order (each task with what its agent does), the one shown (shown: the one
  // about to be) and its project, the loaded projects' agents (the terminals' +), and the other windows (to move a
  // task to: their id and how each is named).
  info(shown = this.current): Sent.ProjectsInfo {
    const { shell } = this;
    const others = shell.windows.filter((w) => w !== this && !w.win.isDestroyed());
    return { current: shown?.key ?? null, project: shown?.project.id ?? null, projects: shell.projects(),
      tabs: this.tabs.map((t) => t.info()),
      open: [...shell.open.values()].map((p) => ({ id: p.id,
        agents: p.agents().map((a) => { const c = shell.agentFor(a)!; return { id: a, name: c.name, cli: c.agentId }; }) })), // the default first: + runs it
      windows: others.map((w) => ({ id: w.id, name: w.label() })),
      settings: shell.projects().length > 0 || shell.accounts.all().some((a) => !a.own) || shell.profileStore.all().length > 0 };
  }
  sendProjects() { this.send('projects', this.info()); }
  // The shown task's profiles, open and closed, and its terminals, for the page to build its grid from; their tabs
  // saved.
  pushState() {
    const task = this.task;
    if (!task || this.switching) return;
    this.sendTerminals();
    this.send('state', [...task.profiles.values()].map((p) => p.info()));
    this.send('closed-profiles', [...task.closed.values()].map(({ cfg, tabs }): Sent.ClosedProfile =>
      ({ id: cfg.id, name: cfg.name, avatar: cfg.avatar, description: cfg.description ?? '', tabs: tabs.urls.length })));
    task.list.saveTabs();
  }
  // The shown task's artifacts (Resources.tsx): when it is shown, and when its agent makes one.
  async sendArtifacts(task = this.task) {
    if (!task || task !== this.task) return;
    const [list, { bytes }] = await Promise.all([task.artifacts(), task.artifactsUsage()]);
    if (task === this.task) this.send('artifacts', { task: task.key, list, bytes });
  }
  sendTerminals() { if (this.task && !this.switching) this.send('terminals', { task: this.task.key, ...this.task.terminalsInfo() }); }
  scheduleState() { clearTimeout(this.stateTimer); this.stateTimer = setTimeout(() => this.pushState(), 30); }
  // A task of its tabs changed: its profiles (now: right away), or its agent's state (shown on its tab).
  changed(task: Task, now?: boolean, agentState?: boolean) {
    if (agentState) {
      if (task === this.task && this.win.isFocused()) task.see(); // done before the human's eyes: nothing to come and see
      if (task === this.task) this.sendTerminals();
      return this.sendProjects();
    }
    if (task !== this.task) return task.loaded && task.list.saveTabs(); // not one being unloaded
    if (now) this.pushState(); else this.scheduleState();
  }

  // ---------- its tabs ----------
  // A task's tab, at the end or at index; app.ts shows it.
  add(task: Task, index = this.tabs.length) { this.tabs.splice(index, 0, task); task.window = this; }
  // A tab dragged to another place among its tabs (index: where, counted before it moves).
  reorder(task: Task, index: number) {
    const from = this.tabs.indexOf(task);
    this.tabs.splice(from, 1);
    this.tabs.splice(index > from ? index - 1 : index, 0, task);
    this.shell.saveWindows();
    this.sendProjects();
  }
  // Another task on screen: the grid on screen goes at once, as a browser's tab (none: the window showed no task), then
  // its profiles and terminals come.
  async show(task: Task) {
    log.info(`[window] wc=${this.win.webContents.id} shows ${task.key}`);
    if (task === this.current) return;
    if (this.current) this.leaveGrid(true);
    this.current = task;
    this.shell.saveWindows();
    this.win.setTitle(`${task.displayName} · ${task.project.name} — Kulisa`);
    this.sendProjects();
    task.project.checkMerged().then((found) => found && this.shell.sendProjects()).catch(() => {}); // its closed tasks whose PR is merged
    await this.showLoaded();
  }
  // The shown task: its profiles loaded (the first time it is shown), the page's grid built from its state
  // (the terminals' panel included, even with no profiles; its tabs too, each starting), then its terminals started at
  // the terminals' size.
  async showLoaded() {
    const task = this.task!;
    if (!task.loaded) task.loadProfiles();
    this.switching = false;
    // Not waited for: the human may first have to choose the agent (or switch away meanwhile). Its tabs come at once,
    // each starting, so the grid comes with them, not with the terminals' buttons.
    const terminals = task.loadTerminals();
    this.pushState();
    this.seen();
    terminals.catch((e) => console.error('[agent]', e));
  }
  // The page takes the grid down; it gets the next task's state once its profiles are loaded. Left for another task
  // (next), the grid and its pages stay on screen until the next one is laid out, as a browser keeps a tab's page until
  // the next one's is drawn: nothing empty between them.
  leaveGrid(next = false) {
    this.pushState(); // saves the tabs
    this.switching = true;
    clearTimeout(this.stateTimer);
    for (const { cancel } of this.picking.values()) cancel();
    this.thumbnails.close(); // its pane goes
    this.viewsHidden = true;
    if (next) this.leaving.push(...this.profiles.values());
    else for (const p of this.profiles.values()) p.setHidden(true);
    this.send('grid:closing', next);
  }
  // Before a task's tab goes (the task closes, or moves to another window): the tab next to it is shown, or the
  // window is left with none (the empty window).
  async leave(task: Task) {
    if (task !== this.current) return;
    const i = this.tabs.indexOf(task), next = this.tabs[i + 1] || this.tabs[i - 1];
    if (next) await this.show(next); else this.leaveGrid();
  }
  // Then the tab goes, and the page forgets the task (terminals, pictures).
  drop(task: Task) {
    this.tabs.splice(this.tabs.indexOf(task), 1);
    if (task.window === this) task.window = null;
    if (this.current === task) {
      this.current = null;
      this.win.setTitle('Kulisa');
    }
    this.sendProjects();
    this.send('tasks:closed', [task.key]);
  }
  // The human sees the shown task: an agent done there has nothing more to show (its ✓ says "come and see").
  seen() { if (this.task?.see()) { this.sendTerminals(); this.sendProjects(); } }
  // Whether a point on the screen is on it (a tab let go there: app.ts, dragOut).
  contains({ x, y }: Point) {
    if (this.win.isDestroyed() || this.win.isMinimized()) return false;
    const b = this.win.getBounds();
    return x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
  }

  // ---------- the profiles' views ----------
  // Settings and the grid's drop targets are HTML; the profiles' views are native and draw above it, so
  // they are hidden meanwhile. With snapshots: first a picture of each page on screen, for the page to show in its
  // place ({ profile id: data URL }).
  async hideViews(hidden: boolean, { snapshots = false } = {}) {
    const pics = hidden && snapshots ? await this.pictures() : {};
    for (const p of this.leaving.splice(0)) p.setHidden(true);
    // While a task is being switched they stay hidden, whatever comes (a closing menu shows them
    // again); the page shows them once it has the next grid laid out.
    this.viewsHidden = !!hidden || this.switching;
    // A dialog over the pages (hidden, no pictures): a page that had the keyboard keeps it unseen, and the dialog's focus
    // trap (Radix's) works in a page that has the keyboard, its keys going nowhere else: the window's page takes it. Menus
    // (pictures) put the keyboard back themselves as they close.
    const from = hidden && !snapshots && [...this.profiles.values()].some((p) => { const wc = p.get()?.wc; return wc && !wc.isDestroyed() && wc.isFocused(); });
    for (const p of this.profiles.values()) p.setHidden(this.viewsHidden);
    this.thumbnails.setHidden(this.viewsHidden);
    if (from) focusWindow(this.win.webContents);
    return pics;
  }
  // JPEG: a picture shown for a moment, encoded three times faster than PNG. A page that draws no frame (covered, the
  // monitor off, busy) gives none: its pane is empty meanwhile. Waiting for it would hold every menu after it closed.
  // How long a picture takes is the computer's (a few ms, or over a hundred on a loaded one, where a fixed tenth of a
  // second leaves every pane empty), so the pages set the pace: once the first has answered, the rest get three times as
  // long, a tenth of a second at least; none answering, half a second.
  async pictures() {
    const pics: Record<string, string> = {}, t0 = Date.now();
    let giveUp = () => {}, paced = false;
    const gaveUp = new Promise<null>((ok) => { giveUp = () => ok(null); });
    let timer = setTimeout(() => giveUp(), 500);
    const pace = () => {
      if (paced) return;
      paced = true; clearTimeout(timer);
      const took = Date.now() - t0;
      timer = setTimeout(() => giveUp(), Math.max(100, 3 * took) - took);
    };
    await Promise.all([...this.profiles.values()].filter((p) => p.visible() && p.get() && !p.get()!.discarded && !p.get()!.wc.isDestroyed()).map(async (p) => {
      const img = await Promise.race([p.get()!.wc.capturePage().then((i) => { pace(); return i; }), gaveUp]).catch((): null => null);
      if (!img) return;
      pics[p.id] = `data:image/jpeg;base64,${img.toJPEG(90).toString('base64')}`;
    }));
    paced = true; clearTimeout(timer); // a picture given up on may still come
    return pics;
  }
  // Where the grid puts each pane's page (key: the task the page laid out), in CSS pixels; the views are placed
  // in window pixels.
  layout(key: string | null, rects: Record<string, Partial<Bounds> & { shown?: boolean }>) {
    if (key !== this.task?.key) return; // a task no longer on screen
    const z = this.win.webContents.getZoomFactor();
    for (const [id, r] of Object.entries(rects)) this.profiles.get(id)?.layout(r.shown === false ? r : Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round((v as number) * z)])));
    this.thumbnails.place(this.paneBox);
  }
  // Where a profile's pane shows its page in the window; null: not on screen.
  paneBox = (id: string) => { const p = this.profiles.get(id); return p?.shown ? p.bounds : null; };
  // Any loaded task of this window: the grid's last change comes as it is taken down, and reaches here once the window
  // shows the next task.
  saveLayout(key: string | null, layout: unknown) {
    const task = this.tabs.find((t) => t.key === key);
    if (task?.loaded) task.store.saveLayout(layout);
  }
  // The Kulisa zoom (app.ts): Chromium's zoom of the page, the OS title bar overlay and the window's minimum with it
  // (a window now smaller grows to it; Electron leaves it as it is).
  setZoom(z: number) {
    if (this.win.isDestroyed()) return;
    this.win.webContents.setZoomFactor(z);
    const min = minSize(z), [width = 0, height = 0] = this.win.getSize();
    this.win.setMinimumSize(min.width, min.height);
    if ((width < min.width || height < min.height) && !this.win.isMaximized() && !this.win.isFullScreen()) this.win.setSize(Math.max(width, min.width), Math.max(height, min.height));
    const bar = Math.round(TITLE_BAR_HEIGHT * z);
    if (process.platform !== 'darwin') this.win.setTitleBarOverlay({ height: bar });
    // macOS has no setTitleBarOverlay: the buttons' strip keeps the height the window was made with, and the buttons
    // stayed at its top as the bar grew. Moved to the bar's middle, but not below that strip: there they took no click.
    else this.win.setWindowButtonPosition({ x: MAC_BUTTONS.x, y: Math.max(0, Math.min(Math.round((bar - MAC_BUTTONS.height) / 2), this.barHeight - MAC_BUTTONS.height)) });
    this.send('zoom', z);
  }
  // The theme (app.ts): the page's colors (its theme, as chosen), the window's background and the OS buttons'
  // symbols in the colors shown (shade: dark or light); their strip is see-through (CLEAR).
  setTheme(theme: string, shade: Shade) {
    if (this.win.isDestroyed()) return;
    this.win.setBackgroundColor(COLORS[shade].window);
    if (process.platform !== 'darwin') this.win.setTitleBarOverlay({ symbolColor: COLORS[shade].text });
    this.send('theme', theme);
  }

  // Brought to the front with it while another of Kulisa's windows has the focus (Settings, another tasks' window): left
  // behind, it would look as if nothing happened (the OS's × works behind Settings on macOS). Never from another app.
  ask(q: Question) {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused && focused !== this.win) this.focus();
    return this.questions.ask(q);
  }
  answer(id: number, answer: string) { this.questions.answer(id, answer); }
  unanswered() { this.questions.unanswered(); }

  // The whole window, profile views included (BrowserWindow.capturePage misses WebContentsViews), captured like a
  // screen recorder would.
  async screenshot(file: string) {
    const [width = 0, height = 0] = this.win.getContentSize();
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width, height } });
    const source = sources.find((s) => s.id === this.win.getMediaSourceId());
    if (!source) throw new Error('window not found among capture sources');
    fs.writeFileSync(file, source.thumbnail.toPNG());
    console.log('[kulisa] screenshot', file);
    return file;
  }
}

// A question in a window's own dialog (the renderer's lib/ask.ts), as all of Kulisa's dialogs look: a button that does
// it (ok), maybe a second way (other, as New Window next to This Window), and Cancel. The button clicked: 'ok' or
// 'other'; null for Cancel, or no answer (the page gone).
let asked = 0;
class Questions {
  send: (q: Question & { id: number }) => void; answers = new Map<number, (answer: string | null) => void>();
  constructor(send: (q: Question & { id: number }) => void) { this.send = send; }
  ask({ message, detail, ok, other, cancel, danger, link }: Question) {
    return new Promise<string | null>((resolve) => {
      const id = ++asked;
      this.answers.set(id, resolve);
      this.send({ id, message, detail, ok, other, cancel, danger, link });
    });
  }
  answer(id: number, answer: string) { this.answers.get(id)?.(answer === 'ok' || answer === 'other' ? answer : null); this.answers.delete(id); }
  unanswered() { for (const resolve of this.answers.values()) resolve(null); this.answers.clear(); }
}

// Links in a window of Kulisa's (☰'s: the documentation, GitHub; a terminal's, Open in your browser) open in the user's
// browser; the window itself never leaves its page.
function keepPage(win: Electron.BrowserWindow) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void electronShell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  // What the page says is wrong (an uncaught error, a warning of its own), in the log with the main process's lines;
  // also as the window closes, its BrowserWindow already destroyed.
  const id = win.webContents.id;
  win.webContents.on('console-message', (d) => {
    if (d.level === 'error' || d.level === 'warning') log.warn(`[page wc=${id}] ${d.message} (${d.sourceId}:${d.lineNumber})`);
  });
}

// A place saved on a monitor that is gone (unplugged since): the window opens where the OS puts it instead.
function onScreen(b: Rectangle) {
  return screen.getAllDisplays().some(({ workArea: a }) => b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y);
}

export type { Place };
export { AppWindow, COLORS };
