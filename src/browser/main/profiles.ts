// A profile: one embedded browser profile (an Electron session on a folder of its own, as a Chrome profile) with its
// own tabs.
// Each tab is a WebContentsView. Automation reaches the tabs only through the CDP proxy (cdp-proxy.ts), and the
// shell's own Playwright connection (`connect`) is one client of that proxy.
import { EventEmitter } from 'events';
import electron from 'electron';
import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import type { BrowserWindow, Rectangle, Session, WebContents, WebContentsView as View } from 'electron';
import fs from 'fs';
import path from 'path';
import type { SavedTabs } from './storage.ts';
import type * as Sent from '../ipc.ts';
import { allowFocus, guardFocus } from './page-focus.ts';
import { bare, log } from '../../main/log.ts';
import { capture } from '../../screenshots/main/index.ts';
import type { Shot } from '../../screenshots/main/index.ts';
// Taken from the module, not imported by name: unit tests load this in plain Node, where 'electron' is only a path
// (docs/testing.md, Two layers).
const { session, WebContentsView } = electron;

// A page's alert or confirm, shown in its pane (_dialog).
interface Dialog { id: number; type: 'alert' | 'confirm'; message: string; from: string; answer: (ok: boolean, text: string) => void; picture: string | null }
interface Tab {
  id: string; view: View; wc: WebContents; title: string; url: string; favicon: string; loading: boolean;
  canBack?: boolean; canFwd?: boolean;
  // tab.answered: until its site has answered (newTab); tab.ready: its first navigation done.
  answered: Promise<void> | null; ready?: Promise<unknown>;
  pendingUrl?: string | null; targetId?: string | null; closing?: boolean; dialog?: Dialog | null;
  // Discarded: without its process, its address kept (discard, load; docs/profiles.md, "Tabs unloaded"); discarding:
  // the address it comes back to, while its page may still hold its unload; offScreenSince: since when no one sees it
  // (discard.ts).
  discarded?: boolean; discarding?: string; offScreenSince?: number;
  blankCss?: string; // the color put on its empty page (_paintBlank), taken off when the color changes
  // The agent's own action answers the dialogs it opens (kulisa-plugin/main/tools/handles.ts, answering).
  agentDialogs?: { asked: string[]; accept: boolean };
}
// Who a profile is and where its data is (project-profiles.ts; master.ts: a session of its own).
interface ProfileConfig {
  id: string; name: string; avatar: string; description?: string; login?: string; hasPassword?: boolean;
  dir: string; session?: Session; zoom?: Record<string, number>;
}
type Bounds = Rectangle;
// Electron's own events of a webContents that its types leave out (_add: the pages' dialogs).
type Internal = { on(event: string, listener: (...args: any[]) => void): unknown; removeAllListeners(event: string): unknown };

let nextTab = 1;
// Zoom levels, as in Chrome. Ctrl + / - step through them; 1 is 100 %.
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
// The next zoom level from z: dir 1 bigger, -1 smaller, 0 back to 1.
function stepZoom(z: number, dir: number) {
  if (!dir) return 1;
  const next = dir > 0 ? ZOOM_STEPS.find((s) => s > z + 1e-6) : ZOOM_STEPS.findLast((s) => s < z - 1e-6);
  return next ?? z;
}
// What the human types in the address bar, or the agent passes, as a URL: one with a scheme as it is; a host (with a
// path) over https, localhost over http; anything else is searched for. "localhost:3000" is a host and a port, not a
// scheme.
function toUrl(u: string) {
  u = u.trim();
  if (/^[a-z][\w+.-]*:/i.test(u) && !/^[\w.-]+:\d+(\/|$)/.test(u)) return u;
  if (/^(localhost|127\.)/.test(u)) return 'http://' + u;
  if (/^[\w.-]+(:\d+)?(\/|$)/.test(u)) return 'https://' + u;
  return 'https://www.google.com/search?q=' + encodeURIComponent(u);
}
const CLOSED_KEPT = 10; // closed tabs' addresses kept to open again
const LAYOUT_WAIT = 3000; // ms a screenshot waits for a pane just opened to be laid out
let dialogs = 0; // pages' dialogs, numbered: the human's answer goes to the one they saw
// What Electron gives a page's dialog (its internal -run-dialog event).
interface DialogInfo { dialogType: 'alert' | 'confirm'; messageText: string; frame: { url: string; parent: unknown } }

