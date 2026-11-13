// Saved grids and pruning without resetting peers (../README.md).
import type { StageLayout, StagePosition } from '../ipc.ts';
import type { SerializedDockview, SerializedGridviewComponent } from 'dockview-react';
export const environmentMinimum = { width: 600, height: 300 } as const;
export interface WorkbenchLayout { width: number; collapsed?: boolean; visible?: boolean }
export interface TaskLayout { version: 4; workspace: WorkbenchLayout | null; stage: SerializedDockview | null; split?: SerializedGridviewComponent | null; stageLayout?: StageLayout | null; stageOverflow?: boolean; stagePosition?: StagePosition }
type Node = SerializedDockview['grid']['root'];
type Group = { id: string; views: string[]; activeView?: string };
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
export function splitLayout(saved: unknown): TaskLayout | null {
  if (!saved || typeof saved !== 'object') return null;
  const value = saved as TaskLayout;
  return value.version === 4 ? value : null;
}
