// Task grids retained by their open TaskViews; window controls address the selected one.
import type { DockviewPanelApi } from 'dockview-react';
import { store, taskStore, type TaskStore, type DevelopmentDiff } from './store';
import { TaskGrid } from './grid/task-grid';
import { closeLayers } from './cover';
import { forgetFrozen, freeze, onLivePages, revealGrid, unfreeze } from './views';
import { forgetTerminals } from '../../terminal/renderer';
import { panelId } from './grid/layout';
import type { ResourceParams } from './grid/development';
export type { ResourceParams } from './grid/development';
import { panes } from './grid/pages';
export { panes };
const grids = new Map<string, TaskGrid>();
export function createTaskGrid(state: TaskStore) {
  const grid = new TaskGrid(state, { freeze, unfreeze, reveal: revealGrid });
  return grid;
}
export function registerTaskGrid(grid: TaskGrid) { grids.set(grid.key, grid); }
export function disposeTaskGrid(grid: TaskGrid) {
  grid.dispose();
  if (grids.get(grid.key) === grid) grids.delete(grid.key);
}
const current = () => grids.get(store.getState().current ?? '');
export const scheduleLayout = () => current()?.scheduleLayout();
onLivePages(scheduleLayout);
export const dockApi = () => current()?.development.api ?? null;
export const stageApi = () => current()?.stage.api ?? null;
export const developmentScreen = () => current()?.development.screen() ?? 'agents';
export const showDevelopmentAgents = () => current()?.development.showAgents();
export const showDevelopmentDiff = (selection: DevelopmentDiff, activate = true) => grids.get(selection.task)?.development.showDiff(selection, activate);
export const selectDevelopmentFile = (task: string, path: string, navigation: number | undefined) => grids.get(task)?.development.selectDevelopmentFile(path, navigation);
export const selectResource = (panel: DockviewPanelApi, params: ResourceParams, section: NonNullable<ResourceParams['section']>) => current()?.development.selectResource(panel, params, section);
export const startResourceDrag = (panel: DockviewPanelApi, event: DragEvent) => current()?.startResourceDrag(panel, event);
export const showPane = (id: string) => current()?.stage.api?.getPanel(panelId(id))?.api.setActive();
export async function setStageFollowing(follow: boolean) {
  await kulisa.invoke('stage:follow:set', follow);
  taskStore().setState({ stageFollowPaused: false });
  if (follow) current()?.stage.follow();
}
kulisa.on('page:press', ({ task }) => {
  if (task === store.getState().current) for (const profile of taskStore().getState().profiles) panes.get(profile.id)?.cancelAddress();
});
kulisa.on('profile:state', ({ task, list }) => {
  const state = store.getState().tasks[task];
  if (!state) return;
  state.setState({ profiles: list }); grids.get(task)?.update();
});
kulisa.on('development-terminal:state', (developmentTerminals) => {
  store.getState().tasks[developmentTerminals.task ?? '']?.setState({ developmentTerminals });
  grids.get(developmentTerminals.task ?? '')?.update();
});
kulisa.on('stage-terminal:state', ({ task, list }) => {
  store.getState().tasks[task]?.setState({ stageTerminals: list }); grids.get(task)?.update();
});
kulisa.on('stage:arrange', (event) => grids.get(event.task)?.arrange(event));
kulisa.on('task:deactivated', (task) => {
  grids.get(task)?.deactivate();
  if (task === store.getState().current) { void closeLayers(); forgetFrozen(); }
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
