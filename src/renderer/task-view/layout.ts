// Stage layout restoration and environment IDs (docs/window.md, The grid).
import type { DockviewApi, SerializedDockview } from 'dockview-react';
import { filterLayout } from '../../shared/stage-layout';

export const panelId = (id: string) => `profile:${id}`;
export function restoreDockview(a: DockviewApi, saved: SerializedDockview | null, known: string[]) {
  if (!saved) return;
  try {
    a.fromJSON(filterLayout(saved, (id) => known.includes(id)));
  } catch (e) { console.warn('[layout] saved grid not restored:', (e as Error).message); a.clear(); }
}
