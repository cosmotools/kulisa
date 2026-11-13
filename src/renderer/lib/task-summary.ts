// Selected-task labels/counts for shell menus; no task controllers or content (docs/window.md).
import { store } from './store';
import { actionsFor } from '../../window-client/renderer';
import { openSettings } from './settings';
import { plural } from './common';
import { profileLaunchers } from '../../browser-pane/renderer/launchers';
import { terminalLauncher } from '../../terminal-pane/renderer/launchers';
import type { MenuItem } from '../../menus/renderer';
export function stagePaneItems(): MenuItem[] {
  const task = store.getState().summary;
  if (!task) return [];
  const act = actionsFor(task.key);
  return [terminalLauncher(() => act('task:command', { command: 'terminal:open' })), '-', ...profileLaunchers(act, task.closedProfiles)];
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
