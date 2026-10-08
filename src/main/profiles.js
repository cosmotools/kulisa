// A profile: one embedded browser profile (an Electron session on a folder of its own, as a Chrome profile) with its
// own tabs.
// Each tab is a WebContentsView. Automation reaches the tabs only through the CDP proxy (cdp-proxy.js), and the
// shell's own Playwright connection (`connect`) is one client of that proxy.
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { session, WebContentsView } = require('electron');
const { chromium } = require('playwright-core');
const mimicChrome = require('./mimic-chrome');
const { ensureTarget } = require('./cdp-proxy');

let nextTab = 1;
// Zoom levels, as in Chrome. Ctrl + / - step through them; 1 is 100 %.
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
// The next zoom level from z: dir 1 bigger, -1 smaller, 0 back to 1.
function stepZoom(z, dir) {
  if (!dir) return 1;
  const next = dir > 0 ? ZOOM_STEPS.find((s) => s > z + 1e-6) : ZOOM_STEPS.findLast((s) => s < z - 1e-6);
  return next ?? z;
}
// Ctrl + / - / 0 (Cmd on macOS) in a keyDown input event: 1, -1 or 0; undefined for any other input.
function zoomKey(i) {
  if (i.type !== 'keyDown' || !(i.control || i.meta) || i.alt) return undefined;
  return { '=': 1, '+': 1, '-': -1, '0': 0 }[i.key];
}
// What the human types in the address bar, or the agent passes, as a URL: one with a scheme as it is; a host (with a
// path) over https, localhost over http; anything else is searched for. "localhost:3000" is a host and a port, not a
// scheme.
function toUrl(u) {
  u = u.trim();
  if (/^[a-z][\w+.-]*:/i.test(u) && !/^[\w.-]+:\d+(\/|$)/.test(u)) return u;
  if (/^(localhost|127\.)/.test(u)) return 'http://' + u;
  if (/^[\w.-]+(:\d+)?(\/|$)/.test(u)) return 'https://' + u;
  return 'https://www.google.com/search?q=' + encodeURIComponent(u);
}
let dialogs = 0; // pages' dialogs, numbered: the human's answer goes to the one they saw
const PAGE_RADIUS = 8; // a little less than the island's corners, which the page reaches (renderer window.css, .content)

class Profile extends EventEmitter {
  // cfg: { id, name, avatar, description, folder, dir }. The folder (cookies, storage; dir is its absolute path) is fixed at
  // creation; a rename changes id and name only.
  // win: the window it shows in (moveTo). ws: its workspace's key (profiles of different workspaces share ids).
  // mimic: a chromeIdentity() to present as Google Chrome, or null.
  constructor(win, cfg, { ws, mimic = null } = {}) {
    super();
    this.win = win;
    this.id = cfg.id; this.name = cfg.name; this.avatar = cfg.avatar; this.description = cfg.description || '';
    this.folder = cfg.folder; this.dir = cfg.dir; this.ws = ws;
    // Page zoom: pages follow the Kulisa zoom (baseZoom, set by the window); a site the human zoomed with Ctrl + / -
    // in a page keeps its own factor on top of it, per host, in this profile only (saved in profiles.json).
    this.baseZoom = 1;
    this.siteZoom = { ...(cfg.zoom || {}) };
    this.session = session.fromPath(this.dir);
    this.mimic = mimic ? mimicChrome.applyToSession(this.session, mimic) : null;
    this.tabs = []; this.active = null; this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    this.browser = null; this.context = null; this.endpoint = null; this.signinMode = false;
    this.hidden = false; // views hidden while a window-wide dialog is open or a pane is dragged (they draw above the HTML)
    this.shown = true; // false while the pane is not on screen in the grid (stacked behind another pane)
    this.deleted = false;
  }

  // The shell's Playwright connection through the proxy (picker, MCP tools).
  async connect(endpoint) {
    this.endpoint = endpoint;
    this.browser = await chromium.connectOverCDP(endpoint);
    this.context = this.browser.contexts()[0];
    // With no listener Playwright dismisses every dialog (alert, confirm), the human's too; with one they stay for
    // the human. The agent's tools answer those its own actions open (mcp-server.js).
    this.context.on('dialog', () => {});
  }
  async disconnect() {
    const b = this.browser;
    this.browser = null; this.context = null;
    if (b) await b.close().catch(() => {});
  }

