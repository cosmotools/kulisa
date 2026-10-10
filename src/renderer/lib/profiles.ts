// The shown task's profiles as a menu (its chip on the task's tab, the tab's right-click menu): an open one brings its
// pane to the front (it may be stacked behind another); a closed one opens; each with who it is, when said; then
// Manage Profiles… (ProfileEditor.vue).
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
  { label: 'Manage Profiles…', run: async () => (await dialog('profiles')).manage() },
];
// The main process asks the human first (Task.deleteProfile).
export const deleteProfile = (id: string) => act('profile:delete', { profile: id });
