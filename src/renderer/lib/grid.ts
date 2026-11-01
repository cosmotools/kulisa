// The task's outer workspace and nested testing stage (docs/window.md, The grid).
import { Orientation, LocalSelectionTransfer, PanelTransfer } from 'dockview-react';
import type { DockviewApi, DockviewPanelApi, SerializedDockview, GridviewApi } from 'dockview-react';
import type { PageLayout } from '../../shared/ipc';
import type { Profile, DevelopmentTerminalsState } from '../../shared/types';
import type { StageTerminal } from '../../shared/stage-terminal';
import { act, setCaption, store } from './store';
import { forgetFrozen, freeze, showViews, unfreeze } from './views';
import { closeLayers } from './cover';
import { dockTheme } from './dock-theme';
import { forgetTerminals } from '../../terminal/renderer';
import { environmentMinimum, filterLayout, splitLayout, type TaskLayout } from '../../shared/stage-layout';

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
let nextDevelopmentTerminals: DevelopmentTerminalsState | null = null, nextStageTerminals: StageTerminal[] | null = null;
let saveTimer = 0, save: (() => void) | null = null;

let resourceDragging = false;

export function startResourceDrag(panel: DockviewPanelApi, event: DragEvent) {
  if (!api || !event.dataTransfer) { event.preventDefault(); return; }
  // The headerless Resources bar is a Dockview drag source through its public transfer contract.
  LocalSelectionTransfer.getInstance<PanelTransfer>().setData([new PanelTransfer(api.id, panel.group.id, panel.id)], PanelTransfer.prototype);
  resourceDragging = true;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', '');
  void freeze();
}
function finishResourceDrag() {
  if (!resourceDragging) return;
  resourceDragging = false;
  LocalSelectionTransfer.getInstance<PanelTransfer>().clearData(PanelTransfer.prototype);
}

export interface ResourceParams { section?: 'project' | 'artifacts' | 'terminals' | null; expandedWidth?: number; expandedHeight?: number }
const resourceMinimumWidth = 300, resourceRailWidth = 40, resourceBarHeight = 172;
let developmentGap = dockTheme.gap ?? 0;

export function selectResource(panel: DockviewPanelApi, params: ResourceParams, section: NonNullable<ResourceParams['section']>) {
  const current = params.section === undefined ? 'project' : params.section;
  const next = current === section ? null : section;
  const inset = developmentInsets().get(panel.group.id);
  const expandedWidth = current && !inset?.vertical ? panel.width : params.expandedWidth;
  const expandedHeight = current && inset?.vertical ? panel.height : params.expandedHeight;
  const updated = { section: next, expandedWidth, expandedHeight };
  panel.updateParameters(updated);
  constrainDevelopment();
  if (!current || !next) sizeResources(panel, updated);
  changed();
}
function sizeResources(panel: DockviewPanelApi, params: ResourceParams) {
  // A shared tab group keeps the room its other panels need.
  if (panel.group.panels.length !== 1) return;
  const inset = developmentInsets().get(panel.group.id) ?? { width: 0, height: 0, vertical: false };
  const open = params.section !== null;
  if (inset.vertical) panel.setSize({ height: (open ? params.expandedHeight ?? api!.height / 2 : resourceBarHeight) + inset.height });
  else panel.setSize({ width: (open ? Math.max(resourceMinimumWidth, params.expandedWidth ?? resourceMinimumWidth) : resourceRailWidth) + inset.width });
}

// Dockview subtracts each split's share of the theme gap after applying its constraints and requested size.
function developmentInsets() {
  const insets = new Map<string, { width: number; height: number; vertical: boolean }>(), grid = api?.toJSON().grid;
  if (!grid) return insets;
  function visit(node: SerializedDockview['grid']['root'], horizontal: boolean, inset: { width: number; height: number; vertical: boolean }) {
    if (!Array.isArray(node.data)) { insets.set(node.data.id, inset); return; }
    const share = developmentGap * (node.data.length - 1) / node.data.length;
    const next = { ...inset, [horizontal ? 'width' : 'height']: share, vertical: !horizontal };
    node.data.forEach((child) => visit(child, !horizontal, next));
  }
  visit(grid.root, grid.orientation === Orientation.HORIZONTAL, { width: 0, height: 0, vertical: false });
  return insets;
}

