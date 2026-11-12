// One retained task UI and its native attachment; core policy comes from the host (../README.md).
import electron from 'electron';
import { registerWindowUi, focusWindow } from '../../browser/main/index.ts';
import { handle } from '../../main/ipc.ts';
import { log } from '../../main/log.ts';
import type { Arg, Events } from '../../shared/ipc.ts';
import type { ProjectsInfo, Shortcut } from '../../shared/types.ts';
import type { PageLayout, TaskPresentation, TaskViewport } from '../ipc.ts';
import type { BaseWindow, Rectangle, WebContents, WebContentsView } from 'electron';

const { View, WebContentsView: UiView, shell: electronShell } = electron;
const attachments = new WeakMap<WebContents, TaskView>();
type Failure = 'crashed' | 'unresponsive';
interface TaskViewHost {
  key: string;
  loader: { page: string; preload: string; devTools: boolean };
  preferences(): { zoom: number; theme: string; stageFollow: boolean; keys: Shortcut[] };
  info(): ProjectsInfo;
  presentation(): TaskPresentation;
  activity(): { active: boolean; covered: boolean };
  closing(): boolean;
  isCurrent(view: TaskView): boolean;
  connected(): void;
  navigated(): void;
  failureChanged(kind: Failure | 'responsive' | 'reload'): void;
  availability(): void;
  layoutPage(id: string, rect: PageLayout): void;
  visibilityChanged(): void;
  focusUi(): WebContents;
  pages(): { id: string; contents: WebContents; capture: boolean }[];
}

