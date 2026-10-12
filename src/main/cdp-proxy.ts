// CDP proxy: one fake "browser" endpoint per profile, backed by webContents.debugger of that profile's tabs.
// No --remote-debugging-port: the shell UI is never exposed, only profile tabs. A profile is known by its task's
// key (its project's id and its number) and its id; each part percent-encoded in the URL (ids may have any letters):
//   http://127.0.0.1:<port>/<project>/<n>/<profile>/json/version
//     -> webSocketDebuggerUrl ws://127.0.0.1:<port>/<project>/<n>/<profile>
// Clients: playwright-core chromium.connectOverCDP(), @playwright/mcp --cdp-endpoint.
// Every command passes through here, so the shell can show it (ghost cursor, timeline).
import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import http from 'http';
import type { WebSocket } from 'ws';
import type { AddressInfo } from 'net';
import { fromLocalTool } from './local-only.ts';
import type { Profile, Tab } from './profiles.ts';

// CDP's params and results: JSON the proxy passes on as it is.
type Json = Record<string, any>;
// A command as the proxy saw it (for the ghost cursor: ghost.ts).
interface Command { profile: string; task: string; method: string; params: Json; sessionId?: string }
type Session = { tab: Tab; off: () => void; browser?: undefined } | { browser: true; tab?: undefined; off?: undefined };

class CdpProxy extends EventEmitter {
  profiles = new Map<string, Profile>(); clients = new Set<ProxyClient>(); server?: http.Server; port?: number;

  addProfile(profile: Profile) { this.profiles.set(key(profile), profile); }
  removeProfile(profile: Profile) {
    this.profiles.delete(key(profile));
    for (const c of this.clients) if (c.profile === profile) c.socket.close();
  }

  listen(port = 0) {
    this.server = http.createServer((req, res) => {
      if (!fromLocalTool(req)) { res.writeHead(403); return res.end(); }
      const p = this.profiles.get(keyOf(req.url!));
      if (!p) { res.writeHead(404); return res.end(); }
      const route = '/' + req.url!.split('/').slice(4).join('/').replace(/\/$/, '');
      const taskUrl = this.endpoint(p).replace(/^http/, 'ws');
      res.setHeader('content-type', 'application/json');
      if (route === '/json/version') return res.end(JSON.stringify({ Browser: `Kulisa/${process.versions.chrome}`, 'Protocol-Version': '1.3', 'User-Agent': p.session.getUserAgent(), webSocketDebuggerUrl: taskUrl }));
      if (route === '/json/list' || route === '/json') return res.end(JSON.stringify(p.tabs.map((t) => ({ id: t.id, type: 'page', title: t.title, url: t.url }))));
      res.writeHead(404); res.end();
    });
    const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    this.server.on('upgrade', (req, sock, head) => {
      if (!fromLocalTool(req)) return sock.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      const p = this.profiles.get(keyOf(req.url!));
      if (!p) return sock.destroy();
      // The human is signing in: no automation attaches (except the shell's own reconnect when the mode ends).
      if (p.signinMode && !p.resuming) return sock.destroy();
      wss.handleUpgrade(req, sock, head, (socket) => new ProxyClient(this, p, socket));
    });
    return new Promise<number>((r) => this.server!.listen(port, '127.0.0.1', () => { this.port = (this.server!.address() as AddressInfo).port; r(this.port); }));
  }
  endpoint(profile: Profile) { return `http://127.0.0.1:${this.port}/${key(profile).split('/').map(encodeURIComponent).join('/')}`; }
  // The profile's id changed: its endpoint too.
  renamed(profile: Profile, oldId: string) {
    this.profiles.delete(`${profile.task}/${oldId}`); this.addProfile(profile);
  }
}
const key = (profile: Profile) => `${profile.task}/${profile.id}`;
// The key a request's path names (its first three parts); '' when it is not one.
function keyOf(url: string) {
  try { return url.split(/[/?]/).slice(1, 4).map(decodeURIComponent).join('/'); } catch { return ''; }
}

// Attach the tab's debugger once and learn its real Chrome target id.
async function ensureTarget(tab: Tab): Promise<string> {
  if (tab.targetId) return tab.targetId;
  if (!tab.wc.debugger.isAttached()) tab.wc.debugger.attach('1.3');
  const { targetInfo } = await tab.wc.debugger.sendCommand('Target.getTargetInfo');
  return (tab.targetId = targetInfo.targetId);
}

