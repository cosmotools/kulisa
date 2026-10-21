// The shown task's profiles as a menu (docs/profiles.md). An open one brings its pane to the front: it may be stacked
// behind another.
import { act, store } from './store';
import { plural } from './common';
import { showPane } from './grid';
import { openSettings } from './dialogs';
import type { MenuItem } from './menu';

export const profilesMenu = (): MenuItem[] => [
  ...store.profiles.map((p) => ({ label: p.name, sub: p.description || plural(p.tabs.length, 'tab'), avatar: p.avatar,
    run: () => showPane(p.key) })),
  ...store.closedProfiles.map((p) => ({ label: p.name, sub: `closed · click to open${p.description ? ` · ${p.description}` : ''}`, avatar: p.avatar,
    run: () => act('profile:open', { profile: p.id }) })),
  ...(store.profiles.length || store.closedProfiles.length ? ['-' as const] : []),
  { label: 'Manage Profiles…', run: () => openSettings('profiles') },
];
// With no profile open, tiles that open one (ClosedProfiles.vue, the launchers in Terminals.vue): each closed one,
// or, with none in the project, its page in Settings to add them. A profile's picture and name, who it is in the tooltip
// alone: under the name it is cut off by the tile's edge.
export const profileLaunchers = () => store.closedProfiles.length
  ? store.closedProfiles.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar,
    title: `Open ${p.name}${p.description ? `: ${p.description}` : ''}`, run: () => act('profile:open', { profile: p.id }) }))
  : [{ id: 'add', name: 'Add Profile…', avatar: null, title: "The project's profiles, in Settings",
    run: () => openSettings() }];
// The main process asks the human first (Task.deleteProfile).
export const deleteProfile = (id: string) => act('profile:delete', { profile: id });
