// The browser environments available in the testing stage.
import { store } from './store';
import { profileLaunchers } from './profiles';
import type { MenuItem } from './menu';
export const environmentItems = (): MenuItem[] => profileLaunchers(store.getState().closedProfiles)
  .map((p) => ({ label: p.name, avatar: p.avatar ?? undefined, run: p.run }));