class ProxyClient {
  proxy: CdpProxy; profile: Profile; socket: WebSocket;
  autoAttach: Json | null = null;                 // params of browser-level Target.setAutoAttach
  discover = false;
  attached = new Map<string, string>();           // auto-attached tab.id -> sessionId
  sessions = new Map<string, Session>();          // our sessionId -> { tab, off } (page) or { browser: true }
  n = 0;
  childSessions = new Map<string, Tab>();         // Chrome child sessionId (iframes, workers) -> tab
  waiting = new Set<Tab>();                       // tabs to show once their site answers (tab.answered in profiles.ts)
  onTab: (tab: Tab) => void; onClosed: (tab: Tab) => void; onChanged: () => void;
  constructor(proxy: CdpProxy, profile: Profile, socket: WebSocket) {
    this.proxy = proxy; this.profile = profile; this.socket = socket;
    proxy.clients.add(this);
    this.onTab = (tab) => this._tabAdded(tab);
    this.onClosed = (tab) => this._tabRemoved(tab);
    this.onChanged = () => this._infoChanged();
    profile.on('tab-added', this.onTab); profile.on('tab-closed', this.onClosed); profile.on('changed', this.onChanged);
    socket.on('message', (d) => this._handle(JSON.parse(d.toString())).catch((e) => console.error('[proxy]', e)));
    socket.on('close', () => {
      profile.off('tab-added', this.onTab); profile.off('tab-closed', this.onClosed); profile.off('changed', this.onChanged);
      for (const sess of this.sessions.values()) if (sess.off) sess.off();
      proxy.clients.delete(this);
    });
  }
  _send(msg: Json) { if (this.socket.readyState === 1) this.socket.send(JSON.stringify(msg)); }
  _event(method: string, params: Json, sessionId?: string) { this._send({ method, params, ...(sessionId ? { sessionId } : {}) }); }
  _targetInfo(tab: Tab) {
    // Real Chrome target ids: Playwright relies on "main frame id == target id".
    return { targetId: tab.targetId, type: 'page', title: tab.title || '', url: tab.url || 'about:blank', attached: this.attached.has(tab.id), canAccessOpener: false, browserContextId: 'default' };
  }

  async _handle(msg: Json) {
    const { id, method, params = {}, sessionId } = msg as { id: number; method: string; params?: Json; sessionId?: string };
    const reply = (result: Json) => this._send({ id, result, ...(sessionId ? { sessionId } : {}) });
    const fail = (message: string) => this._send({ id, error: { code: -32000, message }, ...(sessionId ? { sessionId } : {}) });
    this.proxy.emit('command', { profile: this.profile.id, task: this.profile.task, method, params, sessionId } satisfies Command);

    if (sessionId && this.sessions.get(sessionId)?.browser) return this._browserCommand(method, params, sessionId, reply, fail);
    if (sessionId) {
      const tab = this.sessions.get(sessionId)?.tab || this.childSessions.get(sessionId);
      if (!tab) return fail(`No session ${sessionId}`);
      const child = this.childSessions.has(sessionId) ? sessionId : undefined;
      // The debugger session is never paused on start, so there is nothing to resume.
      if (method === 'Runtime.runIfWaitingForDebugger' && !child) return reply({});
      if (method === 'Page.close' && !child) { this.profile.closeTab(tab.id); return reply({}); }
      if (method === 'Target.detachFromTarget' && this.sessions.has(params.sessionId)) { this._detach(params.sessionId); return reply({}); }
      try { reply(await tab.wc.debugger.sendCommand(method, params, child)); }
      catch (e) { fail((e as Error).message); }
      return;
    }
    return this._browserCommand(method, params, undefined, reply, fail);
  }

  _browserCommand(method: string, params: Json, sessionId: string | undefined, reply: (result: Json) => void, fail: (message: string) => void) {
    switch (method) {
      case 'Browser.getVersion':
        return reply({ protocolVersion: '1.3', product: `Chrome/${process.versions.chrome}`, revision: '', userAgent: this.profile.session.getUserAgent(), jsVersion: process.versions.v8 });
      case 'Target.setAutoAttach':
        this.autoAttach = params;
        return Promise.all(this._shown().map((t) => ensureTarget(t))).then(() => {
          reply({});
          for (const t of this._shown()) this._attach(t, params.waitForDebuggerOnStart);
        });
      case 'Target.setDiscoverTargets':
        this.discover = params.discover;
        return Promise.all(this._shown().map((t) => ensureTarget(t))).then(() => {
          reply({});
          if (this.discover) for (const t of this._shown()) this._event('Target.targetCreated', { targetInfo: this._targetInfo(t) });
        });
      case 'Target.getTargets':
        return Promise.all(this._shown().map((t) => ensureTarget(t))).then(() => reply({ targetInfos: this._shown().map((t) => this._targetInfo(t)) }));
      case 'Target.getTargetInfo':
        if (!params.targetId) return reply({ targetInfo: { targetId: 'browser', type: 'browser', title: '', url: '', attached: true, canAccessOpener: false } });
        return reply({ targetInfo: this._targetInfo(this.profile.get(params.targetId)!) });
      case 'Target.attachToTarget': {
        // A second, independent session to a page (Playwright newCDPSession, other tools).
        const tab = this.profile.get(params.targetId);
        if (!tab) return fail('No target');
        const sid = this._attach(tab, false, sessionId);
        return reply({ sessionId: sid });
      }
      case 'Target.attachToBrowserTarget': {
        const sid = `browser-${++this.n}`;
        this.sessions.set(sid, { browser: true });
        return reply({ sessionId: sid });
      }
      case 'Target.detachFromTarget':
        this._detach(params.sessionId); return reply({});
      case 'Target.createTarget': {
        const tab = this.profile.newTab(params.url || 'about:blank', { activate: !params.background });
        return Promise.resolve(tab.ready).then(() => ensureTarget(tab)).then(() => reply({ targetId: tab.targetId }));
      }
      case 'Target.closeTarget':
        this.profile.closeTab(params.targetId); return reply({ success: true });
      case 'Target.activateTarget':
        this.profile.activate(params.targetId); return reply({});
      case 'Target.getBrowserContexts':
        return reply({ browserContextIds: [] });
      case 'Target.createBrowserContext':
        return fail('Kulisa: a profile is one browser context; create another profile instead');
      case 'Browser.getWindowForTarget':
        return reply({ windowId: 1, bounds: { left: 0, top: 0, width: this.profile.bounds.width, height: this.profile.bounds.height, windowState: 'normal' } });
      case 'Browser.close':
        return reply({}); // the human owns the window; ignore
      default:
        // Browser.setDownloadBehavior, Browser.grantPermissions, Target.setRemoteLocations, ... are accepted and ignored.
        if (!/^(Browser\.(setDownloadBehavior|grantPermissions|resetPermissions|setWindowBounds|setPermission)|Target\.(setRemoteLocations|disposeBrowserContext))$/.test(method)) console.warn('[proxy] ignored browser-level', method);
        return reply({});
    }
  }