let terminalFold: { group: DockviewApi['groups'][number]; vertical: boolean; size: number } | null = null;
function restoreTerminalSize() {
  const before = terminalFold; terminalFold = null;
  if (!before || !api?.groups.includes(before.group)) return;
  before.group.api.setConstraints({ minimumWidth: 0, maximumWidth: Infinity, minimumHeight: 0, maximumHeight: Infinity });
  before.group.api.setSize(before.vertical ? { height: Math.max(before.size, 150) } : { width: Math.max(before.size, 200) });
}

// Groups own constraints: Resources and terminal folding share one policy so neither can override the other.
function constrainDevelopment() {
  const resources = api?.getPanel('resources'), terminal = api?.getPanel('terminal');
  const gap = resources?.params?.section === null && resources.group.panels.length === 1 ? 0 : dockTheme.gap ?? 0;
  if (developmentGap !== gap) {
    developmentGap = gap;
    api?.updateOptions({ theme: { ...dockTheme, gap } });
  }
  if (terminalFold && terminalFold.group !== terminal?.group) restoreTerminalSize();
  const insets = developmentInsets();
  const state = store.getState(), emptyTerminal = !state.developmentTerminals.list.length;
  let constrained = false;
  for (const group of api?.groups ?? []) {
    const resource = group.panels.some((p) => p.id === 'resources');
    const hasTerminal = group.panels.some((p) => p.id === 'terminal');
    const standalone = group.panels.length === 1;
    const hiddenHeader = standalone && (resource || hasTerminal);
    if (group.header.hidden !== hiddenHeader) group.header.hidden = hiddenHeader;
    const inset = insets.get(group.id) ?? { width: 0, height: 0, vertical: false };
    const closed = resource && resources?.params?.section === null;
    const fixedWidth = standalone && closed && !inset.vertical;
    const fixedHeight = standalone && closed && inset.vertical;
    const foldTerminal = standalone && hasTerminal && emptyTerminal && state.profiles.length > 0;
    const previous = terminalFold?.group === group ? terminalFold : null;
    if (previous && (!foldTerminal || previous.vertical !== inset.vertical)) {
      restoreTerminalSize();
      // An axis change needs the restored layout before measuring the terminal's new expanded size.
      if (foldTerminal) { scheduleLayout(); continue; }
    }
    const beginFold = foldTerminal && !terminalFold;
    if (beginFold) terminalFold = { group, vertical: inset.vertical, size: inset.vertical ? group.api.height : group.api.width };
    const foldedWidth = foldTerminal && !inset.vertical, foldedHeight = foldTerminal && inset.vertical;
    const minimumWidth = foldedWidth ? 36 : resource ? (closed ? standalone ? resourceRailWidth : 100 : resourceMinimumWidth) + inset.width : 100;
    const minimumHeight = foldedHeight ? 36 : resource ? resourceBarHeight + (standalone ? 0 : 36) + inset.height : 100;
    const maximumWidth = fixedWidth || foldedWidth ? minimumWidth : Infinity;
    const maximumHeight = fixedHeight || foldedHeight ? minimumHeight : Infinity;
    if (group.minimumWidth !== minimumWidth || group.maximumWidth !== maximumWidth || group.minimumHeight !== minimumHeight || group.maximumHeight !== maximumHeight) {
      group.api.setConstraints({ minimumWidth, maximumWidth, minimumHeight, maximumHeight });
      constrained = true;
    }
    if (beginFold) group.api.setSize(inset.vertical ? { height: 36 } : { width: 36 });
  }
  // Dockview publishes a constraint change before storing its explicit group limits.
  if (constrained && api) api.layout(api.width, api.height, true);
}

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
  // Container resizes reach nested grids after the outer layout event and do not emit it themselves.
  const resized = (group: DockviewApi['groups'][number]) => { group.api.onDidDimensionsChange(changed); };
  a.groups.forEach(resized); a.onDidAddGroup(resized);
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
export function gridMounted(a: DockviewApi) { api = a; developmentGap = dockTheme.gap ?? 0; watch(a); apiReady.resolve(a); }
export function gridUnmounted() {
  finishResourceDrag(); terminalFold = null;
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
  a.onDidActivePanelChange(({ origin }) => { if (origin === 'user') pauseStageFollowing(); });
  a.onDidMaximizedGroupChange(() => { constrainStage(); scheduleLayout(); });
  a.onDidAddGroup(() => constrainStage()); constrainStage(); changed();
  scheduleLayout();
}
export function stageUnmounted(a: DockviewApi | null) { if (stage === a) stage = null; }
document.addEventListener('dragend', () => { finishResourceDrag(); void unfreeze(); }, true);
document.addEventListener('drop', () => setTimeout(() => { finishResourceDrag(); void unfreeze(); }), true);

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
  store.setState({ profiles: s, stageTerminals: nextStageTerminals ?? [], pictures: {}, captions: {}, picking: {}, ...(nextDevelopmentTerminals && { developmentTerminals: nextDevelopmentTerminals }) });
  nextDevelopmentTerminals = nextStageTerminals = null;
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
  constrainDevelopment();
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
const environmentIds = () => [...store.getState().profiles.map((p) => panelId(p.id)), ...store.getState().stageTerminals.map((a) => `stage-terminal:${a.id}`)];
function addEnvironment(id: string, reference?: string, direction: 'right' | 'below' | 'within' = 'right', inactive = false) {
  const profile = id.startsWith('profile:');
  stage!.addPanel({ id, component: profile ? 'profile' : 'stage-terminal', tabComponent: profile ? 'profile' : 'stage-terminal',
    title: profile ? store.getState().profiles.find((p) => panelId(p.id) === id)?.name : store.getState().stageTerminals.find((a) => `stage-terminal:${a.id}` === id)?.name,
    ...(!profile && { renderer: 'always' as const }), ...(reference && { position: { referencePanel: reference, direction } }), inactive });
}
function constrainStage(mode = store.getState().stageLayout, overflow = store.getState().stageOverflow) {
  if (!stage) return;
  const scrolling = overflow && mode !== 'tabs' && !stage.hasMaximizedGroup();
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
    const filtered = filterLayout(saved, (id) => known.includes(id));
    if (filtered.panels.resources) filtered.panels.resources = { ...filtered.panels.resources, tabComponent: 'resources', minimumHeight: resourceBarHeight };
    a.fromJSON(filtered);
  } catch (e) { console.warn('[layout] saved grid not restored:', (e as Error).message); a.clear(); }
}
function buildGrid(a: DockviewApi, saved: unknown) {
  const layout = splitLayout(saved);
  stageShare = layout?.stageShare && layout.stageShare > 0 && layout.stageShare < 1 ? layout.stageShare : 0.65;
  pendingStage = layout?.stage ?? null;
  store.setState({ stageLayout: layout?.stageLayout ?? null, stageOverflow: layout?.stageOverflow ?? false, stageFollowPaused: false, stageActivity: null, stagePosition: layout?.stagePosition ?? 'above' });
  placeStage();
  restore(a, layout?.workspace ?? null, ['terminal', 'resources']);
  if (!a.getPanel('terminal') || !a.getPanel('resources')) {
    a.clear();
    a.addPanel({ id: 'terminal', component: 'terminal', tabComponent: 'terminal', title: 'Terminal', renderer: 'always' });
    a.addPanel({ id: 'resources', component: 'resources', tabComponent: 'resources', title: 'Resources', minimumHeight: resourceBarHeight, position: { referencePanel: 'terminal', direction: 'left' } });
    a.getPanel('resources')!.group.api.setSize({ width: Math.round(a.width / 4) });
  }
  constrainDevelopment();
  const resources = a.getPanel('resources')!;
  // Restoring a group applies Dockview's default minimum before its runtime constraints.
  if (resources.params?.section === null) sizeResources(resources.api, resources.params);
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
let activityTimer = 0, followFrame = 0;
let lastEnvironment: string | null = null;
function followEnvironment(environment: string) {
  cancelAnimationFrame(followFrame);
  const task = store.getState().current;
  followFrame = requestAnimationFrame(() => {
    const state = store.getState();
    if (state.current !== task || !state.stageFollow || state.stageFollowPaused || state.loading) return;
    const panel = stage?.getPanel(environment);
    if (!panel || (stage!.hasMaximizedGroup() && !panel.api.isMaximized())) return;
    const focused = document.activeElement;
    if (!panel.api.isVisible) panel.api.setActive();
    if (focused instanceof HTMLElement && focused.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
    panel.group.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    scheduleLayout();
  });
}
function environmentActivity(environment: string) {
  lastEnvironment = environment;
  clearTimeout(activityTimer);
  store.setState({ stageActivity: environment });
  activityTimer = window.setTimeout(() => store.setState({ stageActivity: null }), 2000);
  followEnvironment(environment);
}
export async function setStageFollowing(follow: boolean) {
  await kulisa.invoke('stage:follow:set', follow);
  store.setState({ stageFollowPaused: false });
  if (follow && lastEnvironment) followEnvironment(lastEnvironment);
}
kulisa.on('stage:follow', (follow) => {
  store.setState({ stageFollow: follow, stageFollowPaused: false });
  if (follow && lastEnvironment) followEnvironment(lastEnvironment);
});
export function pauseStageFollowing() {
  if (store.getState().stageFollow) store.setState({ stageFollowPaused: true });
  cancelAnimationFrame(followFrame);
}
kulisa.on('stage:activity', ({ task, environment }) => {
  if (task === store.getState().current && !replacing && !rebuilding) environmentActivity(environment);
});
// Browser actions through CDP also cover clients using the profiles outside Kulisa's MCP tools.
kulisa.on('agent', ({ task, profile, caption }) => {
  if (task === store.getState().current && caption && !replacing && !rebuilding) environmentActivity(panelId(profile));
});
export const dockApi = () => api;
export const stageApi = () => stage;

kulisa.on('grid:closing', (next) => {
  clearTimeout(activityTimer); cancelAnimationFrame(followFrame); lastEnvironment = null;
  store.setState({ stageActivity: null, stageFollowPaused: false, stageTerminalFocus: null });
  void closeLayers(); forgetFrozen(); clearTimeout(saveTimer); save?.();
  if (next) { replacing = true; return; }
  replacing = false; nextDevelopmentTerminals = nextStageTerminals = null;
  store.setState({ loading: true }); removeStage(); api?.clear();
  store.setState({ profiles: [], stageTerminals: [], pictures: {}, captions: {}, picking: {}, developmentTerminals: { front: null, list: [] } });
  gridReady = null;
});
kulisa.on('tasks:closed', forgetTerminals);
kulisa.on('development-terminals', (t) => {
  if (t.task !== store.getState().current) return;
  if (replacing || rebuilding) nextDevelopmentTerminals = t;
  else { store.setState({ developmentTerminals: t }); scheduleLayout(); }
});
kulisa.on('stage-terminals', (t) => {
  if (t.task !== store.getState().current) return;
  if (replacing || rebuilding) nextStageTerminals = t.list;
  else { store.setState({ stageTerminals: t.list }); if (gridReady) void gridReady.then(syncGrid); }
});
kulisa.on('terminals:gone', forgetTerminals);
export const showPane = (id: string) => { stage?.getPanel(panelId(id))?.api.setActive(); };
