// Task grids retained by their open TaskViews; window controls address the selected one.
import { store } from '../lib/store';
import { taskStore } from './state';
import type { TaskGrid } from './grid';
import { closeLayers } from '../lib/cover';
import { forgetFrozen } from './views';
import { forgetTerminals } from '../../terminal/renderer';
import { panelId } from './layout';
const grids = new Map<string, TaskGrid>();
export function registerTaskGrid(grid: TaskGrid) {
  grids.set(grid.key, grid);
  return () => { grids.delete(grid.key); grid.dispose(); };
}
export const taskGrid = (task: string | null) => grids.get(task ?? '');
const current = () => taskGrid(store.getState().current);
export const pane = (id: string) => current()?.panes.get(id);
export const dockApi = () => current()?.development.api ?? null;
export const stageApi = () => current()?.stage.api ?? null;
export const showPane = (task: string, id: string) => taskGrid(task)?.stage.api?.getPanel(panelId(id))?.api.setActive();
export async function setStageFollowing(follow: boolean) {
  await kulisa.invoke('stage:follow:set', follow);
  taskStore().setState({ stageFollowPaused: false });
  if (follow) current()?.stage.follow();
}
kulisa.on('page:press', ({ task }) => {
  if (task === store.getState().current) for (const profile of taskStore().getState().profiles) pane(profile.id)?.cancelAddress();
});
kulisa.on('stage:arrange', (event) => { void grids.get(event.task)?.arrange(event); });
store.subscribe((next, previous) => {
  if (previous.current && next.current !== previous.current) {
    grids.get(previous.current)?.deactivate();
    void closeLayers(); forgetFrozen();
  }
});
kulisa.on('stage:activity', ({ task, environment }) => { if (task === store.getState().current) grids.get(task)?.stage.environmentActivity(environment); });
kulisa.on('agent:caption', ({ task, profile, caption }) => { if (caption && task === store.getState().current) grids.get(task)?.stage.environmentActivity(panelId(profile)); });
kulisa.on('stage:follow:state', (stageFollow) => {
  store.setState({ stageFollow }); taskStore().setState({ stageFollowPaused: false });
  if (stageFollow) current()?.stage.follow();
});
kulisa.on('task:closed', forgetTerminals);
kulisa.on('terminal:gone', forgetTerminals);
document.addEventListener('dragend', () => current()?.finishDrag(), true);
document.addEventListener('drop', () => setTimeout(() => current()?.finishDrag()), true);
