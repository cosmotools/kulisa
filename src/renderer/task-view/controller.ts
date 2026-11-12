// One committed task grid per immutable task UI; scoped events address that grid (docs/window.md).
import { store } from '../lib/store';
import { taskStore } from './state';
import type { TaskGrid } from './grid';
import { closeLayers } from '../lib/cover';
import { forgetFrozen } from './views';
import { forgetTerminals } from '../../terminal/renderer';
import { panelId } from './layout';
let attached: TaskGrid | null = null;
export function registerTaskGrid(grid: TaskGrid) {
  grid.connect();
  attached = grid;
  return () => { if (attached === grid) attached = null; grid.dispose(); };
}
export const taskGrid = (task: string | null) => attached?.key === task ? attached : undefined;
const current = () => taskGrid(store.getState().current);
kulisa.on('task:dismiss', () => {
  void closeLayers('menus');
  for (const pane of current()?.panes.values() ?? []) pane.cancelAddress();
});
export const pane = (id: string) => current()?.panes.get(id);
export const dockApi = () => current()?.development.api ?? null;
export const stageApi = () => current()?.stage.api ?? null;
kulisa.on('page:press', ({ task }) => {
  if (task === store.getState().current) for (const profile of taskStore().getState().profiles) pane(profile.id)?.cancelAddress();
});
kulisa.on('stage:arrange', (event) => { void taskGrid(event.task)?.arrange(event); });
store.subscribe((next, previous) => {
  if (previous.current && next.current !== previous.current) {
    taskGrid(previous.current)?.deactivate();
    void closeLayers(); forgetFrozen();
  }
});
kulisa.on('stage:activity', ({ task, environment }) => { if (task === store.getState().current) taskGrid(task)?.stage.environmentActivity(environment); });
kulisa.on('agent:caption', ({ task, profile, caption }) => { if (caption && task === store.getState().current) taskGrid(task)?.stage.environmentActivity(panelId(profile)); });
kulisa.on('stage:follow:state', (stageFollow) => {
  taskStore().setState({ stageFollowPaused: false });
  if (stageFollow) current()?.stage.follow();
});
kulisa.on('task:closed', forgetTerminals);
kulisa.on('task:editor:state', ({ task, state }) => taskGrid(task)?.development.receiveEditor(state));
kulisa.on('task:artifact:selected', ({ task, file }) => {
  if (task === store.getState().current) taskGrid(task)?.development.showArtifact(file);
});
kulisa.on('terminal:gone', forgetTerminals);
document.addEventListener('dragend', () => current()?.finishDrag(), true);
document.addEventListener('drop', () => setTimeout(() => current()?.finishDrag()), true);

store.subscribe((next, previous) => {
  if (next.covered && !previous.covered) {
    void closeLayers('menus'); forgetFrozen();
    taskStore().setState({ developmentTerminalFocus: null, stageTerminalFocus: null, pictures: {}, picking: {}, captions: {} });
  }
});
