// Dockview saved dimensions and runtime split allocations (docs/window.md, The grid).
import type { DockviewApi, SerializedDockview } from 'dockview-react';
import { filterLayout } from '../../shared/stage-layout';
import { dockTheme } from './dock-theme';

export const resourceBarHeight = 204;
export const panelId = (id: string) => `profile:${id}`;
export function restoreDockview(a: DockviewApi, saved: SerializedDockview | null, known: string[]) {
  if (!saved) return;
  try {
    const filtered = filterLayout(saved, (id) => known.includes(id));
    if (filtered.panels.resources) filtered.panels.resources = { ...filtered.panels.resources, tabComponent: 'resources', minimumHeight: resourceBarHeight };
    // Review state belongs to the active view; the layout keeps panel placement and the Resources section.
    if (filtered.panels.terminal) filtered.panels.terminal = { ...filtered.panels.terminal, params: undefined };
    const standaloneResources = (node: SerializedDockview['grid']['root']): boolean => Array.isArray(node.data)
      ? node.data.some(standaloneResources) : node.data.views.length === 1 && node.data.views[0] === 'resources';
    const gap = filtered.panels.resources?.params?.section === null && standaloneResources(filtered.grid.root) ? 0 : dockTheme.gap ?? 0;
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
