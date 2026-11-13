// A task's retained grids and their visible work (../README.md, The grid).
import { Orientation, DockviewCompositeDisposable } from 'dockview-react';
import type { DockviewApi, DockviewIDisposable, GridviewApi, GridviewPanelApi } from 'dockview-react';
import type { TaskStore } from './state';
import { splitLayout, type TaskLayout } from '../shared/layout';
import type { Events, PageLayout, StagePosition } from '../../shared/ipc';
import { DevelopmentGrid, resourcesMinimumHeight } from './development';
import { StageGrid } from './stage';
import { stagePaneKinds, stagePanes, stagePanesChanged } from './stage-panes';
import { freeze, unfreeze, showViews } from './views';

let viewportRevision = 0;
kulisa.on('task:viewport', ({ revision }) => { viewportRevision = revision; taskViewportChanged(); });
let taskViewportChanged = () => {};
export class TaskGrid {
  readonly development: DevelopmentGrid;
  readonly stage: StageGrid;
  private workspace: GridviewApi | null = null;
  private element: HTMLElement | null = null;
  private disposed = false;
  private dirty = false;
  private saveTimer = 0;
  private frame = 0;
  private savedSplit: { layout: TaskLayout['split']; position: StagePosition } | null = null;
  private subscriptions = new Map<object, DockviewIDisposable>();
  private dragging = false;
  private restoration: Promise<boolean> | null = null;
  private savedDevelopment: TaskLayout['workspace'] = null;
  private stop = () => {};
  constructor(readonly state: TaskStore) {
    this.development = new DevelopmentGrid(state, this.scheduleSave);
    this.stage = new StageGrid(state, this.reportPages);
  }
  // Construction happens in render, which React can abandon without an unmount cleanup.
  connect() {
    taskViewportChanged = this.resize;
    let panes = stagePanes();
    this.stop = this.state.subscribe(() => {
      if (!this.workspace || this.disposed) return;
      const next = stagePanes(), changed = stagePanesChanged(next, panes);
      panes = next;
      if (changed) {
        this.sync(); this.scheduleSave();
      }
    });
  }
  get key() { return this.state.getState().key; }
  private get ready() { return !this.state.getState().loading; }
  private get active() { return !this.disposed && this.state.getState().active; }
  load() { return this.restoration ??= this.restore(); }
  private async restore() {
    const saved = await kulisa.invoke('layout:load', { task: this.key }).catch((error: unknown) => {
      console.warn('[layout] saved grid unavailable:', error); return null;
    });
    if (this.disposed) return false;
    const layout = splitLayout(saved);
    this.savedDevelopment = layout?.workspace ?? null;
    this.savedSplit = { layout: layout?.split ?? null, position: layout?.stagePosition ?? 'above' };
    this.stage.saved = layout?.stage ?? null;
    this.state.setState({ stageLayout: layout?.stageLayout ?? null, stageOverflow: layout?.stageOverflow ?? false,
      stagePosition: layout?.stagePosition ?? 'above' });
    return true;
  }
  mount(workspace: GridviewApi, element: HTMLElement) {
    this.workspace = workspace; this.element = element;
    this.subscriptions.set(workspace, workspace.onDidLayoutChange(() => {
      this.scheduleSave(); this.reportPages();
    }));
    this.resize();
    if (this.savedSplit?.layout) {
      try { workspace.fromJSON(this.savedSplit.layout); }
      catch (error) { console.warn('[layout] saved split unavailable:', error); workspace.clear(); }
    }
    if (!workspace.getPanel('development') || !workspace.getPanel('stage')) {
      workspace.clear();
      workspace.addPanel({ id: 'development', component: 'development', minimumWidth: 100, minimumHeight: resourcesMinimumHeight });
      workspace.addPanel({ id: 'stage', component: 'stage', minimumWidth: 100, minimumHeight: 100 });
      this.placeStage('above');
    } else if (this.savedSplit) this.placeStage(this.savedSplit.position);
    workspace.getPanel('development')!.api.setConstraints({ minimumHeight: resourcesMinimumHeight });
    this.savedSplit = null;
    this.sync();
  }
  mountDevelopment(api: DockviewApi, parent: GridviewPanelApi) {
    this.development.attach(api, parent);
    this.watch(api, parent.onDidDimensionsChange(({ width, height }) => api.layout(width, height, true)));
    api.layout(parent.width, parent.height, true);
    this.development.build(this.savedDevelopment);
    this.savedDevelopment = null;
    this.finishInitialization();
  }
  mountStage(api: DockviewApi, parent: GridviewPanelApi, viewport: HTMLElement) {
    this.stage.attach(api, viewport);
    const subscriptions = this.watch(api, parent.onDidDimensionsChange(this.stage.layout));
    subscriptions.addDisposables(api.onDidActivePanelChange(({ origin }) => { if (origin === 'user') this.stage.pauseStageFollowing(); }));
    this.finishInitialization();
    this.reportPages();
  }
  private watch(api: DockviewApi, dimensions: DockviewIDisposable) {
    // Dockview coalesces layout events in a microtask after compound panel moves finish.
    const changed = () => {
      if (api === this.stage.api) this.stage.layout();
      this.scheduleSave(); this.reportPages();
    };
    const subscriptions = new DockviewCompositeDisposable(dimensions, api.onDidLayoutChange(changed), api.onDidMaximizedGroupChange(changed), api.onDidActivePanelChange(this.reportPages),
      api.onWillDragPanel(() => { this.dragging = true; void freeze(); }),
      api.onWillDragGroup(() => { this.dragging = true; void freeze(); }), api.onDidDrop(this.finishDrag));
    this.subscriptions.set(api, subscriptions);
    return subscriptions;
  }
  private finishInitialization() {
    if (this.ready || this.disposed || !this.development.api || !this.stage.api) return;
    this.resize();
    this.state.setState({ loading: false });
    this.scheduleSave(); this.reportPages();
  }
  activate() {
    void showViews();
  }
  deactivate() {
    this.flush();
    this.stage.reset(); this.finishDrag();
    for (const definition of stagePaneKinds) definition.reset?.();
    this.state.setState({ developmentTerminalFocus: null, pictures: {} });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    // A partially mounted or already torn-down Dockview may not serialize. Cleanup must still finish.
    try { this.deactivate(); } catch { console.warn('[task-view] layout unavailable during disposal'); }
    this.stop();
    this.stage.reset();
    cancelAnimationFrame(this.frame);
    for (const subscriptions of this.subscriptions.values()) subscriptions.dispose();
    this.subscriptions.clear(); this.stage.detach(); this.development.dispose();
    this.workspace = null; this.element = null;
  }
  async arrange(event: Events['stage:arrange']) {
    if (!this.workspace) await this.load();
    if (this.disposed) return;
    const { layout, overflow, position } = event, previousPosition = this.state.getState().stagePosition;
    if (layout !== undefined) this.stage.saved = null;
    this.state.setState({ ...(layout !== undefined && { stageLayout: layout }),
      ...(overflow !== undefined && { stageOverflow: overflow }), ...(position !== undefined && { stagePosition: position }) });
    if (position !== undefined && position !== previousPosition) this.placeStage(previousPosition);
    if (layout !== undefined) this.stage.arrangeStage();
    this.stage.layout();
    this.scheduleSave(); this.reportPages();
  }
  private sync() {
    if (!this.workspace) return;
    const panel = this.workspace.getPanel('stage');
    if (panel) panel.api.setVisible(this.stage.paneIds().length > 0);
    this.stage.syncPanes();
    this.finishInitialization();
  }
  resize = () => {
    if (this.disposed || !this.element?.offsetWidth) return;
    // Following hidden grids avoids a geometry round trip when their task is selected.
    const { clientWidth: width, clientHeight: height } = this.element;
    this.workspace?.layout(width, height);
    this.reportPages();
  };
  private placeStage(previousPosition: StagePosition) {
    const workspace = this.workspace, panel = workspace?.getPanel('stage');
    if (!workspace || !panel) return;
    const position = this.state.getState().stagePosition;
    if (position === previousPosition) return;
    const visible = panel.api.isVisible;
    if (!visible) panel.api.setVisible(true);
    workspace.orientation = position === 'above' ? Orientation.VERTICAL : Orientation.HORIZONTAL;
    const first = previousPosition === 'right' ? 'development' : 'stage', wanted = position === 'right' ? 'development' : 'stage';
    if (first !== wanted) {
      const moving = workspace.getPanel(wanted)!;
      workspace.movePanel(moving, { reference: first, direction: position === 'above' ? 'above' : 'left',
        size: position === 'above' ? moving.api.height : moving.api.width });
    }
    if (!visible) panel.api.setVisible(false);
  }
  private scheduleSave = () => {
    if (!this.ready || this.disposed) return;
    this.dirty = true; clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.flush(), 300);
  };
  flush() {
    clearTimeout(this.saveTimer);
    if (!this.dirty || !this.development.api) return;
    this.dirty = false;
    const state = this.state.getState();
    kulisa.send('layout:save', { task: this.key, layout: { version: 4, workspace: this.development.layout(),
      stage: this.stage.api?.toJSON() ?? this.stage.saved, split: this.workspace!.toJSON(), stageLayout: state.stageLayout, stageOverflow: state.stageOverflow,
      stagePosition: state.stagePosition } satisfies TaskLayout });
  }
  reportPages = () => {
    if (this.disposed || !this.ready || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.disposed) return;
      const context = { api: this.stage.api, viewport: this.stage.viewport };
      const rects: Record<string, PageLayout> = {};
      for (const definition of stagePaneKinds) Object.assign(rects, definition.layout?.(context));
      kulisa.send('layout:apply', { task: this.key, revision: viewportRevision, viewport: { width: innerWidth, height: innerHeight }, rects });
    });
  };
  finishDrag = () => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.active) void unfreeze();
  };
}
