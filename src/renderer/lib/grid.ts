// The grid of the shown task (dockview, drawn by components/Grid.tsx; docs/window.md, The grid). After any change the main process
// gets where each pane's .content box is, or that it is not on screen (stacked behind another pane), as it lays the
// native views over them.
import type { AddPanelPositionOptions, DockviewApi } from 'dockview-react';
import type { Profile } from '../../shared/types';
import { act, setCaption, setLoading, store } from './store';
import { forgetFrozen, freeze, livePages, showViews, unfreeze } from './views';
import { closeLayers } from './cover';
import { reducedMotion } from './common';
import { forgetTerminals } from '../../terminal/renderer';

const panelId = (id: string) => `profile:${id}`;
// What the window does with a mounted pane (components/grid/ProfilePane.tsx), by its profile's id.
export interface PaneHandle { content: HTMLElement; focusAddress(): void; newTab(): void; pick(): void }
export const panes = new Map<string, PaneHandle>();

let api: DockviewApi | null = null;
let gotApi: (a: DockviewApi) => void;
let apiReady: Promise<DockviewApi>;
const awaitApi = () => { apiReady = new Promise<DockviewApi>((r) => (gotApi = r)); };
awaitApi();
let gridReady: Promise<void> | null = null;
let leaving: Promise<void> | null = null; // the grid being taken down, before the next one is built
let sliding: { transition: ViewTransition; built: () => void } | null = null; // a switch as a view transition, until the next grid is built
const pictures = new Map<string, Record<string, string>>(); // task key -> its pages when it was left, for sliding in
// What comes for the next task waits until the grid on screen has gone (it clears the state).
export const whenLeft = () => Promise.resolve(leaving);

// Grid.tsx, once dockview is there.
export function gridMounted(a: DockviewApi) {
  api = a;
  Object.assign(window, { __dock: a }); // for tests
  let saveTimer = 0, save: (() => void) | null = null;
  a.onDidLayoutChange(() => {
    scheduleLayout();
    clearTimeout(saveTimer);
    // Not a grid being taken down or built.
    if (store.getState().loading) return;
    const task = store.getState().current;
    save = () => { save = null; kulisa.send('layout:save', { task, layout: a.toJSON() }); };
    saveTimer = window.setTimeout(save, 300);
  });
  a.onDidActivePanelChange(scheduleLayout);
  flushSave = () => { clearTimeout(saveTimer); save?.(); };
  // Dragging a panel (drop targets are HTML): the pages become pictures of themselves meanwhile.
  a.onWillDragPanel(freeze);
  a.onWillDragGroup(freeze);
  a.onDidDrop(unfreeze);
  gotApi(a);
}
let flushSave = () => {};
// Grid.tsx gone (the window left with no task: the empty window): the next grid is built in the next dockview, not
// into the one gone.
export function gridUnmounted() { api = null; awaitApi(); gridReady = null; flushSave = () => {}; }
document.addEventListener('dragend', unfreeze, true);
document.addEventListener('drop', () => setTimeout(unfreeze), true);

kulisa.on('state', async (s) => {
  await leaving;
  // A profile leaving sign-in mode: the words over its pane go.
  for (const p of s) if (!p.signinMode && store.getState().profiles.find((x) => x.id === p.id)?.signinMode) setCaption(p.id, '');
  store.setState({ profiles: s });
  const first = !gridReady;
  await (gridReady ??= restoreGrid());
  syncGrid();
  scheduleLayout();
  if (first) reveal();
});

// Until the grid is built and the pages have their places, the window shows no grid and the main process keeps the
// pages hidden (loading): nothing jumps while the window loads, e.g. when another project is opened. A task shown from
// the bar slides in with pictures of its pages (grid:closing), then the pages themselves come.
function reveal() {
  if (sliding) {
    const { transition, built } = sliding; sliding = null;
    setLoading(false);
    store.setState({ pictures: pictures.get(store.getState().current!) || {} });
    built(); // the transition's new state: it slides in
    void transition.finished.catch(() => {}).then(() => { sendLayout(); void livePages(); }); // skipped or given up: the pages still come
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { // after sendLayout's frame
    setLoading(false);
    void showViews();
  }));
}

let layoutFrame = 0;
export function scheduleLayout() { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(sendLayout); }
function sendLayout() {
  const rects: Record<string, { shown: false } | { x: number; y: number; width: number; height: number }> = {};
  for (const p of store.getState().profiles) {
    const panel = api?.getPanel(panelId(p.id)), c = panes.get(p.id)?.content;
    if (!panel || !panel.api.isVisible || !c?.isConnected || !c.offsetWidth) { rects[p.id] = { shown: false }; continue; }
    const r = c.getBoundingClientRect();
    rects[p.id] = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  }
  kulisa.send('layout', { task: store.getState().current, rects });
}

