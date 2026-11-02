// Development layout, Resources constraints and review selection (docs/window.md, The grid).
import { Orientation } from 'dockview-react';
import type { DockviewApi, DockviewPanelApi, SerializedDockview } from 'dockview-react';
import { store as windowStore, shownTask } from '../lib/store';
import type { TaskStore } from './state';
import type { DiffSelection } from '../../diff/ipc';
import { dockTheme } from './dock-theme';
import { restoreDockview, resourceBarHeight } from './layout';
import { createDiff } from '../../diff/renderer';
import { menuAt } from '../lib/menu';

export interface ResourceParams { section?: 'project' | 'artifacts' | 'terminals' | 'diff' | null; expandedWidth?: number; expandedHeight?: number }
const resourceMinimumWidth = 300, resourceRailWidth = 40;
interface GroupInsets { width: number; height: number; axis: 'width' | 'height' }
const emptyInsets: GroupInsets = { width: 0, height: 0, axis: 'width' };

export class DevelopmentGrid {
  api: DockviewApi | null = null;
  private developmentGap = dockTheme.gap ?? 0;
  private terminalFold: { group: DockviewApi['groups'][number]; axis: GroupInsets['axis']; size: number } | null = null;
  private frame = 0;
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
  attach(api: DockviewApi) { this.api = api; this.developmentGap = dockTheme.gap ?? 0; }
  dispose() { cancelAnimationFrame(this.frame); this.reviewSession?.client.clear(); this.reviewSession = null; this.api = null; this.terminalFold = null; }
  build(saved: SerializedDockview | null) {
    const a = this.api!;
    this.terminalFold = null;
    restoreDockview(a, saved, ['terminal', 'resources']);
    if (!a.getPanel('terminal') || !a.getPanel('resources')) {
      a.clear();
      a.addPanel({ id: 'terminal', component: 'terminal', tabComponent: 'terminal', title: 'Terminal', renderer: 'always' });
      a.addPanel({ id: 'resources', component: 'resources', tabComponent: 'resources', title: 'Resources', minimumHeight: resourceBarHeight, position: { referencePanel: 'terminal', direction: 'left' } });
      a.getPanel('resources')!.group.api.setSize({ width: Math.round(a.width / 4) });
    }
    this.constrain();
    const resources = a.getPanel('resources')!;
    if (resources.params?.section === 'diff') this.openDiff(false);
    else this.showAgents();
    // Dockview applies its default minimum before runtime group constraints.
    if (resources.params?.section === null) this.sizeResources(resources.api, resources.params);
  }
  selectResource = (panel: DockviewPanelApi, params: ResourceParams, section: NonNullable<ResourceParams['section']>) => {
    const current = params.section === undefined ? 'project' : params.section;
    const next = current === section ? null : section;
    const updated = { ...params, section: next };
    if (current) {
      const axis = (this.insets().get(panel.group.id) ?? emptyInsets).axis;
      if (axis === 'width') updated.expandedWidth = panel.width;
      else updated.expandedHeight = panel.height;
    }
    panel.updateParameters(updated);
    if (next === 'diff') this.openDiff();
    else if (current === 'diff') this.showAgents();
    this.constrain();
    if (!current || !next) this.sizeResources(panel, updated);
    this.changed();
  };

  private sizeResources = (panel: DockviewPanelApi, params: ResourceParams) => {
    // A shared tab group keeps the room its other panels need.
    if (panel.group.panels.length !== 1) return;
    const inset = this.insets().get(panel.group.id) ?? emptyInsets;
    const open = params.section !== null;
    if (inset.axis === 'height') panel.setSize({ height: (open ? params.expandedHeight ?? this.api!.height / 2 : resourceBarHeight) + inset.height });
    else panel.setSize({ width: (open ? Math.max(resourceMinimumWidth, params.expandedWidth ?? resourceMinimumWidth) : resourceRailWidth) + inset.width });
  };

