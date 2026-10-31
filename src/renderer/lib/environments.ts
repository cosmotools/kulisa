// The built-in environments a human can open in the testing stage.
import { act, store } from './store';
import { profileLaunchers } from './profiles';
import type { StageTerminal } from '../../shared/stage-terminal';
import { refused, type Result } from '../../shared/result';
import type { MenuItem } from './menu';
// The next human input wins over a launch still waiting for its shell or font.
const cancelFocus = () => { if (store.getState().stageTerminalFocus) store.setState({ stageTerminalFocus: null }); };
document.addEventListener('pointerdown', cancelFocus, true);
document.addEventListener('keydown', cancelFocus, true);
window.addEventListener('blur', cancelFocus);
export async function focusStageTerminal(launch: () => Promise<Result<StageTerminal>>) {
  const request = { task: store.getState().current, key: null };
  store.setState({ stageTerminalFocus: request });
  try {
    const result = await launch();
    if (store.getState().stageTerminalFocus === request) {
      store.setState({ stageTerminalFocus: refused(result) || store.getState().current !== request.task ? null : { ...request, key: result.key } });
    }
    return result;
  } catch (error) {
    if (store.getState().stageTerminalFocus === request) cancelFocus();
    throw error;
  }
}
export const newStageTerminal = () => focusStageTerminal(() => act('stage-terminal:open', {}));
export const environmentItems = (): MenuItem[] => [
  { label: 'Stage Terminal', run: newStageTerminal },
  '-',
  ...profileLaunchers(store.getState().closedProfiles).map((p) => ({ label: p.name, avatar: p.avatar ?? undefined, run: p.run })),
];
