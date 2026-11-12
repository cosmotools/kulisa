// The built-in environments a human can open in the testing stage.
import { currentTask, store } from './state';
import { actionsFor } from '../../window-client/renderer';
import { profileLaunchers } from './profiles';
import type { StageTerminal } from '../../shared/stage-terminal';
import { refused, type Result } from '../../shared/result';
import type { MenuItem } from '../../menus/renderer';
// The next human input wins over a launch still waiting for its shell or font.
const cancelFocus = () => { if (store.getState().stageTerminalFocus) store.setState({ stageTerminalFocus: null }); };
document.addEventListener('pointerdown', cancelFocus, true);
document.addEventListener('keydown', cancelFocus, true);
window.addEventListener('blur', cancelFocus);
export async function focusStageTerminal(task: string, launch: () => Promise<Result<StageTerminal>>) {
  const request = { key: null };
  store.setState({ stageTerminalFocus: request });
  try {
    const result = await launch();
    if (store.getState().stageTerminalFocus === request) {
      store.setState({ stageTerminalFocus: refused(result) || currentTask() !== task ? null : { key: result.key } });
    }
    return result;
  } catch (error) {
    if (store.getState().stageTerminalFocus === request) store.setState({ stageTerminalFocus: null });
    throw error;
  }
}
export const newStageTerminal = (task: string) => focusStageTerminal(task, () => actionsFor(task)('stage-terminal:open', {}));
export const environmentItems = (): MenuItem[] => {
  const { key, closedProfiles } = store.getState();
  return [
    { label: 'Stage Terminal', run: () => newStageTerminal(key) },
    '-',
    ...profileLaunchers(key, closedProfiles).map((p) => ({ label: p.name, avatar: p.avatar ?? undefined, run: p.run })),
  ];
};