const addProfilePanel = (p: Profile, position?: AddPanelPositionOptions, extra: { inactive?: boolean } = {}) =>
  api!.addPanel({ id: panelId(p.id), component: 'profile', tabComponent: 'profile', title: p.name, position, ...extra });
const addTerminal = (position: AddPanelPositionOptions) =>
  api!.addPanel({ id: 'terminal', component: 'terminal', tabComponent: 'terminal', title: 'Terminal', renderer: 'always', position });
// The Resources pane (components/grid/Resources.tsx), next to the terminal: right of it in its row, or under it in its column. As low
// as its header, so the row folds with the terminal (components/grid/Terminals.tsx, fold) when that lies under or over the pages.
const addResources = (direction: 'right' | 'below') => api!.addPanel({ id: 'resources', component: 'resources', tabComponent: 'resources',
  title: 'Resources', position: { referencePanel: 'terminal', direction }, minimumHeight: 36 });
const groupOf = (id: string) => api!.getPanel(id)!.group.api;

// The terminal's share of the grid, beside the pages: the pages are what is looked at, the terminal mostly waits.
const TERMINAL_SHARE = 0.35;
const RESOURCES_SHARE = { width: 1 / 4, height: 1 / 3 }; // of the grid: beside the terminal; under it
// The terminal and Resources under the pages, their sizes in a grid of w × h.
const underPages = () => {
  addTerminal({ direction: 'below' });
  addResources('right');
  return (w: number, h: number) => { groupOf('resources').setSize({ width: Math.round(w * RESOURCES_SHARE.width) }); groupOf('terminal').setSize({ height: Math.round(h * TERMINAL_SHARE) }); };
};
// Ready-made arrangements (☰); after one, panels move freely again. Each gives what sizes its panels, once the grid
// has one.
const presets: Record<'columns' | 'grid' | 'focus', (s: Profile[]) => (w: number, h: number) => void> = {
  columns(s) {
    s.forEach((p, i) => addProfilePanel(p, i ? { referencePanel: panelId(s[i - 1]!.id), direction: 'right' } : undefined));
    return underPages();
  },
  grid(s) {
    s.forEach((p, i) => addProfilePanel(p, i === 0 ? undefined
      : i === 1 ? { referencePanel: panelId(s[0]!.id), direction: 'right' }
        : { referencePanel: panelId(s[i - 2]!.id), direction: 'below' }));
    addTerminal({ direction: 'right' });
    addResources('below');
    return (w, h) => { groupOf('terminal').setSize({ width: Math.round(w * TERMINAL_SHARE) }); groupOf('resources').setSize({ height: Math.round(h * RESOURCES_SHARE.height) }); };
  },
  focus(s) {
    s.forEach((p, i) => addProfilePanel(p, i ? { referencePanel: panelId(s[0]!.id), direction: 'within' } : undefined, { inactive: i > 0 }));
    return underPages();
  },
};
// The grid's room: dockview's own element, under the closed profiles' tiles when they show.
function room() {
  const grid = document.getElementById('grid')!;
  return { w: grid.clientWidth, h: grid.clientHeight };
}
export function applyPreset(name: keyof typeof presets) {
  const a = api!;
  a.clear();
  const sizes = presets[name](store.getState().profiles);
  // The panels' sizes, once the grid has a size (at first start the window may have none yet). Its
  // room (room()), not #dock's: laid out to a box larger than its room, the right and bottom were cut off until the
  // window was resized.
  const dock = document.getElementById('dock')!;
  const size = () => {
    const { w, h } = room();
    if (h < 100) return false;
    a.layout(w, h);
    sizes(w, h);
    return true;
  };
  if (!size()) { const ro = new ResizeObserver(() => size() && ro.disconnect()); ro.observe(dock); }
  scheduleLayout();
}
Object.assign(window, { __layoutPreset: applyPreset }); // for tests