class Profile extends EventEmitter {
  win: BrowserWindow; id: string; name: string; avatar: string; description: string; login: string; hasPassword: boolean;
  dir: string; task: string; baseZoom: number; blank: string; siteZoom: Record<string, number>; session: Session;
  tabs: Tab[]; active: string | null; closedUrls: string[]; bounds: Bounds;
  clip?: Bounds; clipView?: Electron.View;
  browser: Browser | null; context: BrowserContext | null; endpoint: string | null; signinMode: boolean; resuming?: boolean;
  hidden: boolean; shown: boolean; deleted: boolean;
  busyAt: number; // when automation last sent this profile a command (cdp-proxy.ts): its tabs are in use (discard.ts)
  // cfg: { id, name, avatar, description, dir, session }. The id and the folder (cookies, storage; dir is its absolute
  // path) are fixed at creation; a rename changes the name only.
  // win: the window it shows in (moveTo). task: its task's key (profiles of different tasks share ids).
  constructor(win: BrowserWindow, cfg: ProfileConfig, { task }: { task: string }) {
    super();
    this.win = win;
    this.id = cfg.id; this.name = cfg.name; this.avatar = cfg.avatar; this.description = cfg.description || '';
    this.login = cfg.login || ''; this.hasPassword = !!cfg.hasPassword; // a test user's pair (profile-store.ts): its login
    this.dir = cfg.dir; this.task = task;
    // Page zoom: pages follow the Kulisa zoom (baseZoom, set by the window); a site the human zoomed with Ctrl + / -
    // in a page keeps its own factor on top of it, per host, in this profile only (saved in profiles.json).
    this.baseZoom = 1;
    this.blank = ''; // an empty tab's color (setBlank, by the window); none: Chromium's white
    this.siteZoom = { ...(cfg.zoom || {}) };
    this.session = cfg.session || session.fromPath(this.dir); // a session of its own: one in memory (master.ts)
    this.tabs = []; this.active = null; this.closedUrls = []; this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    this.browser = null; this.context = null; this.endpoint = null; this.signinMode = false;
    this.hidden = false; // views hidden while a window-wide dialog is open or a pane is dragged (they draw above the HTML)
    this.shown = true; // false while the pane is not on screen in the grid (stacked behind another pane)
    this.deleted = false;
    this.busyAt = 0;
  }

  // The shell's Playwright connection through the proxy (picker, MCP tools).
  async connect(endpoint: string) {
    this.endpoint = endpoint;
    this.browser = await chromium.connectOverCDP(endpoint);
    this.context = this.browser.contexts()[0]!; // connectOverCDP's default context, always there
    // With no listener Playwright dismisses every dialog (alert, confirm), the human's too; with one they stay for
    // the human. The agent's tools answer those its own actions open (kulisa-plugin/main/tools/handles.ts, answering).
    this.context.on('dialog', () => {});
  }
  async disconnect() {
    const b = this.browser;
    this.browser = null; this.context = null;
    if (b) await b.close().catch(() => {});
  }

  // Playwright Page for a tab (default: the active one).
  async page(tabId?: string | null): Promise<Page> {
    const tab = this.get(tabId);
    if (!tab) throw new Error(`no tab ${tabId}`);
    if (!this.context) throw new Error(`profile ${this.id} is not connected`);
    if (tab.discarded) await this.load(tab);
    const id = await ensureTarget(tab);
    for (let i = 0; i < 50; i++) {
      // A page still closing (a tab closed a moment ago) has no target left to ask: not this one.
      for (const p of this.context.pages()) if ((await targetIdOf(p).catch((): null => null)) === id) return p;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`no Playwright page for tab ${id}`);
  }

  // A picture of a tab, the human's or the agent's (src/screenshots/README.md). Not while the human signs in: the
  // pause has Playwright detached.
  async screenshot(tab: Tab, shot: Omit<Shot, 'human'> & { by: 'human' | 'agent' }): Promise<Buffer> {
    if (this.signinMode) throw new Error(`${this.name} is signing in: no screenshot until the sign-in is done.`);
    if (tab.dialog) throw new Error(`Tab ${tab.id} of ${this.id} shows a ${tab.dialog.type} ("${tab.dialog.message}") for the human to answer; until then its page does nothing.`);
    if (!tab.discarded && (!tab.url || tab.url === 'about:blank')) throw new Error(`Tab ${tab.id} of ${this.id} is empty: nothing to take.`);
    // A page's size is its pane's, and Chromium gives no picture of a page with none. A pane just opened gets its size
    // a moment later (the window lays out its grid); a tab gets it when it comes to the front, as a hidden view passes
    // no size to its page.
    if (!this.bounds.width) {
      await new Promise<void>((done) => {
        const laid = () => { clearTimeout(t); done(); };
        const t = setTimeout(() => { this.off('laid-out', laid); done(); }, LAYOUT_WAIT);
        this.once('laid-out', laid);
      });
    }
    if (!this.bounds.width) throw new Error(`${this.name}'s pane has not been on screen yet: its page has no size to take a picture of.`);
    if (!tab.discarded && !tab.view.getBounds().width) throw new Error(`Tab ${tab.id} of ${this.name} has not been in front yet: its page has no size to take a picture of until it is.`);
    // The page takes its pane's size on its next frame.
    for (const end = Date.now() + LAYOUT_WAIT; !tab.discarded && Date.now() < end && !await tab.wc.executeJavaScript('innerWidth').catch(() => 0);) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const { by, ...rest } = shot;
    const png = await capture(await this.page(tab.id), { ...rest, ...(by === 'human' && { human: `${this.task}/${this.id}` }) });
    log.info(`[screenshot] ${this.id} ${shot.element ? 'element' : shot.fullPage ? 'whole page' : 'visible part'}, by the ${by}`);
    return png;
  }

