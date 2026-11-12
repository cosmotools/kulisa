// Selected-task labels/counts for shell menus; no task controllers or content (docs/window.md).
import { store } from './store';
import { actionsFor } from './actions';
import { openSettings } from './settings';
import { plural } from './common';
import type { MenuItem } from './menu';
export function environmentItems(): MenuItem[] {
  const task = store.getState().summary;
  if (!task) return [];
  return [{ label: 'Stage Terminal', run: () => kulisa.invoke('task:command', { task: task.key, command: 'terminal:open' }) }, '-',
    ...task.closedProfiles.map((p) => ({ label: p.name, avatar: p.avatar, run: () => actionsFor(task.key)('profile:open', { profile: p.id }) })),
    ...task.closedProfiles.length ? [] : [{ label: 'Add Profile…', run: () => openSettings() }]];
}
export function profilesMenu(): MenuItem[] {
  const task = store.getState().summary;
  if (!task) return [];
  return [...task.profiles.map((p) => ({ label: p.name, sub: p.description || plural(p.tabs, 'tab'), avatar: p.avatar,
    run: () => kulisa.invoke('task:command', { task: task.key, command: 'profile:show', profile: p.id }) })),
  ...task.closedProfiles.map((p) => ({ label: p.name, sub: `closed · click to open${p.description ? ` · ${p.description}` : ''}`, avatar: p.avatar,
    run: () => actionsFor(task.key)('profile:open', { profile: p.id }) })),
  ...(task.profiles.length || task.closedProfiles.length ? ['-' as const] : []),
  { label: 'Manage Profiles…', run: () => openSettings('profiles') }];
}
