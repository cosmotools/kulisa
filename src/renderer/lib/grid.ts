// The task's outer workspace and nested testing stage (docs/window.md, The grid).
import type { DockviewApi, SerializedDockview } from 'dockview-react';
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
let preset: 'columns' | 'grid' = 'columns';
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
    if (api) kulisa.send('layout:save', { task, layout: { version: 2, workspace: api.toJSON(), stage: stage?.toJSON() ?? pendingStage, stageLayout: store.getState().stageLayout, stageOverflow: store.getState().stageOverflow } satisfies TaskLayout });
  };
  saveTimer = window.setTimeout(() => save?.(), 300);
}
function watch(a: DockviewApi) {
  a.onDidLayoutChange(changed);
  a.onDidActivePanelChange(scheduleLayout);
  a.onWillDragPanel(freeze); a.onWillDragGroup(freeze); a.onDidDrop(unfreeze);
}
export function gridMounted(a: DockviewApi) { api = a; watch(a); apiReady.resolve(a); }
export function gridUnmounted() {
  clearTimeout(saveTimer); save = null; api = stage = null;
  apiReady = Promise.withResolvers(); gridReady = null;
}
export function stageMounted(a: DockviewApi) {
  stage = a;
  const wasBuilding = building; building = true;
  restore(a, pendingStage, environmentIds()); pendingStage = null;
  if (!a.panels.length) arrangeStage(); else syncStage();
  building = wasBuilding;
  watch(a);
  a.onDidAddGroup(constrainStage); constrainStage(); changed();
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
  building = true; stage = null; a.clear();
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
    if (!api?.getPanel('stage')?.api.isVisible || !panel?.api.isVisible || !c?.isConnected || !c.checkVisibility() || !c.offsetWidth) { rects[p.id] = { shown: false }; continue; }
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
function constrainStage() {
  const { stageLayout: mode, stageOverflow: overflow } = store.getState();
  for (const group of stage?.groups ?? []) group.api.setConstraints({
    minimumWidth: overflow && mode !== 'tabs' && mode !== 'vertical' ? environmentMinimum.width : 0,
    minimumHeight: overflow && mode === 'vertical' ? environmentMinimum.height : 0,
  });
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
function syncGrid() {
  if (!api) return;
  const has = environmentIds().length > 0, panel = api.getPanel('stage');
  if (!has && panel) { pendingStage = null; stage = null; api.removePanel(panel); }
  if (has && !panel) {
    api.addPanel({ id: 'stage', component: 'stage', tabComponent: 'stage', title: 'Stage', renderer: 'always', position: { direction: preset === 'grid' ? 'left' : 'above' } });
    const outer = api;
    requestAnimationFrame(() => {
      if (api !== outer || !outer.getPanel('terminal')) return;
      outer.getPanel('terminal')!.group.api.setSize(preset === 'grid' ? { width: Math.round(outer.width * 0.35) } : { height: Math.round(outer.height * 0.35) });
      scheduleLayout();
    });
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
  preset = 'columns'; pendingStage = layout?.stage ?? null;
  store.setState({ stageLayout: layout?.stageLayout ?? null, stageOverflow: layout?.stageOverflow ?? false });
  restore(a, layout?.workspace ?? null, ['terminal', 'resources', 'stage']);
  if (!a.getPanel('terminal') || !a.getPanel('resources')) {
    a.clear();
    a.addPanel({ id: 'terminal', component: 'terminal', tabComponent: 'terminal', title: 'Terminal', renderer: 'always' });
    a.addPanel({ id: 'resources', component: 'resources', tabComponent: 'resources', title: 'Resources', minimumHeight: 36, position: { referencePanel: 'terminal', direction: 'right' } });
    a.getPanel('resources')!.group.api.setSize({ width: Math.round(a.width / 4) });
  }
  syncGrid();
}
async function restoreGrid() { const a = await apiReady.promise; building = true; buildGrid(a, await act('layout:load')); building = false; }
export function applyPreset(name: 'columns' | 'grid') {
  if (!api) return;
  building = true; preset = name; pendingStage = stage?.toJSON() ?? pendingStage; stage = null;
  // Processes and buffers belong to their environments, so rebuilding a layout never restarts an application.
  api.clear();
  api.addPanel({ id: 'terminal', component: 'terminal', tabComponent: 'terminal', title: 'Terminal', renderer: 'always' });
  api.addPanel({ id: 'resources', component: 'resources', tabComponent: 'resources', title: 'Resources', minimumHeight: 36,
    position: { referencePanel: 'terminal', direction: name === 'grid' ? 'below' : 'right' } });
  syncGrid();
  api.getPanel('resources')!.group.api.setSize(name === 'grid' ? { height: Math.round(api.height / 3) } : { width: Math.round(api.width / 4) });
  building = false; changed();
}
kulisa.on('stage:arrange', ({ task, layout, overflow }) => {
  if (task !== store.getState().current || !stage || !api?.getPanel('stage')) return;
  building = true;
  store.setState({ ...(layout !== undefined && { stageLayout: layout }), ...(overflow !== undefined && { stageOverflow: overflow }) });
  if (layout !== undefined) arrangeStage();
  constrainStage();
  building = false; changed();
});
export const dockApi = () => api;
export const stageApi = () => stage;

kulisa.on('grid:closing', (next) => {
  void closeLayers(); forgetFrozen(); clearTimeout(saveTimer); save?.();
  if (next) { replacing = true; return; }
  replacing = false; nextTerminals = nextApplications = null;
  store.setState({ loading: true }); stage = null; api?.clear();
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
export const showPane = (id: string) => { api?.getPanel('stage')?.api.setActive(); stage?.getPanel(panelId(id))?.api.setActive(); };
