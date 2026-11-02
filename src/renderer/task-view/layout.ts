// Dockview saved dimensions and runtime split allocations (docs/window.md, The grid).
import type { DockviewApi, SerializedDockview } from 'dockview-react';
import { filterLayout } from '../../shared/stage-layout';
import { dockTheme } from './dock-theme';

export const panelId = (id: string) => `profile:${id}`;
export function restoreDockview(a: DockviewApi, saved: SerializedDockview | null, known: string[]) {
  if (!saved) return;
  try {
    const filtered = filterLayout(saved, (id) => known.includes(id));
    const gap = dockTheme.gap ?? 0;
    // Dockview serializes sizes after subtracting gaps, but restores them as split allocations before gaps.
    const allocations = (node: SerializedDockview['grid']['root']): SerializedDockview['grid']['root'] => {
      if (!Array.isArray(node.data)) return node;
      const visible = node.data.filter((child) => child.visible !== false).length;
      const share = gap * Math.max(0, visible - 1) / Math.max(1, visible);
      return { ...node, data: node.data.map((child) => ({ ...allocations(child),
        ...(child.size !== undefined && child.visible !== false && { size: child.size + share }) })) };
    };
    a.fromJSON({ ...filtered, grid: { ...filtered.grid, root: allocations(filtered.grid.root) } });
  } catch (e) { console.warn('[layout] saved grid not restored:', (e as Error).message); a.clear(); }
}
