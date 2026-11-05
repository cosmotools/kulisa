// The shown task's profiles as a menu (docs/profiles.md). An open one brings its pane to the front: it may be stacked
// behind another.
import { actionsFor, taskStore } from './state';
import type { ClosedProfile } from '../../shared/types';
import { plural } from '../lib/common';
import { showPane } from './controller';
import { openSettings } from '../lib/settings';
import type { MenuItem } from '../lib/menu';

export const profilesMenu = (): MenuItem[] => { const { key, profiles, closedProfiles } = taskStore().getState(), act = actionsFor(key); return [
  ...profiles.map((p) => ({ label: p.name, sub: p.description || plural(p.tabs.length, 'tab'), avatar: p.avatar,
    run: () => showPane(key, p.id) })),
  ...closedProfiles.map((p) => ({ label: p.name, sub: `closed · click to open${p.description ? ` · ${p.description}` : ''}`, avatar: p.avatar,
    run: () => act('profile:open', { profile: p.id }) })),
  ...(profiles.length || closedProfiles.length ? ['-' as const] : []),
  { label: 'Manage Profiles…', run: () => openSettings('profiles') },
]; };
// With no profile open, what opens one (the closed profiles' buttons, the terminals' pane's tiles): each closed
// one, or, with none in the project, its page in Settings to add them. A profile's picture and name, who it is in the
// tooltip alone: under the name it is cut off by the tile's edge.
export const profileLaunchers = (task: string, closedProfiles: ClosedProfile[]) => closedProfiles.length
  ? closedProfiles.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar,
    title: `Open ${p.name}${p.description ? `: ${p.description}` : ''}`, run: () => actionsFor(task)('profile:open', { profile: p.id }) }))
  : [{ id: 'add', name: 'Add Profile…', avatar: null, title: "The project's profiles, in Settings",
    run: () => openSettings() }];
