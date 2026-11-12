// Native attachment of one Task's UI; domain resources and persistence stay in Task (docs/window.md).
import { View, WebContentsView, shell as electronShell } from 'electron';
import path from 'node:path';
import { registerWindowUi } from '../browser/main/index.ts';
import { page } from './pages.ts';
import { log } from './log.ts';
import type { Task } from './tasks.ts';
import type { AppWindow } from './window.ts';
import type { Arg, Events } from '../shared/ipc.ts';
import type { Rectangle } from 'electron';

const attachments = new WeakMap<Electron.WebContents, TaskView>();

export class TaskView {
  static owner(contents: Electron.WebContents): Task | null {
    const host = attachments.get(contents);
    return host && host.task.view === host && host.task.window === host.window ? host.task : null;
  }
  readonly group = new View();
  readonly view: WebContentsView;
  private window: AppWindow;
  focusTarget: Electron.WebContents;
  ready = false;
  failure: 'crashed' | 'unresponsive' | null = null;
  revision = 0;
  private reloading = false;
  private terminating = false;
  private drained: (() => void) | null = null;
  private drainSequence = 0;
  covered = false;
  keyZone = 'window';
  readonly task: Task;
  constructor(task: Task, window: AppWindow) {
    this.task = task;
    this.window = window;
    this.view = new WebContentsView({ webPreferences: {
      preload: path.join(import.meta.dirname, '..', 'preload', 'index.cjs'), sandbox: true,
      devTools: window.appDevTools, zoomFactor: task.shell.uiZoom,
    } });
    this.group.addChildView(this.view);
    this.group.setVisible(false);
    window.win.contentView.addChildView(this.group);
    const wc = this.ui;
    attachments.set(wc, this);
    this.focusTarget = wc;
    wc.on('focus', () => { if (!this.window.shellCovered) this.focusTarget = wc; });
    registerWindowUi(wc, () => this.window.win);
    wc.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) void electronShell.openExternal(url); return { action: 'deny' }; });
    wc.on('will-navigate', (event) => event.preventDefault());
    wc.on('console-message', (d) => {
      if (d.level === 'error' || d.level === 'warning') log.warn(`[task-page wc=${wc.id}] ${d.message} (${d.sourceId}:${d.lineNumber})`);
    });
    wc.on('did-start-navigation', (d) => {
      if (d.isMainFrame && !d.isSameDocument) {
        this.ready = false; this.covered = false; this.drained?.();
        this.window.invalidateTaskLayout(task);
        if (task.shown()) { this.window.thumbnails.close(); this.window.artifactViewer.close(); }
      }
    });
    wc.on('render-process-gone', () => {
      if (this.terminating) { this.terminating = false; this.ready = false; this.drained?.(); }
      else { this.reloading = false; this.failed('crashed'); }
    });
    wc.on('unresponsive', () => this.failed('unresponsive'));
    wc.on('responsive', () => {
      if (this.failure !== 'unresponsive') return;
      this.failure = null; task.viewFailed = false;
      this.window.sendProjects();
      // React may batch the failure and recovery without remounting the grid; request fresh native placement either way.
      this.send('task:viewport', this.viewport());
      this.window.taskAvailability();
      log.info(`[task-view] responsive task=${task.key} wc=${wc.id}`);
    });
    wc.on('destroyed', () => { attachments.delete(wc); this.ready = false; this.drained?.(); });
    this.place(window.workspace);
    void wc.loadFile(page('task.html'), { query: { task: task.key, theme: task.shell.theme,
      stageFollow: String(task.shell.stageFollow), keys: JSON.stringify(task.shell.keys()),
      projects: JSON.stringify(this.info()) } }).catch((error: Error) => log.warn(`[task-view] load failed task=${task.key}: ${error.message}`));
    log.info(`[task-view] created task=${task.key} wc=${wc.id}`);
  }
  get ui() { return this.view.webContents; }
  info(): import('../shared/types.ts').ProjectsInfo {
    const info = this.window.info(this.task);
    return { ...info, tabs: [this.task.info()], projects: info.projects.filter((p) => p.id === this.task.project.id).map((p): typeof p => ({ ...p, tasks: [] })),
      open: info.open.filter((p) => p.id === this.task.project.id), windows: [] };
  }
  connect() {
    if (this.ready || this.ui.isDestroyed()) return;
    this.ready = true;
    if (this.reloading) { this.reloading = false; this.failure = null; this.task.viewFailed = false; }
    // One ordered send stream: initial facts precede all subsequent updates and process output.
    this.send('theme:state', this.task.shell.theme);
    this.send('stage:follow:state', this.task.shell.stageFollow);
    this.send('keys:state', this.task.shell.keys());
    this.send('project:state', this.info());
    this.send('task:initial', this.task.presentation);
    this.send('task:viewport', this.viewport());
    this.activity();
    this.window.pushTaskState(this.task);
    void this.task.loadDevelopmentTerminals().catch((error: Error) => log.warn(`[task-view] terminal start task=${this.task.key}: ${error.message}`));
    void this.window.sendArtifacts(this.task);
    this.window.taskAvailability();
    log.info(`[task-view] ready task=${this.task.key} wc=${this.ui.id} pid=${this.ui.getOSProcessId()}`);
  }
  send<C extends keyof Events>(channel: C, ...data: Arg<Events[C]>) {
    if (this.ready && !this.ui.isDestroyed() && this.failure !== 'crashed') this.ui.send(channel, ...data);
  }
  activity() { this.send('task:activity', { active: this.task.shown(), covered: this.window.shellCovered }); }
  viewport() {
    const { width, height } = this.group.getBounds();
    return { revision: this.revision, width, height, zoom: this.task.shell.uiZoom };
  }
  place(bounds: Rectangle) {
    const previous = this.group.getBounds();
    if (Object.keys(bounds).every((key) => bounds[key as keyof Rectangle] === previous[key as keyof Rectangle])) return;
    this.revision++;
    this.window.invalidateTaskLayout(this.task);
    this.group.setBounds(bounds);
    this.view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    this.send('task:viewport', this.viewport());
  }
  moveTo(window: AppWindow) {
    this.window.win.contentView.removeChildView(this.group);
    this.window = window;
    window.win.contentView.addChildView(this.group);
    this.group.setVisible(false);
    this.place(window.workspace);
    this.revision++; this.window.invalidateTaskLayout(this.task);
    this.send('task:viewport', this.viewport());
    this.send('project:state', this.info());
    this.activity();
  }
  private failed(kind: 'crashed' | 'unresponsive') {
    if (this.failure === kind) return;
    this.failure = kind;
    this.task.viewFailed = true;
    this.drained?.();
    this.window.failTaskView({ task: this.task.key, kind, frames: [] });
    log.warn(`[task-view] ${kind} task=${this.task.key} wc=${this.ui.id}; PTYs retained, renderer protocol replies unavailable (#399)`);
    this.window.taskAvailability();
  }
  async reload() {
    if (this.ui.isDestroyed() || this.reloading || this.task.closing) return;
    this.reloading = true;
    await this.drain();
    if (this.ui.isDestroyed() || this.task.closing || this.task.view !== this) return;
    log.info(`[task-view] reload task=${this.task.key} wc=${this.ui.id}; terminal screens reconstruct from future output`);
    this.ready = false;
    this.window.invalidateTaskLayout(this.task);
    const reload = () => {
      if (this.ui.isDestroyed() || this.task.closing) return;
      this.failure = null; this.task.viewFailed = false;
      this.ui.reload(); this.window.taskAvailability();
    };
    // Killing is asynchronous: reload after process exit, so its crash cannot invalidate the new page's ready handshake.
    // Native hang detection is conditional; explicit recovery must work without its signal.
    if (this.ui.isCrashed()) reload();
    else { this.terminating = true; this.ui.once('render-process-gone', reload); this.ui.forcefullyCrashRenderer(); }
  }
  async drain() {
    if (!this.ready || this.failure || this.ui.isDestroyed()) return;
    const sequence = ++this.drainSequence;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, 1000);
      const host = this;
      function done() { clearTimeout(timer); if (host.drained === done) host.drained = null; resolve(); }
      this.drained = done;
      this.send('task:drain', sequence);
    });
  }
  acknowledgeDrain(sequence: number) { if (sequence === this.drainSequence) this.drained?.(); }
  close() {
    attachments.delete(this.ui);
    this.ready = false; this.drained?.();
    if (!this.window.win.isDestroyed()) this.window.win.contentView.removeChildView(this.group);
    if (!this.ui.isDestroyed()) this.ui.close();
    log.info(`[task-view] closed task=${this.task.key}`);
  }
}