  // Playwright Page for a tab (default: the active one).
  async page(tabId) {
    const tab = this.get(tabId);
    if (!tab) throw new Error(`no tab ${tabId}`);
    if (!this.context) throw new Error(`profile ${this.id} is not connected`);
    const id = await ensureTarget(tab);
    for (let i = 0; i < 50; i++) {
      for (const p of this.context.pages()) if ((await targetIdOf(p)) === id) return p;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`no Playwright page for tab ${id}`);
  }

  get(id) { id = id || this.active; return this.tabs.find((t) => t.id === id || t.targetId === id); }

  newTab(url, { activate = true } = {}) {
    url = url && toUrl(url);
    const view = new WebContentsView({ webPreferences: { session: this.session, sandbox: true } });
    const tab = this._add(view);
    const wc = view.webContents;
    // The URL it is opening, until a page commits: a tab closed while it loads is saved as that (app.js).
    tab.pendingUrl = url;
    wc.on('did-navigate', (_e, u) => { if (u !== 'about:blank') tab.pendingUrl = null; });
    // The identity override must be in place before the first request. A fresh webContents has no renderer and
    // CDP commands wait for one, so: about:blank (no network) → override → the real URL.
    const ready = this.mimic
      ? wc.loadURL('about:blank').catch(() => {}).then(() => mimicChrome.applyToWebContents(wc, this.mimic)).catch((e) => console.error('[mimic]', e.message))
      : Promise.resolve();
    // tab.answered (null once it has): the URL's first page, or its error page, is there. Until then Chromium holds
    // CDP commands to the tab, so the proxy shows it to clients only after: a site that never answers would hang
    // them, and opening the profile with them (cdp-proxy.js).
    if (url && url !== 'about:blank') {
      tab.answered = new Promise((resolve) => {
        const navigated = (_e, u) => { if (u !== 'about:blank') done(); };
        const failed = (_e, code, _d, _u, mainFrame) => { if (mainFrame && code !== -3) done(); }; // -3: replaced by another navigation
        const done = () => { wc.off('did-navigate', navigated); wc.off('did-fail-load', failed); resolve(); };
        wc.on('did-navigate', navigated); wc.on('did-fail-load', failed);
      }).then(() => { tab.answered = null; });
    }
    // tab.ready: the first navigation has committed. A client that attaches earlier sees a never-loaded tab.
    tab.ready = ready.then(() => url && new Promise((resolve) => {
      if (wc.isDestroyed()) return resolve(); // closed before it loaded (its profile closed or deleted)
      wc.once('did-navigate', resolve); setTimeout(resolve, 5000);
      wc.loadURL(url).then(() => { if (this.mimic) wc.navigationHistory.clear(); }).catch(() => {});
    }));
    if (activate) this.activate(tab.id);
    return tab;
  }