// Another task is being shown, or another project (dir: where it is in the tasks' bar; 0: none, the window is left
// with no project; level: 'task' or 'project'): the grid goes and is built again on the next state, as a view
// transition (Grid.tsx's styles): Chromium takes a picture of the grid on screen, with pictures of its pages (the main
// process sends them; kept for when it comes back), and shows it while the next grid is built (reveal). Another
// project's grid slides in as macOS desktops do, the one left out and the next one in at once; another task's replaces
// it at once. Not with reduced motion: then the grid is hidden at once, so nothing half-built shows. The title bar and
// the tasks' bar stay.
kulisa.on('grid:closing', ({ dir, task, pics }) => {
  closeLayers(); // its dialogs and menus are for the grid that goes
  // A freeze under way (a drag) no longer matters; now, not when the grid is taken down (the slide's update, a frame or
  // more later): a menu opened in between, for the next grid, would lose its pictures, and the slide's end show the
  // pages over it.
  forgetFrozen();
  // Its last change saved now, not dropped: a pane closed (its profile deleted) just before the task was left stayed in
  // its saved grid, and a saved grid naming a profile no longer there is not restored at all (restoreGrid).
  flushSave();
  if (pics && task) pictures.set(task, pics);
  const takeDown = () => {
    setLoading(true);
    api?.clear();
    // The panes go with what was said over them: profile ids repeat across tasks.
    store.setState({ profiles: [], pictures: {}, captions: {}, picking: {}, terminals: { front: null, list: [] } });
    gridReady = null;
  };
  // A slide still waiting for its grid ends now: Chromium draws no frame until its update is done, and would wait for it
  // until its own timeout.
  sliding?.built();
  sliding = null;
  if (!dir || reducedMotion.matches || !gridReady) { takeDown(); leaving = null; return; }
  store.setState({ pictures: pics || {} });
  let cleared!: () => void, built!: () => void;
  leaving = new Promise((r) => (cleared = r));
  const next = new Promise<void>((r) => (built = r));
  // While the next grid is built (the callback), Chromium shows the picture of this one and draws no frames: the
  // building must not wait for one (reveal).
  const transition = document.startViewTransition({ update: () => { takeDown(); cleared(); return next; }, types: [dir > 0 ? 'next' : 'previous'] });
  // Skipped (another switch began, the window hidden) or given up, a slide is no error: the next grid comes all the same.
  transition.ready.catch(() => {});
  sliding = { transition, built };
});

// Tasks gone (closed, deleted, moved to another window): their terminals and pictures too; a task opened again
// later starts afresh.
kulisa.on('tasks:closed', (keys) => {
  for (const key of keys) pictures.delete(key);
  forgetTerminals(keys);
});

async function restoreGrid() {
  const a = await apiReady;
  const saved = await act('layout:load') as { panels?: Record<string, unknown> } | null | undefined; // as the window saved it
  // A saved grid may name profiles deleted since; dockview needs a component for every panel in it.
  const known = (id: string) => id === 'terminal' || id === 'resources' || store.getState().profiles.some((p) => panelId(p.id) === id);
  // One without the Resources panel is not a grid this window makes: the default arrangement instead.
  if (saved && Object.keys(saved.panels || {}).every(known) && saved.panels?.resources) {
    try { a.fromJSON(saved as Parameters<DockviewApi['fromJSON']>[0]); } catch (e) { console.warn('[layout] saved grid not restored:', (e as Error).message); a.clear(); }
  }
  if (!a.getPanel('terminal')) applyPreset('columns');
}

// Panels follow the profiles: a new profile goes next to the last profile pane (or above the terminal's row), a deleted one
// goes away.
function syncGrid() {
  const a = api!;
  const { profiles } = store.getState();
  for (const panel of a.panels.filter((x) => x.id.startsWith('profile:') && !profiles.some((p) => panelId(p.id) === x.id))) a.removePanel(panel);
  for (const p of profiles) {
    if (a.getPanel(panelId(p.id))) continue;
    const last = a.panels.filter((x) => x.id.startsWith('profile:')).at(-1);
    // The first over the whole grid's width: the terminal's row, Resources in it too, under it.
    addProfilePanel(p, last ? { referencePanel: last.id, direction: 'right' } : { direction: 'above' });
    // The first page over the terminal alone: dockview halves the room; the terminal keeps its share, as in the
    // arrangements (a terminal as tall as the pages was mostly empty). Once the closed profiles' tiles have gone: the
    // room they leave went to the terminal (dockview resizing after its share was set), 45% of the grid.
    if (!last) requestAnimationFrame(() => {
      if (api !== a || !a.getPanel('terminal')) return; // the grid taken down meanwhile (the task left)
      const { w, h } = room();
      a.layout(w, h);
      groupOf('terminal').setSize({ height: Math.round(h * TERMINAL_SHARE) });
    });
  }
}
// The shown task's terminals (components/grid/Terminals.tsx): its tabs, the one in front.
kulisa.on('terminals', async (t) => {
  await leaving; // as the state: the next task's, once the grid on screen has gone
  if (t.task === store.getState().current) store.setState({ terminals: t });
});
// A terminal closed, of any task: its xterm goes.
kulisa.on('terminals:gone', forgetTerminals);

// Bring an open profile's pane to the front (it may be stacked behind another).
export const showPane = (id: string) => api?.getPanel(panelId(id))?.api.setActive();
