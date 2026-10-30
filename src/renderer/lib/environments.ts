// The built-in environments a human can open in the testing stage.
import { act, store } from './store';
import { profileLaunchers } from './profiles';
import type { ApplicationTerminal } from '../../shared/application-terminal';
import { refused, type Result } from '../../shared/result';
import type { MenuItem } from './menu';
// The next human input wins over a launch still waiting for its shell or font.
const cancelFocus = () => { if (store.getState().applicationFocus) store.setState({ applicationFocus: null }); };
document.addEventListener('pointerdown', cancelFocus, true);
document.addEventListener('keydown', cancelFocus, true);
window.addEventListener('blur', cancelFocus);
export async function focusApplication(launch: () => Promise<Result<ApplicationTerminal>>) {
  const request = { task: store.getState().current, key: null };
  store.setState({ applicationFocus: request });
  try {
    const result = await launch();
    if (store.getState().applicationFocus === request) {
      store.setState({ applicationFocus: refused(result) || store.getState().current !== request.task ? null : { ...request, key: result.key } });
    }
    return result;
  } catch (error) {
    if (store.getState().applicationFocus === request) cancelFocus();
    throw error;
  }
}
export const newApplication = () => focusApplication(() => act('application:open', {}));
export const environmentItems = (): MenuItem[] => [
  { label: 'Application Terminal', run: newApplication },
  '-',
  ...profileLaunchers(store.getState().closedProfiles).map((p) => ({ label: p.name, avatar: p.avatar ?? undefined, run: p.run })),
];