export class TaskView {
  static owner(contents: WebContents): TaskView | null {
    const view = attachments.get(contents);
    return view && view.host.isCurrent(view) ? view : null;
  }
  readonly group = new View();
  readonly view: WebContentsView;
  private window: BaseWindow;
  private readonly host: TaskViewHost;
  readonly key: string;
  focusTarget: WebContents;
  ready = false;
  failure: Failure | null = null;
  revision = 0;
  private laidOut = false;
  private reloading = false;
  private terminating = false;
  private drained: (() => void) | null = null;
  private drainSequence = 0;
  covered = false;
  keyZone = 'window';
  constructor(host: TaskViewHost, window: BaseWindow, workspace: Rectangle) {
    this.host = host; this.key = host.key; this.window = window;
    this.view = new UiView({ webPreferences: {
      preload: host.loader.preload, sandbox: true, devTools: host.loader.devTools, zoomFactor: host.preferences().zoom,
    } });
    this.group.addChildView(this.view);
    this.group.setVisible(false);
    window.contentView.addChildView(this.group);
    const wc = this.ui;
    attachments.set(wc, this);
    this.focusTarget = wc;
    wc.on('focus', () => { if (!host.activity().covered) this.focusTarget = wc; });
    registerWindowUi(wc, () => this.window);
    wc.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) void electronShell.openExternal(url); return { action: 'deny' }; });
    wc.on('will-navigate', (event) => event.preventDefault());
    wc.on('console-message', (d) => {
      if (d.level === 'error' || d.level === 'warning') log.warn(`[task-page wc=${wc.id}] ${d.message} (${d.sourceId}:${d.lineNumber})`);
    });
    wc.on('did-start-navigation', (d) => {
      if (d.isMainFrame && !d.isSameDocument) {
        this.ready = false; this.covered = false; this.drained?.();
        this.invalidateLayout(); host.navigated();
      }
    });
    wc.on('render-process-gone', () => {
      if (this.terminating) { this.terminating = false; this.ready = false; this.drained?.(); }
      else { this.reloading = false; this.failed('crashed'); }
    });
    wc.on('unresponsive', () => this.failed('unresponsive'));
    wc.on('responsive', () => {
      if (this.failure !== 'unresponsive') return;
      this.failure = null; host.failureChanged('responsive');
      // React may batch failure and recovery without remounting; request fresh placement either way.
      this.send('task:viewport', this.viewport()); host.availability();
      log.info(`[task-view] responsive task=${this.key} wc=${wc.id}`);
    });
    wc.on('destroyed', () => { attachments.delete(wc); this.ready = false; this.drained?.(); });
    this.place(workspace);
    const preferences = host.preferences();
    void wc.loadFile(host.loader.page, { query: { task: this.key, theme: preferences.theme,
      stageFollow: String(preferences.stageFollow), keys: JSON.stringify(preferences.keys),
      projects: JSON.stringify(this.info()) } }).catch((error: Error) => log.warn(`[task-view] load failed task=${this.key}: ${error.message}`));
    log.info(`[task-view] created task=${this.key} wc=${wc.id}`);
  }
  get ui() { return this.view.webContents; }
  get nativeWindow() { return this.window; }
  get nativeHidden() { return this.covered || !this.laidOut; }
  info() { return this.host.info(); }
  connect() {
    if (this.ready || this.ui.isDestroyed()) return;
    this.ready = true;
    if (this.reloading) { this.reloading = false; this.failure = null; this.host.failureChanged('reload'); }
    // One ordered stream: initial facts precede all subsequent updates and process output.
    const preferences = this.host.preferences();
    this.send('theme:state', preferences.theme);
    this.send('stage:follow:state', preferences.stageFollow);
    this.send('keys:state', preferences.keys);
    this.send('project:state', this.info());
    this.send('task:initial', this.host.presentation());
    this.send('task:viewport', this.viewport());
    this.activity(); this.host.connected(); this.host.availability();
    log.info(`[task-view] ready task=${this.key} wc=${this.ui.id} pid=${this.ui.getOSProcessId()}`);
  }
  send<C extends keyof Events>(channel: C, ...data: Arg<Events[C]>) {
    if (this.ready && !this.ui.isDestroyed() && this.failure !== 'crashed') this.ui.send(channel, ...data);
  }
  activity() { this.send('task:activity', this.host.activity()); }
  viewport(): TaskViewport {
    const { width, height } = this.group.getBounds();
    return { revision: this.revision, width, height, zoom: this.host.preferences().zoom };
  }
  invalidateLayout() { this.laidOut = false; this.host.visibilityChanged(); }
  place(bounds: Rectangle) {
    const previous = this.group.getBounds();
    if (Object.keys(bounds).every((key) => bounds[key as keyof Rectangle] === previous[key as keyof Rectangle])) return;
    this.revision++; this.invalidateLayout();
    this.group.setBounds(bounds);
    this.view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    this.send('task:viewport', this.viewport());
  }
  zoom(factor: number) {
    this.ui.setZoomFactor(factor); this.revision++; this.invalidateLayout();
    this.send('task:viewport', this.viewport()); this.send('zoom:state', factor);
  }
  moveTo(window: BaseWindow, workspace: Rectangle) {
    this.window.contentView.removeChildView(this.group);
    this.window = window; window.contentView.addChildView(this.group);
    this.group.setVisible(false); this.place(workspace);
    this.revision++; this.invalidateLayout();
    this.send('task:viewport', this.viewport()); this.send('project:state', this.info()); this.activity();
  }
  layout(rects: Record<string, PageLayout>, revision: number, viewport: { width: number; height: number }) {
    if (this.revision !== revision) return;
    const z = this.ui.getZoomFactor(), bounds = this.group.getBounds();
    if (!viewport || Math.abs(Math.round(viewport.width * z) - bounds.width) > 1
      || Math.abs(Math.round(viewport.height * z) - bounds.height) > 1) return;
    const scale = (r: Partial<Rectangle>): Rectangle => ({ x: Math.round((r.x ?? 0) * z), y: Math.round((r.y ?? 0) * z), width: Math.round((r.width ?? 0) * z), height: Math.round((r.height ?? 0) * z) });
    for (const [id, { clip, ...r }] of Object.entries(rects)) this.host.layoutPage(id, r.shown === false ? r : { ...scale(r), ...(clip && { clip: scale(clip) }) });
    if (!this.laidOut) { this.laidOut = true; log.info(`[task-view] grid ready task=${this.key} wc=${this.ui.id}`); }
    this.host.visibilityChanged();
  }
  cover(hidden: boolean, focus = true) {
    this.covered = hidden;
    const from = hidden && focus && this.host.pages().some(({ contents }) => !contents.isDestroyed() && contents.isFocused());
    this.host.visibilityChanged();
    if (from) focusWindow(this.host.focusUi());
  }
  // Capture first; the renderer paints decoded replacements before asking to hide native siblings.
  // JPEG encodes faster than PNG. A first frame sets an adaptive deadline; silent pages get half a second.
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
    const sources = this.host.pages().filter((p) => p.capture && !p.contents.isDestroyed());
    await Promise.all(sources.map(async (p) => {
      const img = await Promise.race([p.contents.capturePage().then((i) => { pace(); return i; }), gaveUp]).catch((): null => null);
      if (img) pics[p.id] = `data:image/jpeg;base64,${img.toJPEG(90).toString('base64')}`;
    }));
    paced = true; clearTimeout(timer);
    return pics;
  }
  private failed(kind: Failure) {
    if (this.failure === kind) return;
    this.failure = kind; this.drained?.(); this.host.failureChanged(kind);
    log.warn(`[task-view] ${kind} task=${this.key} wc=${this.ui.id}; PTYs retained, renderer protocol replies unavailable (#399)`);
    this.host.availability();
  }
  async reload() {
    if (this.ui.isDestroyed() || this.reloading || this.host.closing()) return;
    this.reloading = true; await this.drain();
    if (this.ui.isDestroyed() || this.host.closing() || !this.host.isCurrent(this)) return;
    log.info(`[task-view] reload task=${this.key} wc=${this.ui.id}; terminal screens reconstruct from future output`);
    this.ready = false; this.invalidateLayout();
    const reload = () => {
      if (this.ui.isDestroyed() || this.host.closing()) return;
      this.failure = null; this.host.failureChanged('reload');
      this.ui.reload(); this.host.availability();
    };
    // Process exit must precede reload, so its crash cannot invalidate the new ready handshake.
    // Explicit recovery must also work when Chromium never reports an unresponsive renderer.
    if (this.ui.isCrashed()) reload();
    else { this.terminating = true; this.ui.once('render-process-gone', reload); this.ui.forcefullyCrashRenderer(); }
  }
  async drain() {
    if (!this.ready || this.failure || this.ui.isDestroyed()) return;
    const sequence = ++this.drainSequence;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, 1000), host = this;
      function done() { clearTimeout(timer); if (host.drained === done) host.drained = null; resolve(); }
      this.drained = done; this.send('task:drain', sequence);
    });
  }
  acknowledgeDrain(sequence: number) { if (sequence === this.drainSequence) this.drained?.(); }
  close() {
    attachments.delete(this.ui); this.ready = false; this.drained?.();
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(this.group);
    if (!this.ui.isDestroyed()) this.ui.close();
    log.info(`[task-view] closed task=${this.key}`);
  }
}

// Core's IPC authority runs first; registration owns attachment handshakes only.
export function registerTaskViews() {
  handle('task:ready', (event) => TaskView.owner(event.sender)?.connect());
  handle('task:drained', (event, sequence) => TaskView.owner(event.sender)?.acknowledgeDrain(sequence));
}
