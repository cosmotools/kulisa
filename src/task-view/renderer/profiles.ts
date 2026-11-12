// The shown task's profiles as a menu (docs/profiles.md). An open one brings its pane to the front: it may be stacked
// behind another.
import { actionsFor } from '../../window-client/renderer';
import type { ClosedProfile } from '../../shared/types';
import { openSettings } from '../../window-client/renderer';

// With no profile open, what opens one (the closed profiles' buttons, the terminals' pane's tiles): each closed
// one, or, with none in the project, its page in Settings to add them. A profile's picture and name, who it is in the
// tooltip alone: under the name it is cut off by the tile's edge.
export const profileLaunchers = (task: string, closedProfiles: ClosedProfile[]) => closedProfiles.length
  ? closedProfiles.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar,
    title: `Open ${p.name}${p.description ? `: ${p.description}` : ''}`, run: () => actionsFor(task)('profile:open', { profile: p.id }) }))
  : [{ id: 'add', name: 'Add Profile…', avatar: null, title: "The project's profiles, in Settings",
    run: () => openSettings() }];
