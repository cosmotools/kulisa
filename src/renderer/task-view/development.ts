// Development content and the Resources edge group (docs/window.md, The grid).
import { DockviewCompositeDisposable } from 'dockview-react';
import type { DockviewApi, GridviewPanelApi, SerializedDockview } from 'dockview-react';
import { store as windowStore, shownTask } from '../lib/store';
import type { TaskStore } from './state';
import type { DiffSelection } from '../../diff/ipc';
import { createDiff } from '../../diff/renderer';
import { menuAt } from '../lib/menu';

export const resourceSections = { terminals: 'Agents', project: 'Project', diff: 'Diff', artifacts: 'Artifacts' } as const;
export type ResourceSection = keyof typeof resourceSections;
export const resourcesMinimumHeight = 204;
const resourcesEdge = { id: 'resources', minimumSize: 300, collapsedSize: 40 } as const;

export class DevelopmentGrid {
  api: DockviewApi | null = null;
  private parent: GridviewPanelApi | null = null;
  private subscriptions = new DockviewCompositeDisposable();
  private reviewNavigation = 0;
  private reviewSession: ReturnType<typeof createDiff> | null = null;
  constructor(private readonly store: TaskStore, private readonly changed: () => void) {}
  get review() {
    const task = this.store.getState().key;
    return this.reviewSession ??= createDiff({
      list: (folder, options) => kulisa.invoke('task:diff:list', { key: task, folder, options }),
      targets: (folder) => kulisa.invoke('task:diff:targets', { key: task, folder }),
      review: (folder, options, load) => kulisa.invoke('task:diff:review', { key: task, folder, options, load }),
      contents: (folder, path, options) => kulisa.invoke('task:diff:contents', { key: task, folder, path, options }),
      select: this.showDiff,
      selectFile: this.selectDevelopmentFile,
      showMenu: menuAt,
    });
  }
  screen = (): 'agents' | 'diff' => this.store.getState().developmentDiff ? 'diff' : 'agents';
  get resourceSection(): ResourceSection | null {
    const group = this.api?.getGroup('resources');
    return group && !group.api.isCollapsed() ? group.activePanel?.params?.section ?? null : null;
  }
  attach(api: DockviewApi, parent: GridviewPanelApi) { this.api = api; this.parent = parent; }
  dispose() { this.subscriptions.dispose(); this.reviewSession?.client.clear(); this.reviewSession = null; this.api = null; this.parent = null; }
  build(saved: SerializedDockview | null) {
    const api = this.api!;
    if (saved?.edgeGroups?.left) {
      try { api.fromJSON(saved); }
      catch (error) { console.warn('[layout] saved development grid unavailable:', error); api.clear(); }
    }
    if (!api.getPanel('terminal') || !api.getGroup('resources')) {
      api.clear();
      for (const edge of ['left', 'right', 'top', 'bottom'] as const) if (api.getEdgeGroup(edge)) api.removeEdgeGroup(edge);
      api.addPanel({ id: 'terminal', component: 'terminal', title: 'Terminal' });
      // Import the choices from a saved movable Resources panel.
      const previous = saved?.panels.resources?.params;
      const resources = api.addEdgeGroup('left', { ...resourcesEdge, initialSize: previous?.expandedWidth });
      for (const [section, title] of Object.entries(resourceSections)) api.addPanel({ id: `resources:${section}`, component: 'resources',
        tabComponent: 'resources', title, params: { section }, position: { referenceGroup: 'resources' }, inactive: true });
      const section = previous?.section && Object.hasOwn(resourceSections, previous.section) ? previous.section : 'project';
      api.getPanel(`resources:${section}`)!.api.setActive();
      if (previous?.section === null) resources.collapse();
    }
    const terminal = api.getPanel('terminal')!;
    terminal.api.setRenderer('onlyWhenVisible');
    terminal.group.header.hidden = true;
    const resources = api.getEdgeGroup('left')!;
    // The outer split must reserve room for the edge strip/content and the central terminal.
    const constrainParent = () => this.parent!.setConstraints({ minimumWidth: api.minimumWidth
      + (resources.isCollapsed() ? resourcesEdge.collapsedSize : resourcesEdge.minimumSize) });
    constrainParent();
    this.subscriptions.addDisposables(resources.onDidActivePanelChange(this.resourceChanged), resources.onDidCollapsedChange(constrainParent),
      resources.onDidCollapsedChange(this.resourceChanged));
    this.resourceChanged();
  }
  showResource(section: ResourceSection) {
    this.api?.getPanel(`resources:${section}`)?.api.setActive();
    this.api?.getEdgeGroup('left')?.expand();
  }
  private resourceChanged = () => {
    if (this.resourceSection === 'diff') this.openDiff(false);
    else if (this.store.getState().developmentDiff) this.showAgents();
    this.changed();
  };

  openDiff = (activate = true) => {
    const task = shownTask(windowStore.getState(), this.store.getState().key), root = task?.resources[0];
    if (root) this.showDiff({ folder: root.folder, path: '', options: {} }, activate);
    else this.showAgents();
  };

  showAgents = () => {
    this.reviewSession?.client.clear(); this.reviewSession = null;
    this.store.setState({ developmentDiff: null });
    this.changed();
  };

  private showDiff = (selection: DiffSelection, activate = true) => {
    this.store.setState({ developmentDiff: { ...selection, navigation: ++this.reviewNavigation } });
    if (activate) this.api?.getPanel('terminal')?.api.setActive();
    this.changed();
  };

  selectDevelopmentFile = (path: string, navigation: number | undefined) => {
    const current = this.store.getState().developmentDiff;
    if (!current || current.navigation !== navigation || current.path === path) return;
    this.store.setState({ developmentDiff: { ...current, path } });
  };
}