  private insets = () => {
    const insets = new Map<string, GroupInsets>(), grid = this.api?.toJSON().grid;
    if (!grid) return insets;
    const gap = this.developmentGap;
    function visit(node: SerializedDockview['grid']['root'], horizontal: boolean, inset: GroupInsets) {
      if (!Array.isArray(node.data)) { insets.set(node.data.id, inset); return; }
      const share = gap * (node.data.length - 1) / node.data.length;
      const axis = horizontal ? 'width' : 'height';
      const next: GroupInsets = { ...inset, [axis]: share, axis };
      node.data.forEach((child) => visit(child, !horizontal, next));
    }
    visit(grid.root, grid.orientation === Orientation.HORIZONTAL, emptyInsets);
    return insets;
  };

  private restoreTerminalSize = () => {
    const before = this.terminalFold; this.terminalFold = null;
    if (!before || !this.api?.groups.includes(before.group)) return;
    before.group.api.setConstraints({ minimumWidth: 0, maximumWidth: Infinity, minimumHeight: 0, maximumHeight: Infinity });
    const inset = this.insets().get(before.group.id) ?? emptyInsets;
    const minimum = before.axis === 'height' ? 150 : 200;
    before.group.api.setSize({ [before.axis]: Math.max(before.size, minimum) + inset[before.axis] });
  };

  constrain = () => {
    cancelAnimationFrame(this.frame); this.frame = 0;
    const resources = this.api?.getPanel('resources'), terminal = this.api?.getPanel('terminal');
    const gap = resources?.params?.section === null && resources.group.panels.length === 1 ? 0 : dockTheme.gap ?? 0;
    if (this.developmentGap !== gap) {
      this.developmentGap = gap;
      this.api?.updateOptions({ theme: { ...dockTheme, gap } });
    }
    if (this.terminalFold && this.terminalFold.group !== terminal?.group) this.restoreTerminalSize();
    const insets = this.insets();
    const state = this.store.getState(), emptyTerminal = !state.developmentTerminals.list.length;
    let constrained = false;
    for (const group of this.api?.groups ?? []) {
      const resource = group.panels.some((p) => p.id === 'resources');
      const hasTerminal = group.panels.some((p) => p.id === 'terminal');
      const standalone = group.panels.length === 1;
      const hiddenHeader = standalone && (resource || hasTerminal);
      if (group.header.hidden !== hiddenHeader) group.header.hidden = hiddenHeader;
      const inset = insets.get(group.id) ?? emptyInsets;
      const closed = resource && resources?.params?.section === null;
      const foldTerminal = standalone && hasTerminal && emptyTerminal && this.screen() === 'agents' && state.profiles.length > 0;
      const previous = this.terminalFold?.group === group ? this.terminalFold : null;
      if (previous && (!foldTerminal || previous.axis !== inset.axis)) {
        this.restoreTerminalSize();
        // An axis change needs the restored layout before measuring the terminal's new expanded size.
        if (foldTerminal) { this.frame = requestAnimationFrame(this.constrain); continue; }
      }
      const beginFold = foldTerminal && !this.terminalFold;
      if (beginFold) this.terminalFold = { group, axis: inset.axis, size: group.api[inset.axis] };

      const minimum = { width: 100, height: 100 }, maximum = { width: Infinity, height: Infinity };
      if (resource) {
        minimum.width = (closed ? 100 : resourceMinimumWidth) + inset.width;
        if (closed && standalone) minimum.width = resourceRailWidth + inset.width;
        minimum.height = resourceBarHeight + inset.height;
        if (!standalone) minimum.height += 36;
      }
      if (foldTerminal) minimum[inset.axis] = 36;
      if (foldTerminal || standalone && closed) maximum[inset.axis] = minimum[inset.axis];

      const minimumWidth = minimum.width, minimumHeight = minimum.height;
      const maximumWidth = maximum.width, maximumHeight = maximum.height;
      if (group.minimumWidth !== minimumWidth || group.maximumWidth !== maximumWidth || group.minimumHeight !== minimumHeight || group.maximumHeight !== maximumHeight) {
        group.api.setConstraints({ minimumWidth, maximumWidth, minimumHeight, maximumHeight });
        constrained = true;
      }
      if (beginFold) group.api.setSize({ [inset.axis]: 36 });
    }
    // Dockview publishes a constraint change before storing its explicit group limits.
    if (constrained && this.api) this.api.layout(this.api.width, this.api.height, true);
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
