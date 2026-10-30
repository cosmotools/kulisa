// The task's outer workspace and nested testing stage (docs/window.md, The grid).
import { Orientation } from 'dockview-react';
import type { DockviewApi, SerializedDockview, GridviewApi } from 'dockview-react';
import type { PageLayout } from '../../shared/ipc';
import type { Profile, Terminals } from '../../shared/types';
import type { ApplicationTerminal } from '../../shared/application-terminal';
import { act, setCaption, store } from './store';
import { forgetFrozen, freeze, showViews, unfreeze } from './views';
import { closeLayers } from './cover';
import { forgetTerminals } from '../../terminal/renderer';
import { environmentMinimum, splitLayout, type TaskLayout } from './stage-layout';

interface PaneHandle { content: HTMLElement; focusAddress(): void; newTab(): void; pick(): void }
export const panes = new Map<string, PaneHandle>();
const panelId = (id: string) => `profile:${id}`;
let api: DockviewApi | null = null, stage: DockviewApi | null = null;
let apiReady = Promise.withResolvers<DockviewApi>();
let gridReady: Promise<void> | null = null;
let pendingStage: SerializedDockview | null = null;
let workspace: GridviewApi | null = null;
let stageShare = 0.65;
let replacing = false, building = false, rebuilding: Promise<void> | null = null;
let nextTerminals: Terminals | null = null, nextApplications: ApplicationTerminal[] | null = null;
let saveTimer = 0, save: (() => void) | null = null;

function changed() {
  scheduleLayout();
  clearTimeout(saveTimer);
  if (!api || building || store.getState().loading) return;
  const task = store.getState().current;
  save = () => {
    save = null;
    if (api) kulisa.send('layout:save', { task, layout: { version: 3, workspace: api.toJSON(), stage: stage?.toJSON() ?? pendingStage, stageLayout: store.getState().stageLayout, stageOverflow: store.getState().stageOverflow, stagePosition: store.getState().stagePosition, stageShare: currentShare() } satisfies TaskLayout });
  };
  saveTimer = window.setTimeout(() => save?.(), 300);
}
function watch(a: DockviewApi) {
  a.onDidLayoutChange(changed);
  a.onDidActivePanelChange(scheduleLayout);
  a.onWillDragPanel(freeze); a.onWillDragGroup(freeze); a.onDidDrop(unfreeze);
}
function currentShare() {
  const panel = workspace?.getPanel('stage'), vertical = store.getState().stagePosition === 'above';
  const total = vertical ? workspace?.height : workspace?.width;
  return panel && total ? (vertical ? panel.api.height : panel.api.width) / total : stageShare;
}
export function workspaceMounted(a: GridviewApi) {
  workspace = a;
  a.onDidLayoutChange(() => { if (!building && !store.getState().loading) stageShare = currentShare(); changed(); });
  a.addPanel({ id: 'development', component: 'development', minimumWidth: 100, minimumHeight: 100 });
}
export function gridMounted(a: DockviewApi) { api = a; watch(a); apiReady.resolve(a); }
export function gridUnmounted() {
  clearTimeout(saveTimer); save = null; api = stage = null; workspace = null;
  apiReady = Promise.withResolvers(); gridReady = null;
}
export function stageMounted(a: DockviewApi) {
  stage = a;
  const wasBuilding = building; building = true;
  restore(a, pendingStage, environmentIds()); pendingStage = null;
  if (!a.panels.length) arrangeStage(); else syncStage();
  building = wasBuilding;
  watch(a);
  a.onDidAddGroup(() => constrainStage()); constrainStage(); changed();
  scheduleLayout();
}
export function stageUnmounted(a: DockviewApi | null) { if (stage === a) stage = null; }
document.addEventListener('dragend', unfreeze, true);
document.addEventListener('drop', () => setTimeout(unfreeze), true);