  get(id?: string | null) { id = id || this.active; return this.tabs.find((t) => t.id === id || t.targetId === id); }

  newTab(url?: string | null, { activate = true } = {}) {
    const view = new WebContentsView({ webPreferences: { session: this.session, sandbox: true } });
    const tab = this._add(view);
    const ready = this._open(tab, url && toUrl(url));
    if (activate) this.activate(tab.id);
    return Object.assign(tab, { ready }); // every tab it opens has one, unlike a page's popup
  }
  // Its tabs saved (urlOf: the address a tab comes back on, '' for none) and opened again: the one in front in front.
  savedTabs(urlOf: (t: Tab) => string): SavedTabs {
    const urls: string[] = []; let active = 0;
    for (const t of this.tabs) {
      const u = urlOf(t);
      if (!u || u === 'about:blank') continue;
      if (t.id === this.active) active = urls.length;
      urls.push(u);
    }
    return { urls, active };
  }
  openTabs({ urls, active }: SavedTabs) {
    if (!urls.length) urls = ['about:blank'];
    if (!urls[active]) active = 0;
    return Promise.all(urls.map((u, i) => this.newTab(u, { activate: i === active }).ready));
  }

  // A tab's page opened in its fresh webContents (newTab; load, a discarded tab's new one): its ready.
  _open(tab: Tab, url: string | null | undefined) {
    const wc = tab.wc;
    // The URL it is opening, until a page commits: a tab closed while it loads is saved as that (app.ts).
    tab.pendingUrl = url;
    wc.on('did-navigate', (_e, u) => { if (u !== 'about:blank') tab.pendingUrl = null; });
    // A fresh webContents has no renderer, and CDP commands wait for one: about:blank (no network) gives it one, and a
    // page Playwright sees even when the real URL never answers (test: a site that never answers).
    const ready = wc.loadURL('about:blank').catch(() => {});
    // tab.answered (null once it has): the URL's first page, or its error page, is there. Until then Chromium holds
    // CDP commands to the tab, so the proxy shows it to clients only after: a site that never answers would hang
    // them, and opening the profile with them (cdp-proxy.ts).
    if (url && url !== 'about:blank') {
      tab.answered = new Promise<void>((resolve) => {
        const navigated = (_e: unknown, u: string) => { if (u !== 'about:blank') done(); };
        const failed = (_e: unknown, code: number, _d: string, _u: string, mainFrame: boolean) => { if (mainFrame && code !== -3) done(); }; // -3: replaced by another navigation
        const done = () => { wc.off('did-navigate', navigated); wc.off('did-fail-load', failed); resolve(); };
        wc.on('did-navigate', navigated); wc.on('did-fail-load', failed);
      }).then(() => { tab.answered = null; });
    }
    // tab.ready: the first navigation has committed, or failed (its error page shows: a site refusing to connect,
    // e.g. a new task's dev server not started yet, held its profile 5 s). A client that attaches earlier sees a
    // never-loaded tab.
    return tab.ready = ready.then(() => url ? new Promise<void>((resolve) => {
      if (wc.isDestroyed()) return resolve(); // closed before it loaded (its profile closed or deleted)
      const failed = (_e: unknown, code: number, _d: string, _u: string, mainFrame: boolean) => { if (mainFrame && code !== -3) done(); };
      const done = () => { wc.off('did-navigate', done); wc.off('did-fail-load', failed); resolve(); };
      wc.on('did-navigate', done); wc.on('did-fail-load', failed); setTimeout(done, 5000);
      wc.loadURL(url).then(() => wc.navigationHistory.clear()).catch(() => {}); // Back never goes to the about:blank
    }) : undefined);
  }

