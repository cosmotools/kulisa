// Split a saved flat grid into development and testing layouts; prune absent panels without resetting peers.
import type { StageLayout } from '../../shared/ipc.ts';
import type { SerializedDockview } from 'dockview-react';
export const environmentMinimum = { width: 600, height: 300 } as const;
export interface TaskLayout { version: 2; workspace: SerializedDockview; stage: SerializedDockview | null; stageLayout?: StageLayout | null; stageOverflow?: boolean }
type Node = SerializedDockview['grid']['root'];
type Group = { id: string; views: string[]; activeView?: string };
function filterLayout(layout: SerializedDockview, keep: (id: string) => boolean): SerializedDockview {
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
export function splitLayout(saved: unknown): TaskLayout | null {
  if (!saved || typeof saved !== 'object') return null;
  const value = saved as TaskLayout & SerializedDockview;
  if (value.version === 2) {
    const mode = (saved as { stageLayout?: unknown }).stageLayout;
    return mode === 'column' || mode === 'row' ? { ...value, stageLayout: mode === 'column' ? 'vertical' : 'horizontal' } : value;
  }
  if (!value.grid || !value.panels) return null;
  return { version: 2, workspace: filterLayout(value, (id) => id === 'terminal' || id === 'resources'), stage: filterLayout(value, (id) => id.startsWith('profile:')) };
}
