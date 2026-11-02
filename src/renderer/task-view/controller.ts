// Task grids retained by their open TaskViews; window controls address the selected one.
import type { DockviewPanelApi } from 'dockview-react';
import { store } from '../lib/store';
import { tasks, taskStore } from './state';
import type { TaskGrid } from './grid';
import { closeLayers } from '../lib/cover';
import { forgetFrozen, onLivePages } from './views';
import { forgetTerminals } from '../../terminal/renderer';
import { panelId } from './layout';
import type { ResourceParams } from './development';
import { panes } from './pages';
export { panes };
const grids = new Map<string, TaskGrid>();
export function registerTaskGrid(grid: TaskGrid) {
  grids.set(grid.key, grid);
  return () => { grids.delete(grid.key); grid.dispose(); };
}
const current = () => grids.get(store.getState().current ?? '');
const scheduleLayout = () => current()?.scheduleLayout();
onLivePages(scheduleLayout);
export const dockApi = () => current()?.development.api ?? null;
export const stageApi = () => current()?.stage.api ?? null;
export const developmentScreen = () => current()?.development.screen() ?? 'agents';
export const showDevelopmentAgents = () => current()?.development.showAgents();
export const selectResource = (panel: DockviewPanelApi, params: ResourceParams, section: NonNullable<ResourceParams['section']>) => current()?.development.selectResource(panel, params, section);
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
  const state = tasks.getState()[task];
  if (!state) return;
  state.setState({ profiles: list }); grids.get(task)?.update();
});
kulisa.on('development-terminal:state', (developmentTerminals) => {
  tasks.getState()[developmentTerminals.task ?? '']?.setState({ developmentTerminals });
  grids.get(developmentTerminals.task ?? '')?.update();
});
kulisa.on('stage-terminal:state', ({ task, list }) => {
  tasks.getState()[task]?.setState({ stageTerminals: list }); grids.get(task)?.update();
});
kulisa.on('stage:arrange', (event) => grids.get(event.task)?.arrange(event));
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