kulisa.on('state', async (s) => {
  if (replacing) {
    replacing = false;
    await (rebuilding = replaceGrid(s)); rebuilding = null; return;
  }
  if (rebuilding) await rebuilding;
  for (const p of s) if (!p.signinMode && store.getState().profiles.find((x) => x.id === p.id)?.signinMode) setCaption(p.id, '');
  store.setState({ profiles: s });
  const first = !gridReady;
  await (gridReady ??= restoreGrid());
  syncGrid(); scheduleLayout();
  if (first) reveal();
});
async function replaceGrid(s: Profile[]) {
  const a = await apiReady.promise, saved = await act('layout:load');
  building = true; removeStage(); a.clear();
  store.setState({ profiles: s, applications: nextApplications ?? [], pictures: {}, captions: {}, picking: {}, ...(nextTerminals && { terminals: nextTerminals }) });
  nextTerminals = nextApplications = null;
  buildGrid(a, saved); building = false; gridReady = Promise.resolve(); scheduleLayout(); reveal();
}
function reveal() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    store.setState({ loading: false }); void showViews();
  }));
}
let layoutFrame = 0;
export function scheduleLayout() { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(sendLayout); }
function sendLayout() {
  const rects: Record<string, PageLayout> = {};
  const viewport = document.querySelector('[data-stage-viewport]');
  const v = viewport?.getBoundingClientRect();
  for (const p of store.getState().profiles) {
    const panel = stage?.getPanel(panelId(p.id)), c = panes.get(p.id)?.content;
    if (!panel?.api.isVisible || !c?.isConnected || !c.checkVisibility() || !c.offsetWidth) { rects[p.id] = { shown: false }; continue; }
    const r = c.getBoundingClientRect();
    const x = Math.max(r.x, v?.x ?? r.x), y = Math.max(r.y, v?.y ?? r.y);
    const right = Math.min(r.right, v ? v.x + viewport!.clientWidth : r.right), bottom = Math.min(r.bottom, v ? v.y + viewport!.clientHeight : r.bottom);
    if (right <= x || bottom <= y) { rects[p.id] = { shown: false }; continue; }
    rects[p.id] = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height),
      ...(Math.round(x) > Math.round(r.x) || Math.round(y) > Math.round(r.y) || Math.round(right) < Math.round(r.right) || Math.round(bottom) < Math.round(r.bottom) ? { clip: { x: Math.round(x), y: Math.round(y), width: Math.round(right - x), height: Math.round(bottom - y) } } : {}) };
  }
  kulisa.send('layout', { task: store.getState().current, rects });
}
const environmentIds = () => [...store.getState().profiles.map((p) => panelId(p.id)), ...store.getState().applications.map((a) => `application:${a.id}`)];
function addEnvironment(id: string, reference?: string, direction: 'right' | 'below' | 'within' = 'right', inactive = false) {
  const profile = id.startsWith('profile:');
  stage!.addPanel({ id, component: profile ? 'profile' : 'application', tabComponent: profile ? 'profile' : 'application',
    title: profile ? store.getState().profiles.find((p) => panelId(p.id) === id)?.name : store.getState().applications.find((a) => `application:${a.id}` === id)?.name,
    ...(!profile && { renderer: 'always' as const }), ...(reference && { position: { referencePanel: reference, direction } }), inactive });
}
function constrainStage(mode = store.getState().stageLayout, overflow = store.getState().stageOverflow) {
  if (!stage) return;
  const scrolling = overflow && mode !== 'tabs';
  const minimumWidth = scrolling && mode !== 'vertical' ? environmentMinimum.width : 0;
  const minimumHeight = scrolling && mode === 'vertical' ? environmentMinimum.height : 0;
  const { width, height } = stage;
  // Dockview applies each group's constraints synchronously. Its canvas may still be smaller than the
  // scrolling DOM until ResizeObserver runs: give old and new minima room before changing any group.
  stage.layout(Math.max(width, stage.minimumWidth, minimumWidth * stage.groups.length),
    Math.max(height, stage.minimumHeight, minimumHeight * stage.groups.length), true);
  for (const group of stage.groups) group.api.setConstraints({ minimumWidth, minimumHeight });
  stage.layout(width, height, true);
}

