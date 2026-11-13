// Stage environments, overflow sizing and following (../README.md, The grid).
import { preferences } from '../../window-client/renderer';
import type { DockviewApi, SerializedDockview } from 'dockview-react';
import { currentTask, type TaskStore } from './state';
import { environmentMinimum } from '../shared/layout';
import { restoreDockview } from './layout';
import { scenes } from './scenes';

export class StageGrid {
  api: DockviewApi | null = null;
  saved: SerializedDockview | null = null;
  viewport: HTMLElement | null = null;
  private activityTimer = 0;
  private followFrame = 0;
  private lastEnvironment: string | null = null;
  constructor(private readonly store: TaskStore, private readonly reportPages: () => void) {}
  environmentIds = () => scenes.panels(this.store.getState()).map((panel) => panel.id);
  attach(api: DockviewApi, viewport: HTMLElement) {
    this.api = api; this.viewport = viewport;
    this.layout();
    restoreDockview(api, this.saved, this.environmentIds()); this.saved = null;
    const empty = !api.panels.length;
    this.syncStage();
    if (empty && this.store.getState().stageLayout === 'tabs') api.panels[0]?.api.setActive();
    for (const panel of api.panels) panel.api.setRenderer('onlyWhenVisible');
    // Stage identities and pane controls need their headers, independently of saved visibility flags.
    for (const group of api.groups) group.header.hidden = false;
    this.layout();
  }
  detach() {
    this.api = null; this.viewport = null;
  }
  reset() {
    clearTimeout(this.activityTimer); cancelAnimationFrame(this.followFrame); this.lastEnvironment = null;
    this.store.setState({ stageActivity: null, stageFollowPaused: false });
  }
  layout = () => {
    const api = this.api, viewport = this.viewport;
    if (!api || !viewport) return;
    const { stageLayout: mode, stageOverflow: overflow } = this.store.getState();
    const scrolling = overflow && mode !== 'tabs' && !api.hasMaximizedGroup();
    const constraintsChanged = this.constrain(scrolling && mode !== 'vertical' ? environmentMinimum.width : 0,
      scrolling && mode === 'vertical' ? environmentMinimum.height : 0);
    viewport.style.overflowX = scrolling && mode !== 'vertical' ? 'auto' : 'hidden';
    viewport.style.overflowY = scrolling && mode === 'vertical' ? 'auto' : 'hidden';
    const canvas = viewport.firstElementChild as HTMLElement;
    canvas.style.minWidth = scrolling && mode !== 'vertical' ? `${api.minimumWidth}px` : '0';
    canvas.style.minHeight = scrolling && mode === 'vertical' ? `${api.minimumHeight}px` : '0';
    const width = canvas.clientWidth, height = canvas.clientHeight;
    // A group's explicit constraints settle after its constraint event; finish sizing with their final values.
    if (constraintsChanged || width !== api.width || height !== api.height) api.layout(width, height);
  };
  follow() { if (this.lastEnvironment) this.followEnvironment(this.lastEnvironment); }
  addEnvironment = (id: string, reference?: string, direction: 'right' | 'below' | 'within' = 'right', inactive = false) => {
    const panel = scenes.panels(this.store.getState()).find((panel) => panel.id === id);
    if (!panel) return;
    this.api!.addPanel({ ...panel,
      minimumWidth: 0, minimumHeight: 0,
      ...(reference && { position: { referencePanel: reference, direction } }), inactive });
  };

  private constrain(minimumWidth: number, minimumHeight: number) {
    let changed = false;
    for (const group of this.api!.groups) if (group.minimumWidth !== minimumWidth || group.minimumHeight !== minimumHeight) {
      group.api.setConstraints({ minimumWidth, minimumHeight }); changed = true;
    }
    return changed;
  }

  arrangeStage = () => {
    if (!this.api) return;
    // Stack axes can change while panels move between groups.
    this.constrain(0, 0);
    this.api.exitMaximizedGroup();
    const panels = this.environmentIds().map((id) => this.api!.getPanel(id)!), first = panels[0];
    if (!first) return;
    const mode = this.store.getState().stageLayout;
    if (mode === 'tabs') for (const panel of panels.slice(1)) panel.api.moveTo({ group: first.group, position: 'center', skipSetActive: true });
    else for (let i = 1; i < panels.length; i++) {
      const group = this.api.addGroup({ referenceGroup: panels[i - 1]!.group, direction: mode === 'vertical' ? 'below' : 'right', skipSetActive: true,
        constraints: { minimumWidth: 0, minimumHeight: 0 } });
      panels[i]!.api.moveTo({ group, skipSetActive: true });
    }
    (mode === 'tabs' ? first : panels.at(-1)!).api.setActive();
  };

  syncStage = () => {
    if (!this.api) return;
    const panels = scenes.panels(this.store.getState()), ids = panels.map((panel) => panel.id);
    for (const p of this.api.panels) if (!ids.includes(p.id)) this.api.removePanel(p);
    for (const id of ids) if (!this.api.getPanel(id)) {
      const mode = this.store.getState().stageLayout;
      this.addEnvironment(id, this.api.panels.at(-1)?.id, mode === 'tabs' ? 'within' : mode === 'vertical' ? 'below' : 'right');
    }
    for (const panel of panels) {
      const existing = this.api.getPanel(panel.id)!;
      if (existing.title !== panel.title) existing.api.setTitle(panel.title);
    }
  };

  followEnvironment = (environment: string) => {
    cancelAnimationFrame(this.followFrame);
    const task = currentTask(this.store.getState());
    this.followFrame = requestAnimationFrame(() => {
      const state = this.store.getState();
      if (currentTask(state) !== task || !preferences.getState().stageFollow || state.stageFollowPaused || state.loading) return;
      const panel = this.api?.getPanel(environment);
      if (!panel || (this.api!.hasMaximizedGroup() && !panel.api.isMaximized())) return;
      const focused = document.activeElement;
      if (!panel.api.isVisible) panel.api.setActive();
      if (focused instanceof HTMLElement && focused.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
      panel.group.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      this.reportPages();
    });
  };

  environmentActivity = (environment: string) => {
    if (!this.environmentIds().includes(environment)) return;
    this.lastEnvironment = environment;
    clearTimeout(this.activityTimer);
    this.store.setState({ stageActivity: environment });
    this.activityTimer = window.setTimeout(() => this.store.setState({ stageActivity: null }), 2000);
    this.followEnvironment(environment);
  };

  pauseStageFollowing = () => {
    if (preferences.getState().stageFollow) this.store.setState({ stageFollowPaused: true });
    cancelAnimationFrame(this.followFrame);
  };
}
