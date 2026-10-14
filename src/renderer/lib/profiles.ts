// The shown task's profiles as a menu (docs/profiles.md). An open one brings its pane to the front: it may be stacked
// behind another.
import { act, store } from './store';
import { plural } from './common';
import { showPane } from './grid';
import { dialog } from './dialogs';
import type { MenuItem } from './menu';

export const profilesMenu = (): MenuItem[] => [
  ...store.profiles.map((p) => ({ label: p.name, sub: p.description || plural(p.tabs.length, 'tab'), avatar: p.avatar,
    run: () => showPane(p.key) })),
  ...store.closedProfiles.map((p) => ({ label: p.name, sub: `closed · click to open${p.description ? ` · ${p.description}` : ''}`, avatar: p.avatar,
    run: () => act('profile:open', { profile: p.id }) })),
  ...(store.profiles.length || store.closedProfiles.length ? ['-' as const] : []),
  { label: 'Manage Profiles…', run: async () => (await dialog('projects')).openProfiles() },
];
// With no profile open, tiles that open one (ClosedProfiles.vue, the launchers in Terminals.vue): each closed one,
// or, with none in the project, its page in Settings to add them.
export const profileLaunchers = () => store.closedProfiles.length
  ? store.closedProfiles.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, sub: p.description || '',
    title: `Open ${p.name}${p.description ? `: ${p.description}` : ''}`, run: () => act('profile:open', { profile: p.id }) }))
  : [{ id: 'add', name: 'Add Profile…', avatar: null, sub: '', title: "The project's profiles, in Settings",
    run: async () => (await dialog('projects')).openProjects(store.projects.project ?? undefined) }];
// The main process asks the human first (Task.deleteProfile).
export const deleteProfile = (id: string) => act('profile:delete', { profile: id });