function arrangeStage() {
  if (!stage) return;
  stage.clear();
  const ids = environmentIds();
  const mode = store.getState().stageLayout;
  ids.forEach((id, i) => addEnvironment(id, i ? ids[i - 1] : undefined, mode === 'tabs' ? 'within' : mode === 'vertical' ? 'below' : 'right', mode === 'tabs' && i > 0));
}
function syncStage() {
  if (!stage) return;
  const ids = environmentIds();
  for (const p of stage.panels) if (!ids.includes(p.id)) stage.removePanel(p);
  for (const id of ids) if (!stage.getPanel(id)) {
    const mode = store.getState().stageLayout;
    addEnvironment(id, stage.panels.at(-1)?.id, mode === 'tabs' ? 'within' : mode === 'vertical' ? 'below' : 'right');
  }
}
function removeStage() {
  const panel = workspace?.getPanel('stage');
  stage = null; pendingStage = null;
  if (panel) workspace!.removePanel(panel);
}
function placeStage() {
  if (!workspace) return;
  const { stagePosition: position } = store.getState();
  const panel = workspace.getPanel('stage');
  if (!panel) return;
  workspace.orientation = position === 'above' ? Orientation.VERTICAL : Orientation.HORIZONTAL;
  const root = workspace.toJSON().grid.root;
  const firstPanel = (node: typeof root): string => Array.isArray(node.data) ? firstPanel(node.data[0]!) : node.data.id;
  const first = firstPanel(root);
  const wanted = position === 'right' ? 'development' : 'stage';
  if (first !== wanted) {
    // Moving the later panel keeps its reference's grid location stable through removal.
    workspace.movePanel(workspace.getPanel(wanted)!, { reference: first, direction: position === 'above' ? 'above' : 'left' });
  }
  panel.api.setSize(position === 'above' ? { height: Math.round(workspace.height * stageShare) } : { width: Math.round(workspace.width * stageShare) });
  scheduleLayout();
}
function syncGrid() {
  if (!workspace) return;
  const has = environmentIds().length > 0, panel = workspace.getPanel('stage');
  if (!has && panel) removeStage();
  if (has && !panel) {
    const wasBuilding = building; building = true;
    workspace.addPanel({ id: 'stage', component: 'stage', minimumWidth: 100, minimumHeight: 100 });
    placeStage();
    building = wasBuilding;
  }
  syncStage();
}
function restore(a: DockviewApi, saved: SerializedDockview | null, known: string[]) {
  if (!saved) return;
  try {
    if (!Object.keys(saved.panels).every((id) => known.includes(id))) return;
    a.fromJSON(saved);
  } catch (e) { console.warn('[layout] saved grid not restored:', (e as Error).message); a.clear(); }
}
function buildGrid(a: DockviewApi, saved: unknown) {
  const layout = splitLayout(saved);
  stageShare = layout?.stageShare && layout.stageShare > 0 && layout.stageShare < 1 ? layout.stageShare : 0.65;
  pendingStage = layout?.stage ?? null;
  store.setState({ stageLayout: layout?.stageLayout ?? null, stageOverflow: layout?.stageOverflow ?? false, stagePosition: layout?.stagePosition ?? 'above' });
  placeStage();
  restore(a, layout?.workspace ?? null, ['terminal', 'resources']);
  if (!a.getPanel('terminal') || !a.getPanel('resources')) {
    a.clear();
    a.addPanel({ id: 'terminal', component: 'terminal', tabComponent: 'terminal', title: 'Terminal', renderer: 'always' });
    a.addPanel({ id: 'resources', component: 'resources', tabComponent: 'resources', title: 'Resources', minimumHeight: 36, position: { referencePanel: 'terminal', direction: 'right' } });
    a.getPanel('resources')!.group.api.setSize({ width: Math.round(a.width / 4) });
  }
  syncGrid();
}
async function restoreGrid() { const a = await apiReady.promise; building = true; buildGrid(a, await act('layout:load')); building = false; }
kulisa.on('stage:arrange', ({ task, layout, overflow, position }) => {
  if (task !== store.getState().current) return;
  building = true;
  // React can shrink the scroll container synchronously on store.setState.
  constrainStage(layout ?? store.getState().stageLayout, overflow ?? store.getState().stageOverflow);
  store.setState({ ...(position !== undefined && { stagePosition: position }), ...(layout !== undefined && { stageLayout: layout }), ...(overflow !== undefined && { stageOverflow: overflow }) });
  if (position !== undefined) placeStage();
  if (layout !== undefined) arrangeStage();
  building = false; changed();
});
export const dockApi = () => api;
export const stageApi = () => stage;

kulisa.on('grid:closing', (next) => {
  void closeLayers(); forgetFrozen(); clearTimeout(saveTimer); save?.();
  if (next) { replacing = true; return; }
  replacing = false; nextTerminals = nextApplications = null;
  store.setState({ loading: true }); removeStage(); api?.clear();
  store.setState({ profiles: [], applications: [], pictures: {}, captions: {}, picking: {}, terminals: { front: null, list: [] } });
  gridReady = null;
});
kulisa.on('tasks:closed', forgetTerminals);
kulisa.on('terminals', (t) => {
  if (t.task !== store.getState().current) return;
  if (replacing || rebuilding) nextTerminals = t; else store.setState({ terminals: t });
});
kulisa.on('applications', (t) => {
  if (t.task !== store.getState().current) return;
  if (replacing || rebuilding) nextApplications = t.list;
  else { store.setState({ applications: t.list }); if (gridReady) void gridReady.then(syncGrid); }
});
kulisa.on('terminals:gone', forgetTerminals);
export const showPane = (id: string) => { stage?.getPanel(panelId(id))?.api.setActive(); };
