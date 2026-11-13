// Browser profile opening actions shared by Stage buttons and shell menus (../README.md).
import type { actionsFor } from '../../window-client/renderer';
import type { ClosedProfile } from '../../shared/types';
import { openSettings } from '../../window-client/renderer';

export const profileLaunchers = (act: ReturnType<typeof actionsFor>, closedProfiles: readonly Pick<ClosedProfile, 'id' | 'name' | 'avatar' | 'description'>[]) => closedProfiles.length
  ? closedProfiles.map((p) => ({ id: p.id, label: p.name, avatar: p.avatar,
    title: `Open ${p.name}${p.description ? `: ${p.description}` : ''}`, run: () => act('profile:open', { profile: p.id }) }))
  : [{ id: 'add', label: 'Add Profile…', avatar: undefined, title: "The project's profiles, in Settings",
    run: () => openSettings() }];
