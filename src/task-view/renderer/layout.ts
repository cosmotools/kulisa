// Stage layout restoration and pane IDs (../README.md, The grid).
import type { DockviewApi, SerializedDockview } from 'dockview-react';
import { filterLayout } from '../shared/layout';

export function restoreDockview(a: DockviewApi, saved: SerializedDockview | null, known: string[]) {
  if (!saved) return;
  try {
    a.fromJSON(filterLayout(saved, (id) => known.includes(id)));
  } catch (e) { console.warn('[layout] saved grid not restored:', (e as Error).message); a.clear(); }
}
