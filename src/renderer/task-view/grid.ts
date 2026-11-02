// A task's retained grids and their visible work (docs/window.md, The grid).
import { Orientation, LocalSelectionTransfer, PanelTransfer, DockviewCompositeDisposable } from 'dockview-react';
import type { DockviewApi, DockviewPanelApi, DockviewIDisposable, GridviewApi, GridviewPanelApi } from 'dockview-react';
import { flushSync } from 'react-dom';
import { store } from '../lib/store';
import type { TaskStore } from './state';
import { splitLayout, type TaskLayout } from '../../shared/stage-layout';
import type { Events } from '../../shared/ipc';
import { DevelopmentGrid } from './development';
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
  private stop: () => void;
  constructor(readonly state: TaskStore) {
    this.development = new DevelopmentGrid(state, this.changed, this.scheduleLayout);
    this.stage = new StageGrid(state, this.scheduleLayout);
    this.stop = state.subscribe((next, previous) => {
      if (!samePanels(next.profiles, previous.profiles) || !samePanels(next.stageTerminals, previous.stageTerminals)
        || !!next.developmentTerminals.list.length !== !!previous.developmentTerminals.list.length) this.update();
    });
  }
  get key() { return this.state.getState().key; }
  private get ready() { return !this.state.getState().loading; }
  private get active() { return !this.disposed && store.getState().current === this.key; }
  mount(workspace: GridviewApi, element: HTMLElement) {
    this.workspace = workspace; this.element = element;
    this.subscriptions.set(workspace, workspace.onDidLayoutChange(() => {
      if (!this.mutations && this.ready && this.active) this.stageShare = this.currentShare();
      this.changed();
    }));
    workspace.addPanel({ id: 'development', component: 'development', minimumWidth: 100, minimumHeight: 100 });
  }
  mountDevelopment(api: DockviewApi, parent: GridviewPanelApi) {
    this.development.attach(api);
    this.watch(api, parent.onDidDimensionsChange(({ width, height }) => api.layout(width, height, true)));
    api.layout(parent.width, parent.height, true);
    void this.initialize();
  }
  mountStage(api: DockviewApi, parent: GridviewPanelApi, viewport: HTMLElement) {
    this.mutate(() => this.stage.attach(api, parent, viewport));
    const subscriptions = this.watch(api, parent.onDidDimensionsChange(this.stage.layout));
    subscriptions.addDisposables(api.onDidActivePanelChange(({ origin }) => { if (origin === 'user') this.stage.pauseStageFollowing(); }),
      api.onDidMaximizedGroupChange(() => { this.stage.constrainStage(); this.stage.layout(); this.changed(); }),
      api.onDidAddGroup(() => this.stage.constrainStage()));
    this.scheduleLayout();
  }
  private watch(api: DockviewApi, dimensions: DockviewIDisposable) {
    const groups = new Map<string, DockviewIDisposable>();
    const add = (group: DockviewApi['groups'][number]) => {
      groups.get(group.id)?.dispose(); groups.set(group.id, group.api.onDidDimensionsChange(this.changed));
    };
    api.groups.forEach(add);
    const subscriptions = new DockviewCompositeDisposable(dimensions, api.onDidAddGroup(add), api.onDidRemoveGroup((group) => { groups.get(group.id)?.dispose(); groups.delete(group.id); }),
      api.onDidLayoutChange(this.changed), api.onDidActivePanelChange(this.scheduleLayout),
      api.onWillDragPanel(() => { this.dragging = true; void freeze(); }),
      api.onWillDragGroup(() => { this.dragging = true; void freeze(); }), api.onDidDrop(this.finishDrag),
      { dispose: () => { for (const event of groups.values()) event.dispose(); groups.clear(); } });
    this.subscriptions.set(api, subscriptions);
    return subscriptions;
  }
  private async initialize() {
    const saved = await kulisa.invoke('layout:load', { task: this.key }).catch((error: unknown) => {
      console.warn('[layout] saved grid unavailable:', error); return null;
    });
    if (this.disposed) return;
    const layout = splitLayout(saved);
    this.mutate(() => {
      this.stageShare = layout?.stageShare && layout.stageShare > 0 && layout.stageShare < 1 ? layout.stageShare : 0.65;
      this.stage.saved = this.arrangement?.layout !== undefined ? null : layout?.stage ?? null;
      flushSync(() => this.state.setState({ stageLayout: this.arrangement?.layout ?? layout?.stageLayout ?? null,
        stageOverflow: this.arrangement?.overflow ?? layout?.stageOverflow ?? false,
        stagePosition: this.arrangement?.position ?? layout?.stagePosition ?? 'above' }));
      flushSync(() => { this.sync(); this.development.build(layout?.workspace ?? null); });
      this.layout();
    });
    this.state.setState({ loading: false });
    this.arrangement = null;
    this.changed();
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
  private update() { if (this.ready && !this.disposed) { this.mutate(() => this.sync()); this.changed(); } }
  arrange(event: Events['stage:arrange']) {
    if (!this.ready) {
      this.arrangement = { ...this.arrangement, task: this.key, ...(event.layout !== undefined && { layout: event.layout }),
        ...(event.overflow !== undefined && { overflow: event.overflow }), ...(event.position !== undefined && { position: event.position }) };
      return;
    }
    this.mutate(() => {
      const { layout, overflow, position } = event, state = this.state.getState();
      this.stage.constrainStage(layout ?? state.stageLayout, overflow ?? state.stageOverflow);
      flushSync(() => this.state.setState({ ...(layout !== undefined && { stageLayout: layout }),
        ...(overflow !== undefined && { stageOverflow: overflow }), ...(position !== undefined && { stagePosition: position }) }));
      if (position !== undefined) this.placeStage();
      if (layout !== undefined) this.stage.arrangeStage();
      this.stage.layout();
    });
    this.changed();
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
    const count = this.stage.api?.panels.length;
    this.stage.syncStage();
    if (this.stage.api?.panels.length !== count) this.stage.layout();
  }
  private layout() {
    if (this.disposed || !this.element?.offsetWidth) return;
    // Following hidden grids avoids a geometry round trip when their task is selected.
    this.workspace?.layout(this.element.clientWidth, this.element.clientHeight);
    this.development.constrain();
  }
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
  private changed = () => {
    this.scheduleLayout();
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
  scheduleLayout = () => {
    cancelAnimationFrame(this.frame);
    if (this.disposed || !this.ready) return;
    this.frame = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.layout();
      kulisa.send('layout:apply', { task: this.key, rects: pageRects(this.stage.api, this.stage.viewport, this.state.getState().profiles, this.panes) });
    });
  };
  startResourceDrag(panel: DockviewPanelApi, event: DragEvent) {
    const api = this.development.api;
    if (!api || !event.dataTransfer) { event.preventDefault(); return; }
    LocalSelectionTransfer.getInstance<PanelTransfer>().setData([new PanelTransfer(api.id, panel.group.id, panel.id)], PanelTransfer.prototype);
    this.dragging = true; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', '');
    void freeze();
  }
  finishDrag = () => {
    if (!this.dragging) return;
    this.dragging = false;
    LocalSelectionTransfer.getInstance<PanelTransfer>().clearData(PanelTransfer.prototype);
    if (this.active) void unfreeze();
  };
}
