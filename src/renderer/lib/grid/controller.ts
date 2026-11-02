// One mounted window grid and its task-scoped work (docs/window.md, The grid).
import { Orientation, LocalSelectionTransfer, PanelTransfer } from 'dockview-react';
import type { DockviewApi, DockviewPanelApi, GridviewApi, GridviewPanelApi } from 'dockview-react';
import { flushSync } from 'react-dom';
import { renderTerminals } from '../../../terminal/renderer';
import type { Profile, DevelopmentTerminalsState } from '../../../shared/types';
import type { StageTerminal } from '../../../shared/stage-terminal';
import type { Events } from '../../../shared/ipc';
import { splitLayout, type TaskLayout } from '../../../shared/stage-layout';
import { store, setCaption } from '../store';
import { DevelopmentGrid } from './development';
import { StageGrid } from './stage';
import { pageRects } from './pages';

interface GridHost { freeze(): Promise<void>; unfreeze(): Promise<void>; forgetFrozen(): void; revealGrid(task: string): Promise<unknown>; closeLayers(): Promise<void> }
interface TaskGrid {
  key: string;
  ready: boolean;
  restoring: Promise<void> | null;
  profiles: Profile[];
  development: DevelopmentTerminalsState | null;
  terminals: StageTerminal[];
  arrangement?: Omit<Events['stage:arrange'], 'task'>;
}

export class WindowGrid {
  readonly development = new DevelopmentGrid(() => this.changed(), () => this.scheduleLayout());
  readonly stage = new StageGrid(() => this.scheduleLayout());
  private workspace: GridviewApi | null = null;
  private element: HTMLElement | null = null;
  private session: TaskGrid | null = null;
  private ready = Promise.withResolvers<DockviewApi | null>();
  private subscriptions = new Map<DockviewApi, () => void>();
  private outerSubscription: { dispose(): void } | null = null;
  private input: AbortController | null = null;
  private stageShare = 0.65;
  private mutations = 0;
  private saveTimer = 0;
  private dirty = false;
  private layoutFrame = 0;
  private dropTimer = 0;
  private resourceDragging = false;
  private dragSession: TaskGrid | null = null;
  constructor(private readonly host: GridHost) {}

