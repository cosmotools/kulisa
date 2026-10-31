// Split a saved flat grid into development and testing layouts; prune absent panels without resetting peers.
import type { StageLayout, StagePosition } from './ipc.ts';
import type { SerializedDockview } from 'dockview-react';
export const environmentMinimum = { width: 600, height: 300 } as const;
export interface TaskLayout { version: 3; workspace: SerializedDockview; stage: SerializedDockview | null; stageLayout?: StageLayout | null; stageOverflow?: boolean; stagePosition?: StagePosition; stageShare?: number }
type Node = SerializedDockview['grid']['root'];
type Group = { id: string; views: string[]; activeView?: string };
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
  function visit(n: Node): Node | null {
    if (n.type === 'branch') {
      const data = (n.data as Node[]).map(visit).filter((c): c is Node => !!c);
      return data.length ? { ...n, data } : null;
    }
    const g = n.data as Group, views = g.views.filter((v) => v in panels);
    return views.length ? { ...n, data: { ...g, views, activeView: views.includes(g.activeView!) ? g.activeView : views[0] } } : null;
  }
  return { grid: { ...layout.grid, root: visit(layout.grid.root) || { type: 'branch', data: [] } }, panels };
}
// Find the common split of Stage and Terminal; nested branches alternate orientation.
function placementOf(layout: SerializedDockview): Pick<TaskLayout, 'stagePosition' | 'stageShare'> {
  const contains = (n: Node, id: string): boolean => n.type === 'branch'
    ? (n.data as Node[]).some((c) => contains(c, id)) : (n.data as Group).views.includes(id);
  function visit(n: Node, horizontal: boolean): Pick<TaskLayout, 'stagePosition' | 'stageShare'> | null {
    if (n.type !== 'branch') return null;
    const nodes = n.data as Node[], s = nodes.findIndex((c) => contains(c, 'stage')), t = nodes.findIndex((c) => contains(c, 'terminal'));
    if (s < 0 || t < 0) return null;
    if (s === t) return visit(nodes[s]!, !horizontal);
    const total = nodes.reduce((sum, c) => sum + (c.size ?? 0), 0);
    return { stagePosition: horizontal ? s < t ? 'left' : 'right' : 'above', stageShare: total > 0 ? (nodes[s]!.size ?? 0) / total : undefined };
  }
  return visit(layout.grid.root, layout.grid.orientation === 'HORIZONTAL') ?? { stagePosition: 'above' };
}
export function splitLayout(saved: unknown): TaskLayout | null {
  if (!saved || typeof saved !== 'object') return null;
  const value = saved as TaskLayout & SerializedDockview;
  if (value.version === 3) { const stage = canonicalStage(value.stage); return stage === value.stage ? value : { ...value, stage }; }
  if ((saved as { version?: number }).version === 2) {
    if (!value.workspace?.grid?.root || !value.workspace.panels) return null;
    const mode = (saved as { stageLayout?: unknown }).stageLayout;
    return { ...value, version: 3, workspace: filterLayout(value.workspace, (id) => id === 'terminal' || id === 'resources'),
      ...placementOf(value.workspace), stageLayout: mode === 'column' ? 'vertical' : mode === 'row' ? 'horizontal' : value.stageLayout };
  }
  if (!value.grid || !value.panels) return null;
  return { version: 3, workspace: filterLayout(value, (id) => id === 'terminal' || id === 'resources'), stage: filterLayout(value, (id) => id.startsWith('profile:')), stagePosition: 'above' };
}