  _add(view) {
    const tab = { id: `k${nextTab++}`, view, wc: view.webContents, title: '', url: '', favicon: '', loading: false, answered: null };
    const wc = tab.wc;
    view.setBorderRadius(PAGE_RADIUS);
    const update = () => {
      if (wc.isDestroyed()) return;
      tab.title = wc.getTitle(); tab.url = wc.getURL(); tab.loading = wc.isLoading();
      tab.canBack = wc.navigationHistory.canGoBack(); tab.canFwd = wc.navigationHistory.canGoForward();
      this.emit('changed');
    };
    for (const e of ['did-start-loading', 'did-stop-loading', 'page-title-updated', 'did-navigate', 'did-navigate-in-page']) wc.on(e, update);
    // F12 or Ctrl+Shift+I: the tab's DevTools, in their own window (a WebContentsView cannot dock them).
    wc.on('did-navigate', () => this._applyZoom(tab));
    wc.on('did-fail-load', (_e, code, desc, url, mainFrame) => { if (mainFrame && code !== -3) showError(wc, desc, url); }); // -3: replaced by another navigation
    // A page never moves the window, as in Chrome. Kulisa's window has no system title bar, and Electron takes
    // app-region: drag from its views too: Teams declares one, and it stays after the page has gone, taking every
    // click and wheel over the panes (docs/window.md). Each document gets no-drag everywhere, which also replaces a
    // region left behind. A workaround of electron/electron#54743: remove when fixed (ROADMAP, "Workarounds of Electron bugs").
    wc.on('did-navigate', () => wc.insertCSS('html, html * { app-region: no-drag !important; }', { cssOrigin: 'user' }).catch(() => {}));
    wc.on('before-input-event', (e, i) => {
      if (i.type === 'keyDown' && (i.key === 'F12' || ((i.control || i.meta) && i.shift && i.key.toLowerCase() === 'i'))) {
        e.preventDefault(); this.toggleDevTools(tab.id);
      }
      // Ctrl + / - / 0 (Cmd on macOS): zoom this site, as in Chrome.
      const dir = zoomKey(i);
      if (dir !== undefined) { e.preventDefault(); this.zoomSite(tab.id, dir); }
    });
    // alert and confirm in the tab's pane, as Chrome shows them in the page, not Electron's message box in the middle of
    // the window, which did not say which page asked (Electron shows no prompt(): it throws in the page). Electron's
    // handler is a listener of its internal event (lib/browser/api/web-contents.ts, Electron 44), replaced here: check
    // it at every Electron upgrade (ROADMAP, "Workarounds of Electron bugs"). Answered by the human (answerDialog), by
    // an action of the agent (tab.agentDialogs, mcp-server.js), or by another client over CDP. Chromium holds a
    // navigation while a dialog is open; as Chrome does, it is dismissed when one starts (the address bar, reload).
    wc.removeAllListeners('-run-dialog');
    wc.on('-run-dialog', (info, answer) => this._dialog(tab, info, answer));
    wc.on('-cancel-dialogs', () => this._dialogDone(tab));
    wc.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => { if (isMainFrame && !isSameDocument) this._dialogDone(tab, false); });
    wc.debugger.on('message', (_e, method) => { if (method === 'Page.javascriptDialogClosed') this._dialogDone(tab); });
    wc.on('page-favicon-updated', (_e, favs) => { tab.favicon = favs[0] || ''; this.emit('changed'); });
    // window.open and target=_blank become tabs of the same profile; createWindow keeps the opener relationship.
    wc.setWindowOpenHandler(({ url }) => ({
      action: 'allow', outlivesOpener: true,
      createWindow: (options) => {
        // Must adopt options.webContents (Chromium already created it); a fresh one freezes the main process.
        const v = new WebContentsView({ webPreferences: options.webPreferences, webContents: options.webContents });
        const t = this._add(v); t.url = url; this.activate(t.id);
        // A popup is already navigating; the session-level header hook covers its first request.
        if (this.mimic) setImmediate(() => mimicChrome.applyToWebContents(v.webContents, this.mimic).catch(() => {}));
        return v.webContents;
      },
    }));
    wc.on('destroyed', () => this._removed(tab));
    this.tabs.push(tab);
    this.emit('tab-added', tab); this.emit('changed');
    return tab;
  }

  _removed(tab) {
    const i = this.tabs.indexOf(tab); if (i < 0) return;
    this.tabs.splice(i, 1);
    try { this.win.contentView.removeChildView(tab.view); } catch {}
    if (this.active === tab.id) { this.active = null; if (this.tabs.length) this.activate(this.tabs[Math.max(0, i - 1)].id); }
    this.emit('tab-closed', tab); this.emit('changed');
    // Its last tab closed (closeTab: the human's ×, the agent's browser_tab_close), the profile still open: an empty
    // tab takes its place, so the pane is never left without a page (its address and toolbar acting on nothing). Not
    // for a tab destroyed otherwise: Kulisa quitting (a new tab then crashes Electron), its profile closing.
    if (!this.tabs.length && !this.deleted && tab.closing) this.newTab('about:blank');
  }

  // A page's dialog, over a picture of the page (a page is still while its dialog is open). The agent's own actions
  // answer theirs as it asked.
  async _dialog(tab, { dialogType: type, messageText: message, frame }, answer) {
    if (tab.agentDialogs) { tab.agentDialogs.asked.push(`${type} "${message}"`); return answer(tab.agentDialogs.accept, ''); }
    let host = ''; try { host = new URL(frame.url).host; } catch {}
    const from = !host ? 'This page says' : frame.parent ? `An embedded page at ${host} says` : `${host} says`;
    const dialog = tab.dialog = { id: ++dialogs, type, message, from, answer, picture: null };
    const picture = await Promise.race([tab.wc.capturePage(), new Promise((ok) => setTimeout(ok, 500, null))]).catch(() => null);
    if (tab.dialog !== dialog) return; // answered meanwhile
    if (picture && !picture.isEmpty()) dialog.picture = `data:image/jpeg;base64,${picture.toJPEG(90).toString('base64')}`;
    this._show(); this.emit('changed');
    // The keys to the dialog, as they were the page's (Enter: OK, Esc: Cancel).
    if (tab.id === this.active && this.shown && !this.win.isDestroyed()) this.win.webContents.focus();
  }
  // The human's answer (OK: true) to the dialog they saw (dialog: its id), not to one that came after it.
  answerDialog(id, dialog, ok) {
    const tab = this.get(id);
    if (!tab?.dialog || tab.dialog.id !== dialog) return;
    this._dialogDone(tab, ok);
    tab.wc.focus();
  }
  // Answered (ok: true or false) or gone (cancelled, answered over CDP).
  _dialogDone(tab, ok) {
    if (!tab.dialog) return;
    if (ok !== undefined) tab.dialog.answer(ok, '');
    tab.dialog = null;
    if (!tab.wc.isDestroyed()) { this._show(); this.emit('changed'); }
  }

  closeTab(id) { const t = this.get(id); if (t) { t.closing = true; t.wc.close(); } }

  activate(id) {
    if (this.win.isDestroyed()) return;
    for (const t of this.tabs) {
      if (t.wc.isDestroyed()) continue;
      if (t.id === id) {
        if (!this.win.contentView.children.includes(t.view)) this.win.contentView.addChildView(t.view);
        t.view.setBounds(this.bounds); t.view.setVisible(this.visible(t));
      } else t.view.setVisible(false);
    }
    this.active = id; this.emit('changed');
  }

  // The page is drawn: its pane on screen, nothing over it, not asking (its dialog is HTML, over a picture of it).
  visible(tab = this.get()) { return this.shown && !this.hidden && !tab?.dialog; }
  setHidden(hidden) { this.hidden = hidden; this._show(); }
  _show() { const t = this.get(); if (t && !t.wc.isDestroyed()) t.view.setVisible(this.visible(t)); }

  // Close (the human closed the profile, or another project is opened): stop automation and close the tabs; the
  // profile's data stays.
  async close() {
    this.deleted = true; // nothing more happens to it
    await this.disconnect();
    await Promise.all([...this.tabs].map((t) => new Promise((resolve) => {
      try { this.win.contentView.removeChildView(t.view); } catch {}
      if (t.wc.isDestroyed()) return resolve();
      t.wc.once('destroyed', resolve);
      t.wc.close();
    })));
  }

  // Delete: close, and wipe the profile's data (cookies, storage, cache). Its folder itself is removed at the next
  // start (store.js); Electron keeps it open while the app runs.
  async destroy() {
    await this.close();
    await wipeSession(this.session);
    this.emit('deleted');
  }

  // Its pages into another window (its project moved there), hidden until that window lays them out.
  moveTo(win) {
    for (const t of this.tabs) try { this.win.contentView.removeChildView(t.view); } catch {}
    this.win = win; this.hidden = true;
    if (this.active) this.activate(this.active);
  }

  toggleDevTools(id) {
    const wc = this.get(id).wc;
    if (wc.isDevToolsOpened()) wc.closeDevTools();
    else wc.openDevTools({ mode: 'detach', title: `${this.name} · DevTools` });
  }

  // Where the window's grid puts the pane's page; { shown: false } when the pane is not on screen.
  layout({ shown = true, ...bounds }) {
    this.shown = shown;
    if (shown) { this.bounds = bounds; const t = this.get(); if (t) t.view.setBounds(bounds); }
    this._show();
  }
  navigate(id, url) { this.get(id).wc.loadURL(toUrl(url)).catch(() => {}); }
  back(id) { this.get(id).wc.navigationHistory.goBack(); }
  forward(id) { this.get(id).wc.navigationHistory.goForward(); }
  reload(id) { this.get(id).wc.reload(); }

  // Sign-in mode: nothing automated is attached while the human signs in. Playwright disconnects, every tab's
  // debugger is detached (dropping Runtime/Network/Page domains, Playwright's init scripts and bindings), and
  // only the Chrome identity override is put back. Turning it off reconnects the shell's Playwright.
  // Who turns it on and off: signin-pause.js.
  async setSigninMode(on) {
    if (on === this.signinMode || this.deleted) return;
    if (on) {
      this.signinMode = true; // first, so the proxy refuses new clients
      await this.disconnect();
      for (const t of this.tabs) {
        try { if (t.wc.debugger.isAttached()) t.wc.debugger.detach(); } catch {}
        t.targetId = null;
        if (this.mimic) await mimicChrome.applyToWebContents(t.wc, this.mimic).catch(() => {});
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

  _host(tab) { try { return new URL(tab.wc.getURL()).host; } catch { return ''; } }
  pageZoom(tab) { return this.siteZoom[this._host(tab)] ?? 1; }
  _applyZoom(tab) { if (!tab.wc.isDestroyed()) tab.wc.setZoomFactor(this.baseZoom * this.pageZoom(tab)); }
  setBaseZoom(z) { this.baseZoom = z; for (const t of this.tabs) this._applyZoom(t); }
  // Zoom the site of a tab in this profile: dir 1, -1, or 0 (back to the Kulisa zoom). Emits 'zoom' to be saved.
  zoomSite(id, dir) {
    const tab = this.get(id); const host = tab && this._host(tab);
    if (!host) return;
    const z = stepZoom(this.pageZoom(tab), dir);
    if (z === 1) delete this.siteZoom[host]; else this.siteZoom[host] = z;
    for (const t of this.tabs) if (this._host(t) === host) this._applyZoom(t);
    this.emit('zoom'); this.emit('changed');
  }

  info() {
    // key: stable across renames (the folder), for the UI to keep the same pane.
    return { key: this.folder, id: this.id, name: this.name, avatar: this.avatar, description: this.description, active: this.active,
      signinMode: this.signinMode,
      tabs: this.tabs.map((t) => ({ id: t.id, title: t.title, url: t.url, favicon: t.favicon, loading: t.loading, canBack: t.canBack, canFwd: t.canFwd,
        zoom: this.pageZoom(t), dialog: t.dialog && { id: t.dialog.id, type: t.dialog.type, message: t.dialog.message, from: t.dialog.from, picture: t.dialog.picture } })) };
  }
}

// A page that did not load: Electron leaves it blank, Chrome says why. Its error page (chrome-error://, the address
// still the one that failed) gets Kulisa's, for the human and for the agent's snapshot alike.
const ERROR_PAGE = fs.readFileSync(path.join(__dirname, 'error-page.html'), 'utf8');
function errorText(desc, host) {
  if (desc === 'ERR_NAME_NOT_RESOLVED') return ['This site can’t be reached', `${host}’s server IP address could not be found.`];
  if (desc === 'ERR_CONNECTION_REFUSED') return ['This site can’t be reached', `${host} refused to connect. A local app: is its server running?`];
  if (desc === 'ERR_INTERNET_DISCONNECTED') return ['No internet', 'The computer is not connected to the internet.'];
  if (/TIMED_OUT$/.test(desc)) return ['This site can’t be reached', `${host} took too long to respond.`];
  if (desc.startsWith('ERR_CERT_')) return ['Your connection is not private', `${host}’s certificate is not trusted.`];
  return ['This site can’t be reached', `${host} could not be loaded.`];
}
function showError(wc, desc, url) {
  let host; try { host = new URL(url).host || url; } catch { host = url; }
  const [title, reason] = errorText(desc, host);
  const fill = ({ page, ...fields }) => {
    document.documentElement.innerHTML = page;
    for (const el of document.querySelectorAll('[data-field]')) el.textContent = fields[el.dataset.field];
  };
  wc.executeJavaScript(`(${fill})(${JSON.stringify({ page: ERROR_PAGE, title, reason, code: desc, host })})`).catch(() => {});
}

// A closed profile's caches gone: HTTP, compiled code, shaders. Sign-ins and sites' storage stay. Chromium sets the HTTP
// cache's limit itself from the free disk space; profiles set aside should not keep theirs (ROADMAP, "Profiles'
// caches").
async function clearCaches(sess) {
  await sess.clearCache();
  await sess.clearCodeCaches({});
  await sess.clearStorageData({ storages: ['shadercache'] });
}

// A profile's data gone: cookies, storage, cache. Also for a closed profile (no Profile object, only its folder).
async function wipeSession(sess) {
  await sess.clearStorageData();
  await sess.clearCache();
  await sess.clearAuthCache();
}

// The CDP target id of a Playwright page (the proxy reports real Chrome target ids).
const targetIds = new WeakMap();
async function targetIdOf(page) {
  if (!targetIds.has(page)) {
    const s = await page.context().newCDPSession(page);
    const { targetInfo } = await s.send('Target.getTargetInfo');
    await s.detach().catch(() => {});
    targetIds.set(page, targetInfo.targetId);
  }
  return targetIds.get(page);
}

module.exports = { Profile, stepZoom, zoomKey, wipeSession, clearCaches, toUrl };
