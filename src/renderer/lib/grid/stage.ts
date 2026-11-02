// Stage environments, overflow sizing and following (docs/window.md, The grid).
import type { DockviewApi, GridviewPanelApi, SerializedDockview } from 'dockview-react';
import { store } from '../store';
import { environmentMinimum } from '../../../shared/stage-layout';
import { dockTheme } from '../dock-theme';
import { restoreDockview, panelId } from './layout';

export class StageGrid {
  api: DockviewApi | null = null;
  saved: SerializedDockview | null = null;
  viewport: HTMLElement | null = null;
  private parent: GridviewPanelApi | null = null;
  private activityTimer = 0;
  private followFrame = 0;
  private lastEnvironment: string | null = null;
  constructor(private readonly scheduleLayout: () => void) {}
  environmentIds = () => [...store.getState().profiles.map((p) => panelId(p.id)), ...store.getState().stageTerminals.map((a) => `stage-terminal:${a.id}`)];
  attach(api: DockviewApi, parent: GridviewPanelApi, viewport: HTMLElement) {
    this.api = api; this.parent = parent; this.viewport = viewport;
    this.layout();
    restoreDockview(api, this.saved, this.environmentIds()); this.saved = null;
    if (!api.panels.length) this.arrangeStage(); else this.syncStage();
    // Stage identities and pane controls need their headers, independently of saved visibility flags.
    for (const group of api.groups) group.header.hidden = false;
    this.constrainStage(); this.layout();
  }
  detach(api: DockviewApi | null = this.api) {
    if (this.api !== api) return;
    this.api = null; this.parent = null; this.viewport = null;
  }
  reset() {
    clearTimeout(this.activityTimer); cancelAnimationFrame(this.followFrame); this.lastEnvironment = null;
    store.setState({ stageActivity: null, stageFollowPaused: false });
  }
  layout = () => {
    const api = this.api, parent = this.parent, viewport = this.viewport;
    if (!api || !parent || !viewport) return;
    const { stageLayout: mode, stageOverflow: overflow } = store.getState();
    const scrolling = overflow && mode !== 'tabs' && !api.hasMaximizedGroup(), count = this.environmentIds().length;
    const gap = Math.max(0, count - 1) * (dockTheme.gap ?? 0);
    viewport.style.overflowX = scrolling && mode !== 'vertical' ? 'auto' : 'hidden';
    viewport.style.overflowY = scrolling && mode === 'vertical' ? 'auto' : 'hidden';
    const canvas = viewport.firstElementChild as HTMLElement;
    // The cross-axis percentage excludes the room the scroll bar takes inside the viewport.
    canvas.style.width = scrolling && mode !== 'vertical' ? `${Math.max(parent.width, count * environmentMinimum.width + gap)}px` : '100%';
    canvas.style.height = scrolling && mode === 'vertical' ? `${Math.max(parent.height, count * environmentMinimum.height + gap)}px` : '100%';
    api.layout(canvas.clientWidth, canvas.clientHeight, true);
  };
  follow() { if (this.lastEnvironment) this.followEnvironment(this.lastEnvironment); }
  addEnvironment = (id: string, reference?: string, direction: 'right' | 'below' | 'within' = 'right', inactive = false) => {
    const profile = id.startsWith('profile:');
    this.api!.addPanel({ id, component: profile ? 'profile' : 'stage-terminal', tabComponent: profile ? 'profile' : 'stage-terminal',
      title: profile ? store.getState().profiles.find((p) => panelId(p.id) === id)?.name : store.getState().stageTerminals.find((a) => `stage-terminal:${a.id}` === id)?.name,
      ...(!profile && { renderer: 'always' as const }), ...(reference && { position: { referencePanel: reference, direction } }), inactive });
  };

  constrainStage = (mode = store.getState().stageLayout, overflow = store.getState().stageOverflow) => {
    if (!this.api) return;
    const scrolling = overflow && mode !== 'tabs' && !this.api.hasMaximizedGroup();
    const minimumWidth = scrolling && mode !== 'vertical' ? environmentMinimum.width : 0;
    const minimumHeight = scrolling && mode === 'vertical' ? environmentMinimum.height : 0;
    const { width, height } = this.api;
    // Constraints apply per group: reserve room for both old and new minima before shrinking the canvas.
    this.api.layout(Math.max(width, this.api.minimumWidth, minimumWidth * this.api.groups.length),
      Math.max(height, this.api.minimumHeight, minimumHeight * this.api.groups.length), true);
    for (const group of this.api.groups) group.api.setConstraints({ minimumWidth, minimumHeight });
    this.api.layout(width, height, true);
  };

  arrangeStage = () => {
    if (!this.api) return;
    this.api.clear();
    const ids = this.environmentIds();
    const mode = store.getState().stageLayout;
    ids.forEach((id, i) => this.addEnvironment(id, i ? ids[i - 1] : undefined, mode === 'tabs' ? 'within' : mode === 'vertical' ? 'below' : 'right', mode === 'tabs' && i > 0));
  };

  syncStage = () => {
    if (!this.api) return;
    const ids = this.environmentIds();
    for (const p of this.api.panels) if (!ids.includes(p.id)) this.api.removePanel(p);
    for (const id of ids) if (!this.api.getPanel(id)) {
      const mode = store.getState().stageLayout;
      this.addEnvironment(id, this.api.panels.at(-1)?.id, mode === 'tabs' ? 'within' : mode === 'vertical' ? 'below' : 'right');
    }
  };

  followEnvironment = (environment: string) => {
    cancelAnimationFrame(this.followFrame);
    const task = store.getState().current;
    this.followFrame = requestAnimationFrame(() => {
      const state = store.getState();
      if (state.current !== task || !state.stageFollow || state.stageFollowPaused || state.loading) return;
      const panel = this.api?.getPanel(environment);
      if (!panel || (this.api!.hasMaximizedGroup() && !panel.api.isMaximized())) return;
      const focused = document.activeElement;
      if (!panel.api.isVisible) panel.api.setActive();
      if (focused instanceof HTMLElement && focused.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
      panel.group.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      this.scheduleLayout();
    });
  };

  environmentActivity = (environment: string) => {
    this.lastEnvironment = environment;
    clearTimeout(this.activityTimer);
    store.setState({ stageActivity: environment });
    this.activityTimer = window.setTimeout(() => store.setState({ stageActivity: null }), 2000);
    this.followEnvironment(environment);
  };

  pauseStageFollowing = () => {
    if (store.getState().stageFollow) store.setState({ stageFollowPaused: true });
    cancelAnimationFrame(this.followFrame);
  };
}