  _add(view: View) {
    const tab: Tab = { id: `k${nextTab++}`, view, wc: view.webContents, title: '', url: '', favicon: '', loading: false, answered: null };
    this._bind(tab);
    this.tabs.push(tab);
    this.emit('tab-added', tab); this.emit('changed');
    return tab;
  }

  // The tab's webContents as Kulisa watches it: a new tab's, or the new one of a discarded tab (load).
  _bind(tab: Tab) {
    const { wc } = tab;
    // The keyboard stays where the human put it in the window: the page takes it only from them (page-focus.ts).
    guardFocus(wc, () => this.win);
    const update = () => {
      if (wc.isDestroyed()) return;
      // Still on the about:blank its page comes after (_open): the strip keeps the address and title it has.
      if (tab.pendingUrl && wc.getURL() === 'about:blank') { tab.loading = true; this.emit('changed'); return; }
      tab.title = wc.getTitle(); tab.url = wc.getURL(); tab.loading = wc.isLoading();
      tab.canBack = wc.navigationHistory.canGoBack(); tab.canFwd = wc.navigationHistory.canGoForward();
      this.emit('changed');
    };
    for (const e of ['did-start-loading', 'did-stop-loading', 'page-title-updated', 'did-navigate', 'did-navigate-in-page']) (wc as unknown as Internal).on(e, update);
    wc.on('did-navigate', () => { this._applyZoom(tab); this._paintBlank(tab); });
    // -3: replaced by another navigation. A page that would not load is a common report (a white pane), so it is logged,
    // its address bare (log.ts): the one kind of line about a profile's page.
    wc.on('did-fail-load', (_e, code, desc, url, mainFrame) => {
      if (!mainFrame || code === -3) return;
      log.warn(`[profile] ${this.id} page failed to load ${bare(url)}: ${desc} (${code})`);
      showError(wc, desc, url);
    });
    // A page never moves the window, as in Chrome. Kulisa's window has no system title bar, and Electron takes
    // app-region: drag from its views too: Teams declares one, and it stays after the page has gone, taking every
    // click and wheel over the panes (docs/window.md). Each document gets no-drag everywhere, which also replaces a
    // region left behind. A workaround of electron/electron#54743: remove when fixed (docs/testing.md, "Upgrading Electron").
    wc.on('did-navigate', () => wc.insertCSS('html, html * { app-region: no-drag !important; }', { cssOrigin: 'user' }).catch(() => {}));
    // alert and confirm in the tab's pane, as Chrome shows them in the page, not Electron's message box in the middle of
    // the window, which did not say which page asked (Electron shows no prompt(): it throws in the page). Electron's
    // handler is a listener of its internal event (lib/browser/api/web-contents.ts), replaced here: check
    // it at every Electron upgrade (docs/testing.md, "Upgrading Electron"). Answered by the human (answerDialog), by
    // an action of the agent (tab.agentDialogs, kulisa-plugin/main/tools/handles.ts), or by another client over CDP. Chromium holds a
    // navigation while a dialog is open; as Chrome does, it is dismissed when one starts (the address bar, reload).
    const internal = wc as unknown as Internal;
    internal.removeAllListeners('-run-dialog');
    internal.on('-run-dialog', (info: DialogInfo, answer: Dialog['answer']) => this._dialog(tab, info, answer));
    internal.on('-cancel-dialogs', () => this._dialogDone(tab));
    wc.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => { if (isMainFrame && !isSameDocument) this._dialogDone(tab, false); });
    wc.debugger.on('message', (_e, method) => { if (method === 'Page.javascriptDialogClosed') this._dialogDone(tab); });
    wc.on('page-favicon-updated', (_e, favs) => { tab.favicon = favs[0] || ''; this.emit('changed'); });
    // window.open and target=_blank become tabs of the same profile; createWindow keeps the opener relationship.
    wc.setWindowOpenHandler(({ url }) => ({
      action: 'allow', outlivesOpener: true,
      createWindow: (options) => {
        // Must adopt options.webContents (Chromium already created it); a fresh one freezes the main process.
        const v = new WebContentsView({ webPreferences: options.webPreferences, webContents: (options as { webContents?: WebContents }).webContents });
        const t = this._add(v); t.url = url; this.activate(t.id);
        return v.webContents;
      },
    }));
    wc.on('destroyed', () => this._removed(tab));
  }

  _removed(tab: Tab) {
    if (tab.discarding !== undefined) return this._discarded(tab);
    const i = this.tabs.indexOf(tab); if (i < 0) return;
    try { this.win.contentView.removeChildView(tab.view); this.clipView?.removeChildView(tab.view); } catch {}
    this._dropped(tab, i);
    this.emit('tab-closed', tab); this.emit('changed');
    // Its last tab closed (closeTab: the human's ×, the agent's browser_tab_close), the profile still open: an empty
    // tab takes its place, so the pane is never left without a page (its address and toolbar acting on nothing). Not
    // for a tab destroyed otherwise: Kulisa quitting (a new tab then crashes Electron), its profile closing. Not from
    // within this 'destroyed' event either: Chromium is still taking the old tab down, and a new one made meanwhile
    // crashes the main process now and then (CHECK(!frame_tree_->IsBeingDestroyed()) in RenderFrameCreated).
    if (!this.tabs.length && !this.deleted && tab.closing) setImmediate(() => { if (!this.tabs.length && !this.deleted) this.newTab('about:blank'); });
  }
  // Out of the list (i: its place); the one before it active in its place.
  _dropped(tab: Tab, i: number) {
    this.tabs.splice(i, 1);
    if (this.active === tab.id) { this.active = null; if (this.tabs.length) this.activate(this.tabs[Math.max(0, i - 1)]!.id); }
  }

  // A tab no one looks at loses its process, as Chrome's Memory Saver discards tabs (docs/profiles.md, "Tabs unloaded";
  // the rule and when: discard.ts). url: where it comes back (a sign-in page's: the page before it); its title and
  // icon stay as they were. A page holding its unload (beforeunload: an unsaved form) stays, as in Chrome: Electron
  // says so (will-prevent-unload) and keeps it.
  discard(tab: Tab, url: string) {
    if (tab.discarded || tab.discarding !== undefined || tab.wc.isDestroyed() || !url) return;
    tab.discarding = url;
    tab.wc.once('will-prevent-unload', () => { tab.discarding = undefined; });
    tab.wc.close({ waitForBeforeUnload: true });
  }
  _discarded(tab: Tab) {
    const url = tab.discarding!;
    tab.discarding = undefined;
    this.emit('tab-closed', tab); // the proxy: its target is gone
    Object.assign(tab, { discarded: true, url, targetId: null, pendingUrl: null, dialog: null, loading: false, canBack: false, canFwd: false });
    try { this.win.contentView.removeChildView(tab.view); this.clipView?.removeChildView(tab.view); } catch {}
    this.emit('changed');
  }
  // Its page back, its process with it: a new view bound as a new tab's, opened at the address kept, the proxy told
  // of a tab added (its target is new). Its place in the strip and the active tab do not change. Resolves as a new
  // tab's ready does.
  load(tab: Tab) {
    if (!tab.discarded || this.deleted) return Promise.resolve();
    const view = new WebContentsView({ webPreferences: { session: this.session, sandbox: true } });
    Object.assign(tab, { discarded: false, view, wc: view.webContents });
    this._bind(tab);
    const ready = this._open(tab, tab.url);
    this.emit('tab-added', tab); this.emit('changed');
    if (this.active === tab.id) this.activate(tab.id);
    return ready;
  }

  // A page's dialog, over a picture of the page (a page is still while its dialog is open). The agent's own actions
  // answer theirs as it asked.
  async _dialog(tab: Tab, { dialogType: type, messageText: message, frame }: DialogInfo, answer: Dialog['answer']) {
    if (tab.agentDialogs) { tab.agentDialogs.asked.push(`${type} "${message}"`); return answer(tab.agentDialogs.accept, ''); }
    let host = ''; try { host = new URL(frame.url).host; } catch {}
    const from = !host ? 'This page says' : frame.parent ? `An embedded page at ${host} says` : `${host} says`;
    const dialog: Dialog = tab.dialog = { id: ++dialogs, type, message, from, answer, picture: null };
    const picture = await Promise.race([tab.wc.capturePage(), new Promise<null>((ok) => setTimeout(ok, 500, null))]).catch((): null => null);
    if (tab.dialog !== dialog) return; // answered meanwhile
    if (picture && !picture.isEmpty()) dialog.picture = `data:image/jpeg;base64,${picture.toJPEG(90).toString('base64')}`;
    this._show(); this.emit('changed');
    // The keys to the dialog, as they were the page's (Enter: OK, Esc: Cancel).
    if (tab.id === this.active && this.shown && !this.win.isDestroyed()) this.win.webContents.focus();
  }
  // The human's answer (OK: true) to the dialog they saw (dialog: its id), not to one that came after it.
  answerDialog(id: string, dialog: number, ok: boolean) {
    const tab = this.get(id);
    if (!tab?.dialog || tab.dialog.id !== dialog) return;
    this._dialogDone(tab, ok);
    this.focusTab(tab);
  }
  // Answered (ok: true or false) or gone (cancelled, answered over CDP).
  _dialogDone(tab: Tab, ok?: boolean) {
    if (!tab.dialog) return;
    if (ok !== undefined) tab.dialog.answer(ok, '');
    tab.dialog = null;
    if (!tab.wc.isDestroyed()) { this._show(); this.emit('changed'); }
  }

  // The addresses of the tabs closed (the human's or the agent's), the last at the end, for reopenTab: in memory, as
  // Chrome keeps them.
  closeTab(id?: string | null) {
    const t = this.get(id);
    if (!t) return;
    const url = t.discarded ? t.url : t.wc.getURL();
    if (url && url !== 'about:blank') { this.closedUrls.push(url); this.closedUrls.splice(0, this.closedUrls.length - CLOSED_KEPT); }
    if (t.discarded) { // no process to close; the proxy was told at the discard
      this._dropped(t, this.tabs.indexOf(t));
      this.emit('changed');
      if (!this.tabs.length && !this.deleted) this.newTab('about:blank');
      return;
    }
    t.closing = true; t.wc.close();
  }
  // The tab closed last, again (Ctrl+Shift+T); null when none was.
  reopenTab() { const url = this.closedUrls.pop(); return url ? this.newTab(url) : null; }

  activate(id: string) {
    if (this.win.isDestroyed()) return;
    for (const t of this.tabs) {
      if (t.wc.isDestroyed()) continue;
      if (t.id === id) {
        this._place(t); t.view.setVisible(this.visible(t));
      } else t.view.setVisible(false);
    }
    this.active = id; this._show(); this.emit('changed');
  }

  // The page is drawn: its pane on screen, nothing over it, not asking (its dialog is HTML, over a picture of it).
  visible(tab: Tab | undefined = this.get()) { return this.shown && !this.hidden && !tab?.dialog; }
  setHidden(hidden: boolean) { this.hidden = hidden; this._show(); }
  // A discarded active tab to be drawn is loaded again, on the next turn: never from inside a webContents' 'destroyed'
  // event, where the tab before it may have gone (Hard-won facts).
  _show() {
    const t = this.get(); if (!t) return;
    if (t.discarded) { if (this.visible(t)) setImmediate(() => { if (t.discarded && this.get() === t && this.visible(t)) void this.load(t); }); return; }
    if (!t.wc.isDestroyed()) t.view.setVisible(this.visible(t));
    this.clipView?.setVisible(this.visible(t));
  }

  // Close (the human closed the profile, or another project is opened): stop automation and close the tabs; the
  // profile's data stays.
  async close() {
    this.deleted = true; // nothing more happens to it
    await this.disconnect();
    this._clearClip();
    await Promise.all([...this.tabs].map((t) => new Promise<void>((resolve) => {
      try { this.win.contentView.removeChildView(t.view); } catch {}
      if (t.wc.isDestroyed()) return resolve();
      t.wc.once('destroyed', () => resolve());
      t.wc.close();
    })));
  }

  // Delete: close, and wipe the profile's data (cookies, storage, cache). Its folder itself is removed at the next
  // start (store.ts); Electron keeps it open while the app runs.
  async destroy() {
    await this.close();
    await wipeSession(this.session);
    this.emit('deleted');
  }

  // The keyboard into a tab's page for the human (a key chose it, a dialog of theirs answered, Pick): theirs, so it stays.
  focusTab(tab: Tab) { if (tab.wc.isDestroyed()) return; allowFocus(tab.wc); tab.wc.focus(); }

  // Its pages into another window (its project moved there), hidden until that window lays them out.
  moveTo(win: BrowserWindow) {
    this._clearClip();
    for (const t of this.tabs) try { this.win.contentView.removeChildView(t.view); } catch {}
    this.win = win; this.hidden = true; this.clip = undefined;
    if (this.active) this.activate(this.active);
  }

  // The tab's DevTools, in their own window (a WebContentsView cannot dock them); none for a discarded tab.
  toggleDevTools(id?: string | null) {
    const t = this.get(id);
    if (!t || t.discarded) return;
    if (t.wc.isDevToolsOpened()) t.wc.closeDevTools();
    else t.wc.openDevTools({ mode: 'detach', title: `${this.name} · DevTools` });
  }
  // The element at a point of the tab's page in its DevTools (the page's right-click menu, Inspect): opened first as
  // toggleDevTools opens them, else inspectElement opens them in its own way.
  inspect(id: string, x: number, y: number) {
    const t = this.get(id);
    if (!t || t.discarded) return;
    if (!t.wc.isDevToolsOpened()) t.wc.openDevTools({ mode: 'detach', title: `${this.name} · DevTools` });
    t.wc.inspectElement(x, y);
  }

  // Where the window's grid puts the pane's page; { shown: false } when the pane is not on screen.
  _clearClip() {
    if (!this.clipView) return;
    if (this.win.isDestroyed()) { this.clipView = undefined; return; }
    for (const child of this.clipView.children) this.win.contentView.addChildView(child);
    this.win.contentView.removeChildView(this.clipView); this.clipView = undefined;
  }
  _place(tab: Tab) {
    if (this.clip) {
      // A native parent clips the page without changing its viewport as the stage scrolls.
      this.clipView ??= new electron.View();
      if (!this.win.contentView.children.includes(this.clipView)) this.win.contentView.addChildView(this.clipView);
      this.clipView.setBounds(this.clip);
      if (!this.clipView.children.includes(tab.view)) this.clipView.addChildView(tab.view);
      tab.view.setBounds({ ...this.bounds, x: this.bounds.x - this.clip.x, y: this.bounds.y - this.clip.y });
    } else {
      this._clearClip();
      if (!this.win.contentView.children.includes(tab.view)) this.win.contentView.addChildView(tab.view);
      tab.view.setBounds(this.bounds);
    }
  }
  layout({ shown = true, clip, ...bounds }: Partial<Bounds> & { shown?: boolean; clip?: Bounds }) {
    this.shown = shown;
    if (shown) { this.bounds = bounds as Bounds; this.clip = clip; const t = this.get(); if (t && !t.discarded) this._place(t); }
    this._show();
    if (this.bounds.width) this.emit('laid-out');
  }
  // On a discarded tab: loaded again at the address (navigate, reload); its history is gone with its process (back,
  // forward: nothing), as a closed tab's is.
  navigate(id: string | null | undefined, url: string) {
    const t = this.get(id)!;
    if (t.discarded) { t.url = toUrl(url); void this.load(t); return; }
    t.wc.loadURL(toUrl(url)).catch(() => {});
  }
  back(id?: string | null) { const t = this.get(id)!; if (!t.discarded) t.wc.navigationHistory.goBack(); }
  forward(id?: string | null) { const t = this.get(id)!; if (!t.discarded) t.wc.navigationHistory.goForward(); }
  // ignoreCache: as Ctrl+Shift+R, every file loaded again.
  reload(id?: string | null, { ignoreCache = false } = {}) {
    const t = this.get(id)!;
    if (t.discarded) { void this.load(t); return; }
    if (ignoreCache) t.wc.reloadIgnoringCache(); else t.wc.reload();
  }

  // Sign-in mode: nothing automated is attached while the human signs in. Playwright disconnects, every tab's
  // debugger is detached (dropping Runtime/Network/Page domains, Playwright's init scripts and bindings). Turning it
  // off reconnects the shell's Playwright.
  // Who turns it on and off: signin-pause.ts.
  async setSigninMode(on: boolean) {
    if (on === this.signinMode || this.deleted) return;
    if (on) {
      this.signinMode = true; // first, so the proxy refuses new clients
      await this.disconnect();
      for (const t of this.tabs) {
        try { if (t.wc.debugger.isAttached()) t.wc.debugger.detach(); } catch {}
        t.targetId = null;
      }
    } else {
      // Reconnect first, then leave the mode: the agent sees the profile again only when it is usable.
      this.resuming = true;
      try { if (this.endpoint) await this.connect(this.endpoint); } finally { this.resuming = false; }
      this.signinMode = false;
    }
    this.emit('changed');
    this.emit('signin-mode', on);
  }

  _host(tab: Tab) { try { return new URL(tab.discarded ? tab.url : tab.wc.getURL()).host; } catch { return ''; } }
  pageZoom(tab: Tab) { return this.siteZoom[this._host(tab)] ?? 1; }
  _applyZoom(tab: Tab) { if (!tab.wc.isDestroyed()) tab.wc.setZoomFactor(this.baseZoom * this.pageZoom(tab)); }
  setBaseZoom(z: number) { this.baseZoom = z; for (const t of this.tabs) this._applyZoom(t); }
  // An empty tab (about:blank) in the window's color, not a white page in a dark window.
  _paintBlank(tab: Tab) {
    const wc = tab.wc;
    if (wc.isDestroyed()) return;
    if (tab.blankCss) void wc.removeInsertedCSS(tab.blankCss).catch(() => {});
    tab.blankCss = undefined;
    if (this.blank && wc.getURL() === 'about:blank') wc.insertCSS(`html { background: ${this.blank} }`).then((k) => { tab.blankCss = k; }, () => {});
  }
  setBlank(color: string) { this.blank = color; for (const t of this.tabs) this._paintBlank(t); }
  // Zoom the site of a tab in this profile: dir 1, -1, or 0 (back to the Kulisa zoom). Emits 'zoom' to be saved.
  zoomSite(id: string | null | undefined, dir: number) {
    const tab = this.get(id); const host = tab && this._host(tab);
    if (!host) return;
    const z = stepZoom(this.pageZoom(tab), dir);
    if (z === 1) delete this.siteZoom[host]; else this.siteZoom[host] = z;
    for (const t of this.tabs) if (this._host(t) === host) this._applyZoom(t);
    this.emit('zoom'); this.emit('changed');
  }

  info(): Sent.Profile {
    return { id: this.id, name: this.name, avatar: this.avatar, description: this.description, login: this.login, hasPassword: this.hasPassword, active: this.active,
      signinMode: this.signinMode,
      tabs: this.tabs.map((t) => ({ id: t.id, title: t.title, url: t.url, favicon: t.favicon, loading: t.loading, canBack: t.canBack, canFwd: t.canFwd,
        zoom: this.pageZoom(t), dialog: t.dialog && { id: t.dialog.id, type: t.dialog.type, message: t.dialog.message, from: t.dialog.from, picture: t.dialog.picture } })) };
  }
}

