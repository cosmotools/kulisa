// A project's menu: what is not one task's (docs/tasks.md, Projects), the sidebar's right-click and a task's tab's
// submenu alike. What needs it loaded (a task of it open somewhere) only then.
import { store } from './store';
import { openSettings } from './settings';
import type { MenuItem } from './menu';
import type { ProjectEntry } from '../../shared/types';

// A project's sort key for "worked in last first" (the sidebar, the bar's + menu): an open task → Infinity, else its last close.
export const lastWorked = (p: ProjectEntry): number => (p.tasks.some((t) => !t.closed) ? Infinity : Math.max(0, ...p.tasks.map((t) => t.closedAt ?? 0)));

// newTask: how its New Task opens one, keys its key; move: its Move All Tasks rows (a tab's); done: a choice that shows
// something made (the sidebar over the grid closes then).
export function projectMenu(p: ProjectEntry, { newTask, keys, move = [], done = () => {} }:
  { newTask: () => unknown; keys?: string; move?: MenuItem[]; done?: () => void }): MenuItem[] {
  const id = p.id, loaded = store.getState().projects.open.some((x) => x.id === id);
  const merged = loaded && p.tasks.some((t) => t.closed && t.merged); // its PR merged, nothing uncommitted: deleting loses nothing (projects.ts, checkMerged)
  return [{ label: 'New Task', keys, run: () => { done(); return newTask(); } },
    '-', ...(move.length ? [...move, '-' as const] : []),
    { label: 'Project Settings…', run: () => { done(); openSettings('projects', id); } },
    { label: 'Show Data Folder', enabled: loaded, run: () => kulisa.invoke('project:show-data', { id }) },
    ...(merged ? [{ label: 'Delete Merged Tasks…', run: () => kulisa.invoke('project:task:delete-merged', { id }) }] : []),
    '-', { label: 'Close All Tasks', enabled: p.tasks.some((t) => !t.closed), run: () => kulisa.invoke('project:task:close-all', { id }) }];
}
