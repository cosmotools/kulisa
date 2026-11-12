// The built-in environments a human can open in the testing stage.
import { store, actionsFor } from './state';
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
  const owner = store, request = { key: null };
  owner.setState({ stageTerminalFocus: request });
  try {
    const result = await launch();
    if (owner.getState().stageTerminalFocus === request) {
      owner.setState({ stageTerminalFocus: refused(result) || store.getState().current !== task ? null : { key: result.key } });
    }
    return result;
  } catch (error) {
    if (owner.getState().stageTerminalFocus === request) owner.setState({ stageTerminalFocus: null });
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
