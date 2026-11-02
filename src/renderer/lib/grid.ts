// The window's grid handles and IPC dispatch (docs/window.md, The grid).
import type { DockviewApi, DockviewPanelApi, GridviewApi, GridviewPanelApi } from 'dockview-react';
import { store, type DevelopmentDiff } from './store';
import { forgetFrozen, freeze, onLivePages, revealGrid, unfreeze } from './views';
import { closeLayers } from './cover';
import { forgetTerminals } from '../../terminal/renderer';
import { WindowGrid } from './grid/controller';
import { panelId } from './grid/layout';
import type { ResourceParams } from './grid/development';
export type { ResourceParams } from './grid/development';
export { panes } from './grid/pages';

const grid = new WindowGrid({ freeze, unfreeze, forgetFrozen, revealGrid, closeLayers });
onLivePages(grid.scheduleLayout);
export const scheduleLayout = grid.scheduleLayout;
export const workspaceMounted = (api: GridviewApi, element: HTMLElement) => grid.mount(api, element);
export const gridMounted = (api: DockviewApi, parent: GridviewPanelApi) => grid.mountDevelopment(api, parent);
export const gridUnmounted = grid.dispose;
export const stageMounted = (api: DockviewApi, parent: GridviewPanelApi, viewport: HTMLElement) => grid.mountStage(api, parent, viewport);
export const stageUnmounted = (api: DockviewApi | null) => grid.unmountStage(api);
export const dockApi = () => grid.development.api;
export const stageApi = () => grid.stage.api;
export const developmentScreen = grid.development.screen;
export const showDevelopmentAgents = grid.development.showAgents;
export const showDevelopmentDiff = (selection: DevelopmentDiff, activate = true) => grid.development.showDiff(selection, activate);
export const selectDevelopmentFile = grid.development.selectDevelopmentFile;
export const selectResource = (panel: DockviewPanelApi, params: ResourceParams, section: NonNullable<ResourceParams['section']>) => grid.development.selectResource(panel, params, section);
export const startResourceDrag = (panel: DockviewPanelApi, event: DragEvent) => grid.startResourceDrag(panel, event);
export const pauseStageFollowing = grid.stage.pauseStageFollowing;
export const showPane = (id: string) => grid.stage.api?.getPanel(panelId(id))?.api.setActive();
export async function setStageFollowing(follow: boolean) {
  const task = store.getState().current;
  await kulisa.invoke('stage:follow:set', follow);
  if (task !== store.getState().current) return;
  store.setState({ stageFollowPaused: false });
  if (follow) grid.stage.follow();
}

// Window-lifetime handlers dispatch to the mounted grid; its APIs and deferred work have shorter lifetimes.
kulisa.on('profile:state', (profiles) => { void grid.profiles(profiles); });
kulisa.on('grid:closing', (next) => grid.leave(next));
kulisa.on('development-terminal:state', (state) => grid.terminals(state));
kulisa.on('stage-terminal:state', (state) => grid.environments(state));
kulisa.on('stage:arrange', (state) => grid.arrange(state));
kulisa.on('stage:activity', ({ task, environment }) => grid.activity(task, environment));
kulisa.on('agent:caption', ({ task, profile, caption }) => { if (caption) grid.activity(task, panelId(profile)); });
kulisa.on('stage:follow:state', (follow) => {
  store.setState({ stageFollow: follow, stageFollowPaused: false });
  if (follow) grid.stage.follow();
});
kulisa.on('task:closed', forgetTerminals);
kulisa.on('terminal:gone', forgetTerminals);
