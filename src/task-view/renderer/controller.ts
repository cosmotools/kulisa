// One committed task grid per immutable task UI; scoped events address that grid (docs/window.md).
import { store, currentTask } from './state';
import type { TaskGrid } from './grid';
import { closeLayers } from '../../layers/renderer';
import { forgetFrozen } from './views';
import { forgetTerminals } from '../../terminal/renderer';
import { stagePaneKinds } from './stage-panes';
import type { PaneHost } from '../../shared/stage-pane';
let attached: TaskGrid | null = null;
export function registerTaskGrid(grid: TaskGrid) {
  grid.connect();
  attached = grid;
  return () => { if (attached === grid) attached = null; grid.dispose(); };
}
export const taskGrid = (task: string | null) => attached?.key === task ? attached : undefined;
const current = () => taskGrid(currentTask());
const paneHost: PaneHost = {
  show: (panel) => current()?.stage.api?.getPanel(panel)?.api.setActive(),
  reportLayout: () => current()?.reportPages(),
  activity: (task, panel) => { if (task === currentTask()) taskGrid(task)?.stage.paneActivity(panel); },
};
for (const definition of stagePaneKinds) definition.bind?.(paneHost);
kulisa.on('task:command', (event) => {
  for (const definition of stagePaneKinds) if (definition.command?.(event)) break;
});
kulisa.on('task:dismiss', () => {
  void closeLayers('menus');
  if (current()) for (const definition of stagePaneKinds) definition.dismiss?.();
});
export const dockApi = () => current()?.development.api ?? null;
export const stageApi = () => current()?.stage.api ?? null;
kulisa.on('stage:arrange', (event) => { void taskGrid(event.task)?.arrange(event); });
store.subscribe((next, previous) => {
  if (previous.active && !next.active) {
    taskGrid(previous.key)?.deactivate();
    void closeLayers(); forgetFrozen();
  }
});
kulisa.on('stage:activity', ({ task, pane }) => { if (task === currentTask()) taskGrid(task)?.stage.paneActivity(pane); });
kulisa.on('stage:follow:state', (stageFollow) => {
  store.setState({ stageFollowPaused: false });
  if (stageFollow) current()?.stage.follow();
});
kulisa.on('task:editor:state', ({ task, state }) => taskGrid(task)?.development.receiveEditor(state));
kulisa.on('task:artifact:selected', ({ task, file }) => {
  if (task === currentTask()) taskGrid(task)?.development.showArtifact(file);
});
kulisa.on('terminal:gone', forgetTerminals);
document.addEventListener('dragend', () => current()?.finishDrag(), true);
document.addEventListener('drop', () => setTimeout(() => current()?.finishDrag()), true);

store.subscribe((next, previous) => {
  if (next.covered && !previous.covered) {
    void closeLayers('menus'); forgetFrozen();
    for (const definition of stagePaneKinds) definition.reset?.();
    store.setState({ developmentTerminalFocus: null, pictures: {} });
  }
});