  // Every session of a tab shares the tab's single webContents.debugger; events fan out to all of them.
  _attach(tab: Tab, waiting: boolean, announceTo?: string) {
    const auto = announceTo === undefined;
    if (auto && this.attached.has(tab.id)) return this.attached.get(tab.id)!;
    if (!tab.wc.debugger.isAttached()) tab.wc.debugger.attach('1.3');
    const sid = auto ? tab.id : `${tab.id}.${++this.n}`;
    const listener = (_e: Electron.Event, method: string, params: Json, childSid?: string) => {
      if (childSid) return this._event(method, params, childSid);
      if (auto && method === 'Target.attachedToTarget') this.childSessions.set(params.sessionId, tab);
      if (auto && method === 'Target.detachedFromTarget') this.childSessions.delete(params.sessionId);
      this._event(method, params, sid);
    };
    tab.wc.debugger.on('message', listener);
    this.sessions.set(sid, { tab, off: () => { if (!tab.wc.isDestroyed()) tab.wc.debugger.removeListener('message', listener); } });
    if (auto) this.attached.set(tab.id, sid);
    const info = { ...this._targetInfo(tab), attached: true };
    if (auto) this._event('Target.attachedToTarget', { sessionId: sid, targetInfo: info, waitingForDebugger: !!waiting });
    else if (announceTo) this._event('Target.attachedToTarget', { sessionId: sid, targetInfo: info, waitingForDebugger: false }, announceTo);
    return sid;
  }
  _detach(sid: string) {
    const sess = this.sessions.get(sid); if (!sess) return;
    if (sess.off) sess.off();
    this.sessions.delete(sid);
    if (sess.tab && this.attached.get(sess.tab.id) === sid) this.attached.delete(sess.tab.id);
  }
  // The tabs a client sees: those whose site has answered; the others are shown when it does.
  _shown() {
    for (const t of this.profile.tabs) if (t.answered) void this._tabAdded(t);
    return this.profile.tabs.filter((t) => !t.answered);
  }
  async _tabAdded(tab: Tab) {
    if (tab.answered) {
      if (this.waiting.has(tab)) return;
      this.waiting.add(tab);
      await tab.answered;
      this.waiting.delete(tab);
      if (!this.profile.tabs.includes(tab) || !this.proxy.clients.has(this)) return;
    }
    await ensureTarget(tab);
    if (this.discover) this._event('Target.targetCreated', { targetInfo: this._targetInfo(tab) });
    if (this.autoAttach && this.autoAttach.autoAttach) this._attach(tab, this.autoAttach.waitForDebuggerOnStart);
  }
  _tabRemoved(tab: Tab) {
    const auto = this.attached.get(tab.id);
    for (const [sid, sess] of [...this.sessions]) {
      if (sess.tab !== tab) continue;
      this._detach(sid);
      this._event('Target.detachedFromTarget', { sessionId: sid, targetId: tab.targetId });
    }
    if (this.discover || auto) this._event('Target.targetDestroyed', { targetId: tab.targetId });
  }
  _infoChanged() {
    if (!this.discover) return;
    for (const t of this.profile.tabs) this._event('Target.targetInfoChanged', { targetInfo: this._targetInfo(t) });
  }
}

export type { Command };
export { CdpProxy, ensureTarget };
