// The grid of the shown task (dockview, drawn by Grid.vue; docs/window.md, The grid). After any change the main process
// gets where each pane's .content box is, or that it is not on screen (stacked behind another pane), as it lays the
// native views over them.
import { nextTick } from 'vue';
import type { AddPanelPositionOptions, DockviewApi } from 'dockview-vue';
import type { Profile } from '../../shared/types';
import { act, setLoading, store } from './store';
import { forgetFrozen, freeze, livePages, showViews, unfreeze } from './views';
import { closeLayers } from './cover';
import { reducedMotion } from './common';
import { forgetTerminals } from '../../terminal/renderer';

const panelId = (key: string) => `profile:${key}`;
// What the window does with a mounted pane (ProfilePane.vue), by its profile's key.
export interface PaneHandle { content: HTMLElement; focusAddress(): void; newTab(): void }
export const panes = new Map<string, PaneHandle>();
export const paneOfProfile = (id: string) => {
  const p = store.profiles.find((x) => x.id === id);
  return p && panes.get(p.key);
};

let api: DockviewApi | null = null;
let gotApi: (a: DockviewApi) => void;
const apiReady = new Promise<DockviewApi>((r) => (gotApi = r));
let gridReady: Promise<void> | null = null;
let leaving: Promise<void> | null = null; // the grid being taken down, before the next one is built
let sliding: { transition: ViewTransition; built: () => void } | null = null; // a switch as a view transition, until the next grid is built
const pictures = new Map<string, Record<string, string>>(); // task key -> its pages when it was left, for sliding in
// What comes for the next task waits until the grid on screen has gone (it clears the state).
export const whenLeft = () => Promise.resolve(leaving);