  mount(workspace: GridviewApi, element: HTMLElement) {
    this.workspace = workspace; this.element = element;
    this.outerSubscription = workspace.onDidLayoutChange(() => {
      if (!this.mutations && this.session?.ready) this.stageShare = this.currentShare();
      this.changed();
    });
    this.input = new AbortController();
    document.addEventListener('dragend', this.finishDrag, { capture: true, signal: this.input.signal });
    document.addEventListener('drop', () => { if (this.dragSession) this.dropTimer = window.setTimeout(this.finishDrag); }, { capture: true, signal: this.input.signal });
    workspace.addPanel({ id: 'development', component: 'development', minimumWidth: 100, minimumHeight: 100 });
  }
  mountDevelopment(api: DockviewApi, parent: GridviewPanelApi) {
    this.development.attach(api);
    this.watch(api, parent.onDidDimensionsChange(({ width, height }) => api.layout(width, height, true)));
    api.layout(parent.width, parent.height, true);
    this.ready.resolve(api);
  }
  mountStage(api: DockviewApi, parent: GridviewPanelApi, viewport: HTMLElement) {
    this.mutate(() => this.stage.attach(api, parent, viewport));
    this.watch(api, parent.onDidDimensionsChange(this.stage.layout));
    const stop = this.subscriptions.get(api)!;
    const active = api.onDidActivePanelChange(({ origin }) => { if (origin === 'user') this.stage.pauseStageFollowing(); });
    const maximized = api.onDidMaximizedGroupChange(() => { this.stage.constrainStage(); this.stage.layout(); this.changed(); });
    const added = api.onDidAddGroup(() => this.stage.constrainStage());
    this.subscriptions.set(api, () => { active.dispose(); maximized.dispose(); added.dispose(); stop(); });
    this.changed();
  }
  unmountStage(api: DockviewApi | null) {
    if (!api) return;
    this.subscriptions.get(api)?.(); this.subscriptions.delete(api);
    this.stage.detach(api);
  }
  dispose = () => {
    this.flush(); this.cancelFrames(); this.session = null;
    this.ready.resolve(null); this.ready = Promise.withResolvers();
    this.input?.abort(); this.input = null;
    this.outerSubscription?.dispose(); this.outerSubscription = null;
    for (const stop of this.subscriptions.values()) stop();
    this.subscriptions.clear();
    this.finishResourceDrag(); this.stage.reset(); this.stage.detach(); this.stage.saved = null;
    this.development.dispose(); this.workspace = null; this.element = null;
  };
  private watch(api: DockviewApi, dimensions: { dispose(): void }) {
    const groups = new Map<string, { dispose(): void }>();
    const added = (group: DockviewApi['groups'][number]) => {
      groups.get(group.id)?.dispose();
      groups.set(group.id, group.api.onDidDimensionsChange(this.changed));
    };
    api.groups.forEach(added);
    const subscriptions = [dimensions, api.onDidAddGroup(added), api.onDidRemoveGroup((group) => {
      groups.get(group.id)?.dispose(); groups.delete(group.id);
    }), api.onDidLayoutChange(this.changed), api.onDidActivePanelChange(this.scheduleLayout),
    api.onWillDragPanel(this.beginDrag), api.onWillDragGroup(this.beginDrag), api.onDidDrop(this.finishDrag)];
    this.subscriptions.set(api, () => {
      subscriptions.forEach((s) => s.dispose()); groups.forEach((s) => s.dispose()); groups.clear();
    });
  }
  private task(key = store.getState().current) {
    if (!key) return null;
    if (this.session?.key !== key) this.session = { key, ready: false, restoring: null, profiles: [], development: null, terminals: [] };
    return this.session;
  }
  private owns(session: TaskGrid) { return this.session === session && store.getState().current === session.key; }
  async profiles(profiles: Profile[]) {
    const session = this.task();
    if (!session) return;
    session.profiles = profiles;
    if (!session.ready) { await (session.restoring ??= this.restore(session)); return; }
    for (const p of profiles) if (!p.signinMode && store.getState().profiles.find((x) => x.id === p.id)?.signinMode) setCaption(p.id, '');
    store.setState({ profiles });
    this.mutate(() => this.sync()); this.changed();
  }
  terminals(state: DevelopmentTerminalsState) {
    if (state.task !== store.getState().current) return;
    const session = this.task(state.task);
    if (!session) return;
    session.development = state;
    if (session.ready) { store.setState({ developmentTerminals: state }); this.changed(); }
  }
  environments(state: Events['stage-terminal:state']) {
    if (state.task !== store.getState().current) return;
    const session = this.task(state.task);
    if (!session) return;
    session.terminals = state.list;
    if (session.ready) { store.setState({ stageTerminals: state.list }); this.mutate(() => this.sync()); this.changed(); }
  }
  private async restore(session: TaskGrid) {
    const api = await this.ready.promise;
    if (!api || !this.owns(session)) return;
    const saved = await kulisa.invoke('layout:load', { task: session.key });
    if (!this.owns(session)) return;
    const layout = splitLayout(saved);
    this.mutate(() => {
      // Task controls determine the outer room; commit them before restoring the nested grids.
      flushSync(() => {
        this.removeStage(); this.development.clear();
        store.setState({ profiles: session.profiles, stageTerminals: session.terminals,
          developmentTerminals: session.development ?? { task: session.key, front: null, list: [] }, pictures: {}, captions: {}, picking: {},
          stageLayout: session.arrangement?.layout ?? layout?.stageLayout ?? null,
          stageOverflow: session.arrangement?.overflow ?? layout?.stageOverflow ?? false,
          stagePosition: session.arrangement?.position ?? layout?.stagePosition ?? 'above' });
      });
      this.stageShare = layout?.stageShare && layout.stageShare > 0 && layout.stageShare < 1 ? layout.stageShare : 0.65;
      this.stage.saved = session.arrangement?.layout !== undefined ? null : layout?.stage ?? null;
      flushSync(() => { this.sync(); this.layoutOuter(); this.development.build(layout?.workspace ?? null); });
      this.layoutOuter(); this.stage.layout();
    });
    session.ready = true;
    this.changed();
    flushSync(() => store.setState({ gridPhase: 'rendering' }));
    await renderTerminals();
    if (!document.hidden) await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (!this.owns(session)) return;
    kulisa.send('layout:apply', { task: session.key, rects: pageRects(this.stage.api, this.stage.viewport, store.getState().profiles) });
    await this.host.revealGrid(session.key);
    if (this.owns(session)) { store.setState({ gridPhase: 'ready' }); this.changed(); }
  }
  leave(next: boolean) {
    this.flush(); this.cancelFrames(); this.session = null;
    this.stage.reset();
    store.setState({ gridPhase: next ? 'rendering' : 'loading', stageTerminalFocus: null, developmentDiff: null });
    void this.host.closeLayers(); this.host.forgetFrozen(); this.finishResourceDrag();
    if (next) return;
    this.mutate(() => {
      this.removeStage(); this.development.clear();
      store.setState({ profiles: [], stageTerminals: [], pictures: {}, captions: {}, picking: {}, developmentTerminals: { front: null, list: [] } });
    });
  }
  arrange({ task, layout, overflow, position }: Events['stage:arrange']) {
    if (task !== store.getState().current) return;
    const session = this.task(task);
    if (!session) return;
    if (!session.ready) {
      session.arrangement = { ...session.arrangement, ...(layout !== undefined && { layout }), ...(overflow !== undefined && { overflow }), ...(position !== undefined && { position }) };
      return;
    }
    this.mutate(() => {
      this.stage.constrainStage(layout ?? store.getState().stageLayout, overflow ?? store.getState().stageOverflow);
      store.setState({ ...(position !== undefined && { stagePosition: position }), ...(layout !== undefined && { stageLayout: layout }), ...(overflow !== undefined && { stageOverflow: overflow }) });
      if (position !== undefined) this.placeStage();
      if (layout !== undefined) this.stage.arrangeStage();
      this.stage.layout();
    });
    this.changed();
  }
  activity(task: string, environment: string) { if (task === this.session?.key && this.session.ready) this.stage.environmentActivity(environment); }
  private mutate(action: () => void) { this.mutations++; try { action(); } finally { this.mutations--; } }
  private layoutOuter() { if (this.element) this.workspace?.layout(this.element.clientWidth, this.element.clientHeight, true); }
  private sync() {
    const workspace = this.workspace;
    if (!workspace) return;
    const has = this.stage.environmentIds().length > 0, panel = workspace.getPanel('stage');
    if (!has && panel) this.removeStage();
    if (has && !panel) {
      workspace.addPanel({ id: 'stage', component: 'stage', minimumWidth: 100, minimumHeight: 100 });
      this.placeStage();
    }
    this.stage.syncStage(); this.stage.layout();
  }
  private removeStage() {
    const panel = this.workspace?.getPanel('stage');
    this.unmountStage(this.stage.api); this.stage.saved = null;
    if (panel) this.workspace!.removePanel(panel);
  }
  private placeStage() {
    const workspace = this.workspace, panel = workspace?.getPanel('stage');
    if (!workspace || !panel) return;
    const position = store.getState().stagePosition;
    workspace.orientation = position === 'above' ? Orientation.VERTICAL : Orientation.HORIZONTAL;
    const root = workspace.toJSON().grid.root;
    const firstPanel = (node: typeof root): string => Array.isArray(node.data) ? firstPanel(node.data[0]!) : node.data.id;
    const first = firstPanel(root), wanted = position === 'right' ? 'development' : 'stage';
    // Moving the later panel preserves the reference's grid location through removal.
    if (first !== wanted) workspace.movePanel(workspace.getPanel(wanted)!, { reference: first, direction: position === 'above' ? 'above' : 'left' });
    panel.api.setSize(position === 'above' ? { height: Math.round(workspace.height * this.stageShare) } : { width: Math.round(workspace.width * this.stageShare) });
  }
  private currentShare() {
    const panel = this.workspace?.getPanel('stage'), vertical = store.getState().stagePosition === 'above';
    const total = vertical ? this.workspace?.height : this.workspace?.width;
    return panel && total ? (vertical ? panel.api.height : panel.api.width) / total : this.stageShare;
  }
  private changed = () => {
    this.scheduleLayout(); clearTimeout(this.saveTimer);
    if (this.mutations || !this.session?.ready || store.getState().gridPhase !== 'ready') return;
    this.dirty = true;
    this.saveTimer = window.setTimeout(() => this.flush(), 300);
  };
  private flush() {
    clearTimeout(this.saveTimer);
    const session = this.session, api = this.development.api, state = store.getState();
    if (!this.dirty || !session?.ready || !api) return;
    this.dirty = false;
    kulisa.send('layout:save', { task: session.key, layout: { version: 3, workspace: api.toJSON(), stage: this.stage.api?.toJSON() ?? this.stage.saved,
      stageLayout: state.stageLayout, stageOverflow: state.stageOverflow, stagePosition: state.stagePosition, stageShare: this.currentShare() } satisfies TaskLayout });
  }
  scheduleLayout = () => {
    if (!this.workspace) return;
    cancelAnimationFrame(this.layoutFrame);
    const session = this.session;
    this.layoutFrame = requestAnimationFrame(() => {
      if (!session?.ready || !this.owns(session)) return;
      this.development.constrain();
      kulisa.send('layout:apply', { task: session.key, rects: pageRects(this.stage.api, this.stage.viewport, store.getState().profiles) });
    });
  };
  private cancelFrames() {
    clearTimeout(this.saveTimer); clearTimeout(this.dropTimer); this.dirty = false; this.dragSession = null;
    cancelAnimationFrame(this.layoutFrame);
  }
  startResourceDrag(panel: DockviewPanelApi, event: DragEvent) {
    const api = this.development.api;
    if (!api || !event.dataTransfer) { event.preventDefault(); return; }
    // The Resources rail has no Dockview header to initiate this drag.
    LocalSelectionTransfer.getInstance<PanelTransfer>().setData([new PanelTransfer(api.id, panel.group.id, panel.id)], PanelTransfer.prototype);
    this.resourceDragging = true; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', '');
    this.beginDrag();
  }
  private finishResourceDrag() {
    if (!this.resourceDragging) return;
    this.resourceDragging = false;
    LocalSelectionTransfer.getInstance<PanelTransfer>().clearData(PanelTransfer.prototype);
  }
  private beginDrag = () => { this.dragSession = this.session; void this.host.freeze(); };
  private finishDrag = () => {
    const session = this.dragSession; this.dragSession = null;
    this.finishResourceDrag();
    if (session && this.owns(session)) void this.host.unfreeze();
  };
}