// A page that did not load: Electron leaves it blank, Chrome says why. Its error page (chrome-error://, the address
// still the one that failed) gets Kulisa's, for the human and for the agent's snapshot alike.
const ERROR_PAGE = fs.readFileSync(path.join(import.meta.dirname, 'error-page.html'), 'utf8');
function errorText(desc: string, host: string): [string, string] {
  if (desc === 'ERR_NAME_NOT_RESOLVED') return ['This site can’t be reached', `${host}’s server IP address could not be found.`];
  if (desc === 'ERR_CONNECTION_REFUSED') return ['This site can’t be reached', `${host} refused to connect. A local app: is its server running?`];
  if (desc === 'ERR_INTERNET_DISCONNECTED') return ['No internet', 'The computer is not connected to the internet.'];
  if (/TIMED_OUT$/.test(desc)) return ['This site can’t be reached', `${host} took too long to respond.`];
  if (desc.startsWith('ERR_CERT_')) return ['Your connection is not private', `${host}’s certificate is not trusted.`];
  return ['This site can’t be reached', `${host} could not be loaded.`];
}
function showError(wc: WebContents, desc: string, url: string) {
  let host: string; try { host = new URL(url).host || url; } catch { host = url; }
  const [title, reason] = errorText(desc, host);
  const fill = ({ page, ...fields }: { page: string } & Record<string, string>) => {
    document.documentElement.innerHTML = page;
    for (const el of document.querySelectorAll<HTMLElement>('[data-field]')) el.textContent = fields[el.dataset.field!] ?? null;
  };
  wc.executeJavaScript(`(${fill})(${JSON.stringify({ page: ERROR_PAGE, title, reason, code: desc, host })})`).catch(() => {});
}

