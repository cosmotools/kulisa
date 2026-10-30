// The built-in environments a human can open in the testing stage.
import { act, store } from './store';
import { profileLaunchers } from './profiles';
import type { MenuItem } from './menu';
export const newApplication = () => act('application:create', {});
export const environmentItems = (): MenuItem[] => [
  { label: 'Application Terminal', run: newApplication },
  '-',
  ...profileLaunchers(store.getState().closedProfiles).map((p) => ({ label: p.name, avatar: p.avatar ?? undefined, run: p.run })),
];