// Grid.vue, once dockview is there.
export function gridMounted(a: DockviewApi) {
  api = a;
  Object.assign(window, { __dock: a }); // for tests
  let saveTimer = 0, save: (() => void) | null = null;
  a.onDidLayoutChange(() => {
    scheduleLayout();
    clearTimeout(saveTimer);
    // Not a grid being taken down or built.
    if (store.loading) return;
    const task = store.current;
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
document.addEventListener('dragend', unfreeze, true);
document.addEventListener('drop', () => setTimeout(unfreeze), true);

kulisa.on('state', async (s) => {
  await leaving;
  // A profile leaving sign-in mode: the words over its pane go.
  for (const p of s) if (!p.signinMode && store.profiles.find((x) => x.key === p.key)?.signinMode) store.captions[p.id] = '';
  store.profiles = s;
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
    store.pictures = pictures.get(store.current!) || {};
    built(); // the transition's new state: it slides in
    void transition.finished.then(() => { sendLayout(); void livePages(); });
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
  for (const p of store.profiles) {
    const panel = api?.getPanel(panelId(p.key)), c = panes.get(p.key)?.content;
    if (!panel || !panel.api.isVisible || !c?.isConnected || !c.offsetWidth) { rects[p.id] = { shown: false }; continue; }
    const r = c.getBoundingClientRect();
    rects[p.id] = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  }
  kulisa.send('layout', { task: store.current, rects });
}

const addProfilePanel = (p: Profile, position?: AddPanelPositionOptions, extra: { inactive?: boolean } = {}) =>
  api!.addPanel({ id: panelId(p.key), component: 'profile', tabComponent: 'profile', title: p.name, position, ...extra });
const addTerminal = (position: AddPanelPositionOptions) =>
  api!.addPanel({ id: 'terminal', component: 'terminal', tabComponent: 'terminal', title: 'Terminal', renderer: 'always', position });

// The terminal's share of the grid, beside the pages: the pages are what is looked at, the terminal mostly waits.
const TERMINAL_SHARE = 0.35;
// Ready-made arrangements (☰); after one, panels move freely again. Each says the terminal's share of the window.
const presets: Record<'columns' | 'grid' | 'focus', (s: Profile[]) => { height?: number; width?: number }> = {
  columns(s) {
    s.forEach((p, i) => addProfilePanel(p, i ? { referencePanel: panelId(s[i - 1]!.key), direction: 'right' } : undefined));
    addTerminal({ direction: 'below' });
    return { height: TERMINAL_SHARE };
  },
  grid(s) {
    s.forEach((p, i) => addProfilePanel(p, i === 0 ? undefined
      : i === 1 ? { referencePanel: panelId(s[0]!.key), direction: 'right' }
        : { referencePanel: panelId(s[i - 2]!.key), direction: 'below' }));
    addTerminal({ direction: 'right' });
    return { width: TERMINAL_SHARE };
  },
  focus(s) {
    s.forEach((p, i) => addProfilePanel(p, i ? { referencePanel: panelId(s[0]!.key), direction: 'within' } : undefined, { inactive: i > 0 }));
    addTerminal({ direction: 'below' });
    return { height: TERMINAL_SHARE };
  },
};
// The grid's room: dockview's own element, under the closed profiles' tiles when they show (ClosedProfiles.vue).
function room() {
  const grid = document.getElementById('grid')!;
  return { w: grid.clientWidth, h: grid.clientHeight };
}
export function applyPreset(name: keyof typeof presets) {
  const a = api!;
  a.clear();
  const share = presets[name](store.profiles);
  // The terminal's share of the window, once the grid has a size (at first start the window may have none yet). Its
  // room (room()), not #dock's: laid out to a box larger than its room, the right and bottom were cut off until the
  // window was resized.
  const dock = document.getElementById('dock')!;
  const size = () => {
    const { w, h } = room();
    if (h < 100) return false;
    a.layout(w, h);
    a.getPanel('terminal')!.group.api.setSize(share.height ? { height: Math.round(h * share.height) } : { width: Math.round(w * share.width!) });
    return true;
  };
  if (!size()) { const ro = new ResizeObserver(() => size() && ro.disconnect()); ro.observe(dock); }
  scheduleLayout();
}
Object.assign(window, { __layoutPreset: applyPreset }); // for tests

// Another task is being shown, or another project (dir: where it is in the tasks' bar; 0: none, the window is left
// with no project; level: 'task' or 'project'): the grid goes and is built again on the next state, as a view
// transition (Grid.vue's styles): Chromium takes a picture of the grid on screen, with pictures of its pages (the main
// process sends them; kept for when it comes back), and shows it while the next grid is built (reveal). Another
// project's grid slides in as macOS desktops do, the one left out and the next one in at once; another task's replaces
// it at once. Not with reduced motion: then the grid is hidden at once, so nothing half-built shows. The title bar and
// the tasks' bar stay.
kulisa.on('grid:closing', ({ dir, task, pics }) => {
  closeLayers(); // its dialogs and menus are for the grid that goes
  // A freeze under way (a drag) no longer matters; now, not when the grid is taken down (the slide's update, a frame or
  // more later): a menu opened in between, for the next grid, lost its pictures, and the slide's end showed the pages
  // over it (2026-10-16).
  forgetFrozen();
  // Its last change saved now, not dropped: a pane closed (its profile deleted) just before the task was left stayed in
  // its saved grid, and a saved grid naming a profile no longer there is not restored at all (restoreGrid).
  flushSave();
  if (pics && task) pictures.set(task, pics);
  const takeDown = () => {
    setLoading(true);
    api?.clear();
    // The panes go with what was said over them: profile ids repeat across tasks.
    Object.assign(store, { profiles: [], pictures: {}, captions: {}, picking: {}, terminals: { front: null, list: [] } });
    gridReady = null;
  };
  sliding = null;
  if (!dir || reducedMotion.matches || !gridReady) { takeDown(); leaving = null; return; }
  store.pictures = pics || {};
  let cleared!: () => void, built!: () => void;
  leaving = new Promise((r) => (cleared = r));
  const next = new Promise<void>((r) => (built = r));
  // While the next grid is built (the callback), Chromium shows the picture of this one and draws no frames: the
  // building must not wait for one (reveal).
  const transition = document.startViewTransition({ update: () => { takeDown(); cleared(); return next; }, types: [dir > 0 ? 'next' : 'previous'] });
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
  const known = (id: string) => id === 'terminal' || store.profiles.some((p) => panelId(p.key) === id);
  if (saved && Object.keys(saved.panels || {}).every(known)) {
    try { a.fromJSON(saved as Parameters<DockviewApi['fromJSON']>[0]); } catch (e) { console.warn('[layout] saved grid not restored:', (e as Error).message); a.clear(); }
  }
  if (!a.getPanel('terminal')) applyPreset('columns');
}

// Panels follow the profiles: a new profile goes next to the last profile pane (or above the terminal), a deleted one
// goes away.
function syncGrid() {
  const a = api!;
  for (const panel of a.panels.filter((x) => x.id.startsWith('profile:') && !store.profiles.some((p) => panelId(p.key) === x.id))) a.removePanel(panel);
  for (const p of store.profiles) {
    if (a.getPanel(panelId(p.key))) continue;
    const last = a.panels.filter((x) => x.id !== 'terminal').at(-1);
    addProfilePanel(p, last ? { referencePanel: last.id, direction: 'right' } : { referencePanel: 'terminal', direction: 'above' });
    // The first page over the terminal alone: dockview halves the room; the terminal keeps its share, as in the
    // arrangements (a terminal as tall as the pages was mostly empty). Once the closed profiles' tiles have gone: the
    // room they leave went to the terminal (dockview resizing after its share was set), 45% of the grid.
    if (!last) void nextTick(() => {
      const { w, h } = room();
      a.layout(w, h);
      a.getPanel('terminal')?.group.api.setSize({ height: Math.round(h * TERMINAL_SHARE) });
    });
  }
}
// The shown task's island (Terminals.vue): its tabs, the one in front.
kulisa.on('terminals', async (t) => {
  await leaving; // as the state: the next task's, once the grid on screen has gone
  if (t.task === store.current) store.terminals = t;
});
// A terminal closed, of any task: its xterm goes.
kulisa.on('terminals:gone', forgetTerminals);

// Bring an open profile's pane to the front (it may be stacked behind another).
export const showPane = (key: string) => api?.getPanel(panelId(key))?.api.setActive();