// A closed profile's caches gone: HTTP, compiled code, shaders, and the sites' Cache API (their service workers' copies
// of their own bundles: Chromium counts it as storage, and it was the largest part of a copy, 200 MB for Teams). Sign-ins
// and the sites' other storage stay. Chromium sets the HTTP cache's limit itself from the free disk space; profiles set
// aside should not keep theirs.
async function clearCaches(sess: Session) {
  await sess.clearCache();
  await sess.clearCodeCaches({});
  await sess.clearStorageData({ storages: ['shadercache', 'cachestorage'] });
}

// A profile's data gone: cookies, storage, cache. Also for a closed profile (no Profile object, only its folder).
async function wipeSession(sess: Session) {
  await sess.clearStorageData();
  await sess.clearCache();
  await sess.clearAuthCache();
}

// Attach the tab's debugger once and learn its real Chrome target id (the proxy reports it: cdp-proxy.ts).
async function ensureTarget(tab: Tab): Promise<string> {
  if (tab.targetId) return tab.targetId;
  if (!tab.wc.debugger.isAttached()) tab.wc.debugger.attach('1.3');
  const { targetInfo } = await tab.wc.debugger.sendCommand('Target.getTargetInfo');
  return (tab.targetId = targetInfo.targetId);
}

// The CDP target id of a Playwright page (the proxy reports real Chrome target ids).
const targetIds = new WeakMap<Page, string>();
async function targetIdOf(page: Page) {
  if (!targetIds.has(page)) {
    const s = await page.context().newCDPSession(page);
    const { targetInfo } = await s.send('Target.getTargetInfo');
    await s.detach().catch(() => {});
    targetIds.set(page, targetInfo.targetId);
  }
  return targetIds.get(page);
}

export type { Tab, ProfileConfig, Bounds };
export { Profile, stepZoom, wipeSession, clearCaches, toUrl, ensureTarget };
