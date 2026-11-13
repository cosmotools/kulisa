// Human launch intent for the terminal pane (../README.md, Pane registration).
import { currentTask, store } from './state';
import { actionsFor } from '../../window-client/renderer';
import type { StageTerminal } from '../../shared/stage-terminal';
import { refused, type Result } from '../../shared/result';
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
