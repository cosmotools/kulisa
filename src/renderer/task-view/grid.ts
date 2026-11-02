// A task's retained grids and their visible work (docs/window.md, The grid).
import { Orientation, DockviewCompositeDisposable } from 'dockview-react';
import type { DockviewApi, DockviewIDisposable, GridviewApi, GridviewPanelApi } from 'dockview-react';
import { store } from '../lib/store';
import type { TaskStore } from './state';
import { splitLayout, type TaskLayout } from '../../shared/stage-layout';
import type { Events } from '../../shared/ipc';
import { DevelopmentGrid, resourcesMinimumHeight } from './development';
import { StageGrid } from './stage';
import { pageRects, type PaneHandle } from './pages';
import { freeze, unfreeze, showViews } from './views';

const samePanels = (a: { id: string | number }[], b: { id: string | number }[]) =>
  a === b || a.length === b.length && a.every((panel, i) => panel.id === b[i]!.id);

export class TaskGrid {
  readonly development: DevelopmentGrid;
  readonly stage: StageGrid;
  readonly panes = new Map<string, PaneHandle>();
  private workspace: GridviewApi | null = null;
  private element: HTMLElement | null = null;
  private disposed = false;
  private mutations = 0;
  private dirty = false;
  private saveTimer = 0;
  private frame = 0;
  private stageShare = 0.65;
  private subscriptions = new Map<object, DockviewIDisposable>();
  private dragging = false;
  private arrangement: Events['stage:arrange'] | null = null;
  private saved: TaskLayout | null = null;
  private stop: () => void;
  constructor(readonly state: TaskStore) {
    this.development = new DevelopmentGrid(state, this.scheduleSave);
    this.stage = new StageGrid(state, this.reportPages);
    this.stop = state.subscribe((next, previous) => {
      if (!this.workspace || this.disposed) return;
      if (!samePanels(next.profiles, previous.profiles) || !samePanels(next.stageTerminals, previous.stageTerminals)) {
        this.mutate(() => this.sync()); this.scheduleSave(); this.finishInitialization();
      }
    });
  }
  get key() { return this.state.getState().key; }
  private get ready() { return !this.state.getState().loading; }
  private get active() { return !this.disposed && store.getState().current === this.key; }
  async load() {
    const saved = await kulisa.invoke('layout:load', { task: this.key }).catch((error: unknown) => {
      console.warn('[layout] saved grid unavailable:', error); return null;
    });
    if (this.disposed) return false;
    this.saved = splitLayout(saved);
    return true;
  }
  mount(workspace: GridviewApi, element: HTMLElement) {
    const layout = this.saved;
    this.stageShare = layout?.stageShare && layout.stageShare > 0 && layout.stageShare < 1 ? layout.stageShare : 0.65;
    this.stage.saved = this.arrangement?.layout !== undefined ? null : layout?.stage ?? null;
    this.state.setState({ stageLayout: this.arrangement?.layout ?? layout?.stageLayout ?? null,
      stageOverflow: this.arrangement?.overflow ?? layout?.stageOverflow ?? false,
      stagePosition: this.arrangement?.position ?? layout?.stagePosition ?? 'above' });
    this.arrangement = null;
    this.workspace = workspace; this.element = element;
    this.subscriptions.set(workspace, workspace.onDidLayoutChange(() => {
      if (!this.mutations && this.ready && this.active) this.stageShare = this.currentShare();
      this.scheduleSave(); this.reportPages();
    }));
    this.resize();
    workspace.addPanel({ id: 'development', component: 'development', minimumWidth: 100, minimumHeight: resourcesMinimumHeight });
    this.mutate(() => this.sync());
  }
  mountDevelopment(api: DockviewApi, parent: GridviewPanelApi) {
    this.development.attach(api, parent);
    this.watch(api, parent.onDidDimensionsChange(({ width, height }) => api.layout(width, height, true)));
    api.layout(parent.width, parent.height, true);
    this.mutate(() => this.development.build(this.saved?.workspace ?? null));
    this.saved = null;
    this.finishInitialization();
  }
  mountStage(api: DockviewApi, parent: GridviewPanelApi, viewport: HTMLElement) {
    this.mutate(() => this.stage.attach(api, parent, viewport));
    const subscriptions = this.watch(api, parent.onDidDimensionsChange(this.stage.layout));
    subscriptions.addDisposables(api.onDidActivePanelChange(({ origin }) => { if (origin === 'user') this.stage.pauseStageFollowing(); }),
      api.onDidMutateLayout(() => { if (!this.mutations) { this.stage.constrainStage(); this.stage.layout(); } }));
    this.finishInitialization();
    this.reportPages();
  }
  private watch(api: DockviewApi, dimensions: DockviewIDisposable) {
    const groups = new Map<string, DockviewIDisposable>();
    const add = (group: DockviewApi['groups'][number]) => {
      groups.get(group.id)?.dispose(); groups.set(group.id, group.api.onDidDimensionsChange(() => { this.scheduleSave(); this.reportPages(); }));
    };
    api.groups.forEach(add);
    const subscriptions = new DockviewCompositeDisposable(dimensions, api.onDidAddGroup(add), api.onDidRemoveGroup((group) => { groups.get(group.id)?.dispose(); groups.delete(group.id); }),
      api.onDidLayoutChange(this.scheduleSave), api.onDidLayoutChange(this.reportPages), api.onDidActivePanelChange(this.reportPages),
      api.onWillDragPanel(() => { this.dragging = true; void freeze(); }),
      api.onWillDragGroup(() => { this.dragging = true; void freeze(); }), api.onDidDrop(this.finishDrag),
      { dispose: () => { for (const event of groups.values()) event.dispose(); groups.clear(); } });
    this.subscriptions.set(api, subscriptions);
    return subscriptions;
  }
  private finishInitialization() {
    if (this.ready || this.disposed || !this.development.api || this.stage.environmentIds().length && !this.stage.api) return;
    this.state.setState({ loading: false });
    this.resize(); this.scheduleSave(); this.reportPages();
  }
  activate() {
    void showViews();
  }
  deactivate() {
    this.flush();
    this.stage.reset(); this.finishDrag();
    this.state.setState({ stageTerminalFocus: null, pictures: {}, picking: {}, captions: {} });
  }
  dispose() {
    this.deactivate(); this.disposed = true;
    this.stop();
    cancelAnimationFrame(this.frame);
    for (const subscriptions of this.subscriptions.values()) subscriptions.dispose();
    this.subscriptions.clear(); this.stage.detach(); this.development.dispose();
    this.panes.clear(); this.workspace = null; this.element = null;
  }
  private mutate(fn: () => void) { this.mutations++; try { fn(); } finally { this.mutations--; } }
  arrange(event: Events['stage:arrange']) {
    if (!this.workspace) {
      this.arrangement = { ...this.arrangement, task: this.key, ...(event.layout !== undefined && { layout: event.layout }),
        ...(event.overflow !== undefined && { overflow: event.overflow }), ...(event.position !== undefined && { position: event.position }) };
      return;
    }
    this.mutate(() => {
      const { layout, overflow, position } = event;
      if (layout !== undefined) this.stage.saved = null;
      this.state.setState({ ...(layout !== undefined && { stageLayout: layout }),
        ...(overflow !== undefined && { stageOverflow: overflow }), ...(position !== undefined && { stagePosition: position }) });
      if (position !== undefined) this.placeStage();
      if (layout !== undefined) this.stage.arrangeStage();
      this.stage.constrainStage(); this.stage.layout();
    });
    this.scheduleSave(); this.reportPages();
  }
  private sync() {
    if (!this.workspace) return;
    const has = this.stage.environmentIds().length > 0, panel = this.workspace.getPanel('stage');
    if (!has && panel) {
      const api = this.stage.api;
      if (api) { this.subscriptions.get(api)?.dispose(); this.subscriptions.delete(api); }
      this.stage.detach(); this.stage.saved = null; this.workspace.removePanel(panel);
    }
    if (has && !panel) {
      this.workspace.addPanel({ id: 'stage', component: 'stage', minimumWidth: 100, minimumHeight: 100 });
      this.placeStage();
    }
    if (this.stage.syncStage()) { this.stage.constrainStage(); this.stage.layout(); }
  }
  resize = () => {
    if (this.disposed || !this.element?.offsetWidth) return;
    // Following hidden grids avoids a geometry round trip when their task is selected.
    const { clientWidth: width, clientHeight: height } = this.element;
    this.workspace?.layout(width, height);
    this.reportPages();
  };
  private placeStage() {
    const workspace = this.workspace, panel = workspace?.getPanel('stage');
    if (!workspace || !panel) return;
    const position = this.state.getState().stagePosition;
    workspace.orientation = position === 'above' ? Orientation.VERTICAL : Orientation.HORIZONTAL;
    const root = workspace.toJSON().grid.root;
    const firstPanel = (node: typeof root): string => Array.isArray(node.data) ? firstPanel(node.data[0]!) : node.data.id;
    const first = firstPanel(root), wanted = position === 'right' ? 'development' : 'stage';
    if (first !== wanted) workspace.movePanel(workspace.getPanel(wanted)!, { reference: first, direction: position === 'above' ? 'above' : 'left' });
    panel.api.setSize(position === 'above' ? { height: Math.round(workspace.height * this.stageShare) } : { width: Math.round(workspace.width * this.stageShare) });
  }
  private currentShare() {
    const panel = this.workspace?.getPanel('stage'), vertical = this.state.getState().stagePosition === 'above';
    const total = vertical ? this.workspace?.height : this.workspace?.width;
    return panel && total ? (vertical ? panel.api.height : panel.api.width) / total : this.stageShare;
  }
  private scheduleSave = () => {
    if (!this.ready || this.disposed || this.mutations) return;
    this.dirty = true; clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.flush(), 300);
  };
  private flush() {
    clearTimeout(this.saveTimer);
    if (!this.dirty || !this.development.api) return;
    this.dirty = false;
    const state = this.state.getState();
    kulisa.send('layout:save', { task: this.key, layout: { version: 3, workspace: this.development.api.toJSON(),
      stage: this.stage.api?.toJSON() ?? this.stage.saved, stageLayout: state.stageLayout, stageOverflow: state.stageOverflow,
      stagePosition: state.stagePosition, stageShare: this.currentShare() } satisfies TaskLayout });
  }
  reportPages = () => {
    if (this.disposed || !this.ready || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.disposed) return;
      kulisa.send('layout:apply', { task: this.key, rects: pageRects(this.stage.api, this.stage.viewport, this.state.getState().profiles, this.panes) });
    });
  };
  finishDrag = () => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.active) void unfreeze();
  };
}
