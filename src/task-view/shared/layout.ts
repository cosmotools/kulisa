// Saved grid compatibility and pruning without resetting peers (../README.md).
import type { StageLayout, StagePosition } from '../ipc.ts';
import type { SerializedDockview, SerializedGridviewComponent } from 'dockview-react';
export const environmentMinimum = { width: 600, height: 300 } as const;
export interface TaskLayout { version: 3; workspace: SerializedDockview; stage: SerializedDockview | null; split?: SerializedGridviewComponent | null; stageLayout?: StageLayout | null; stageOverflow?: boolean; stagePosition?: StagePosition }
type Node = SerializedDockview['grid']['root'];
type Group = { id: string; views: string[]; activeView?: string };
// Import a legacy fraction into Gridview's descriptor so live sizing belongs to the library.
function splitOf(position: StagePosition = 'above', share?: number): SerializedGridviewComponent | undefined {
  if (!share || !Number.isFinite(share) || share <= 0 || share >= 1) return;
  const leaf = (id: string, size: number) => ({ type: 'leaf' as const, size, data: { id, component: id, minimumWidth: 100, minimumHeight: 100 } });
  const stage = leaf('stage', share * 1000), development = leaf('development', (1 - share) * 1000);
  return { grid: { width: 1000, height: 1000, orientation: (position === 'above' ? 'VERTICAL' : 'HORIZONTAL') as SerializedGridviewComponent['grid']['orientation'],
    root: { type: 'branch', size: 1000, data: position === 'right' ? [development, stage] : [stage, development] } } };
}
// Saved pane IDs are translated at the layout boundary so environment names remain user data.
function canonicalStage(layout: SerializedDockview | null): SerializedDockview | null {
  if (!layout?.panels || !Object.keys(layout.panels).some((id) => id.startsWith('application:'))) return layout;
  const idOf = (id: string) => id.replace(/^application:/, 'stage-terminal:');
  function visit(n: Node): Node {
    if (n.type === 'branch') return { ...n, data: (n.data as Node[]).map(visit) };
    const g = n.data as Group;
    return { ...n, data: { ...g, views: g.views.map(idOf), ...(g.activeView && { activeView: idOf(g.activeView) }) } };
  }
  return { ...layout, grid: { ...layout.grid, root: visit(layout.grid.root) },
    panels: Object.fromEntries(Object.entries(layout.panels).map(([id, p]) => [idOf(id), { ...p, id: idOf(p.id),
      contentComponent: p.contentComponent === 'application' ? 'stage-terminal' : p.contentComponent,
      tabComponent: p.tabComponent === 'application' ? 'stage-terminal' : p.tabComponent }])) };
}
export function filterLayout(layout: SerializedDockview, keep: (id: string) => boolean): SerializedDockview {
  const panels = Object.fromEntries(Object.entries(layout.panels).filter(([id]) => keep(id)));
  let activeGroup: string | undefined;
  function visit(n: Node): Node | null {
    if (n.type === 'branch') {
      const data = (n.data as Node[]).map(visit).filter((c): c is Node => !!c);
      return data.length ? { ...n, data } : null;
    }
    const g = n.data as Group, views = g.views.filter((v) => v in panels);
    if (views.length && g.id === layout.activeGroup) activeGroup = g.id;
    return views.length ? { ...n, data: { ...g, views, activeView: views.includes(g.activeView!) ? g.activeView : views[0] } } : null;
  }
  const root = visit(layout.grid.root) || { type: 'branch' as const, data: [] };
  return { grid: { ...layout.grid, root }, panels, ...(activeGroup && { activeGroup }) };
}
// Find the common split of Stage and Terminal; nested branches alternate orientation.
function placementOf(layout: SerializedDockview): Pick<TaskLayout, 'stagePosition' | 'split'> {
  const contains = (n: Node, id: string): boolean => n.type === 'branch'
    ? (n.data as Node[]).some((c) => contains(c, id)) : (n.data as Group).views.includes(id);
  function visit(n: Node, horizontal: boolean): Pick<TaskLayout, 'stagePosition' | 'split'> | null {
    if (n.type !== 'branch') return null;
    const nodes = n.data as Node[], s = nodes.findIndex((c) => contains(c, 'stage')), t = nodes.findIndex((c) => contains(c, 'terminal'));
    if (s < 0 || t < 0) return null;
    if (s === t) return visit(nodes[s]!, !horizontal);
    const stagePosition = horizontal ? s < t ? 'left' : 'right' : 'above';
    const total = nodes.reduce((sum, child) => sum + (child.size ?? 0), 0);
    return { stagePosition, split: splitOf(stagePosition, total > 0 ? (nodes[s]!.size ?? 0) / total : undefined) };
  }
  return visit(layout.grid.root, layout.grid.orientation === 'HORIZONTAL') ?? { stagePosition: 'above' };
}
export function splitLayout(saved: unknown): TaskLayout | null {
  if (!saved || typeof saved !== 'object') return null;
  const value = saved as TaskLayout & SerializedDockview;
  if (value.version === 3) {
    const { stageShare, ...rest } = value as TaskLayout & { stageShare?: number };
    const stage = canonicalStage(value.stage), split = value.split ?? splitOf(value.stagePosition, stageShare);
    return stage === value.stage && split === value.split && !('stageShare' in value) ? value : { ...rest, stage, split };
  }
  if ((saved as { version?: number }).version === 2) {
    if (!value.workspace?.grid?.root || !value.workspace.panels) return null;
    const mode = (saved as { stageLayout?: unknown }).stageLayout;
    return { ...value, version: 3, workspace: filterLayout(value.workspace, (id) => id === 'terminal' || id === 'resources'),
      ...placementOf(value.workspace), stageLayout: mode === 'column' ? 'vertical' : mode === 'row' ? 'horizontal' : value.stageLayout };
  }
  if (!value.grid || !value.panels) return null;
  return { version: 3, workspace: filterLayout(value, (id) => id === 'terminal' || id === 'resources'), stage: filterLayout(value, (id) => id.startsWith('profile:')), stagePosition: 'above' };
}
