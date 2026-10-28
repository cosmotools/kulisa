// The window's state, as the main process sends it (window.ts), for the components to draw: read in a component with
// useWindow(selector), elsewhere with store.getState().
import { createStore, useStore } from 'zustand';
import type { Artifact, ClosedProfile, LanguageInfo, Profile, ProjectsInfo, Terminals } from '../../shared/types';
import type { Invoke, OnTask } from '../../shared/ipc';
import { initialProjects } from './common';
import { projectColor, onColors } from './project-color';
import { setTheme } from './theme';
import { refused } from '../../shared/result';

const root = document.documentElement, query = new URLSearchParams(location.search);
interface WindowState {
  // The shown task's key ("<project id>/<task id>"); null with no task open (the empty window).
  current: string | null;
  // The projects and the window's tabs (the open tasks, each with its agent's state), from the projects' news.
  projects: ProjectsInfo;
  // The shown task's profiles, open (as Profile.info) and closed; its terminals.
  profiles: Profile[];
  closedProfiles: ClosedProfile[];
  terminals: Terminals;
  // The files the agent's tools kept of a task's pages, the newest first (Resources), of the task named.
  artifacts: { task: string; list: Artifact[]; bytes: number };
  zoom: number; // the Kulisa zoom
  theme: string; // Dark, Light or System (shown before the first paint from the URL: public/theme.js)
  bar: string; // where the tasks' bar is
  language: LanguageInfo | null; // Kulisa's language (☰ → Language)
  loading: boolean; // the grid not laid out yet: no grid shown, the pages kept hidden (grid.ts, reveal)
  // Over each pane (by profile id): what the agent does (its caption), Pick's words; whose Pick is on.
  captions: Record<string, string>;
  picking: Record<string, boolean>;
  // Pictures of the pages (by profile id), standing in for the native views while a panel is dragged, a menu is
  // open or another task slides in.
  pictures: Record<string, string>;
}
export const store = createStore<WindowState>()(() => ({
  current: null,
  projects: initialProjects || { current: null, project: null, projects: [], tabs: [], open: [], settings: false },
  profiles: [],
  closedProfiles: [],
  terminals: { front: null, list: [] },
  artifacts: { task: '', list: [], bytes: 0 },
  zoom: 1,
  theme: query.get('theme') || 'dark',
  bar: query.get('bar') || 'bottom',
  language: null,
  loading: true,
  captions: {},
  picking: {},
  pictures: {},
}));
const set = store.setState, get = store.getState;
export const useWindow = <T>(selector: (s: WindowState) => T) => useStore(store, selector);

const setIn = <K extends 'captions' | 'picking'>(key: K, profile: string, value: WindowState[K][string]) => set({ [key]: { ...get()[key], [profile]: value } });
export const setCaption = (profile: string, caption: string) => setIn('captions', profile, caption);

// The shown task (TaskInfo) and its project, from the window's tabs.
export const shownTask = (s = get()) => s.projects.tabs.find((t) => t.key === s.current);
const shownProject = (s = get()) => s.projects.projects.find((p) => p.id === s.projects.project);
// The window's actions on the shown task's profiles and tabs name it, as the grid's layout does: one sent just as the
// human switches tasks is refused, not done in the other one (main/ipc/panes.ts, onScreen).
type OnTaskChannel = { [C in keyof Invoke]: Invoke[C]['args'] extends [OnTask] ? C : never }[keyof Invoke];
type Rest<C extends OnTaskChannel> = Omit<Invoke[C]['args'][0], 'task'>;
export const act = <C extends OnTaskChannel>(channel: C, ...args: {} extends Rest<C> ? [Rest<C>?] : [Rest<C>]) =>
  kulisa.invoke(channel, ...([{ ...args[0], task: get().current }] as Invoke[C]['args']));

kulisa.on('projects', (info) => set({ projects: info, current: info.current }));

// What the window shows in the grid's place, one page at a time (docs/tasks.md, The window's pages): the shown task's
// grid; with no task open, the sidebar of every project's tasks; with no project at all, the welcome. Its own switch,
// not a router's: what is shown is the main process's (current).
export type Page = 'task' | 'sidebar' | 'welcome';
export const pageOf = (s: WindowState): Page => (s.current === null ? (s.projects.projects.length ? 'sidebar' : 'welcome') : 'task');
kulisa.on('closed-profiles', (list) => set({ closedProfiles: list }));
kulisa.on('artifacts', (a) => set({ artifacts: a }));
kulisa.on('zoom', (z) => set({ zoom: z }));
void kulisa.invoke('zoom:get').then((z) => set({ zoom: z }));
kulisa.on('theme', (theme) => { set({ theme }); setTheme(theme); });
kulisa.on('bar', (bar) => set({ bar }));
kulisa.on('language', (info) => set({ language: info }));
void kulisa.invoke('language:get').then((info) => set({ language: info }));

// On the root, for CSS and the tests: the page shown, the shown task's project's color (--project; none: Kulisa's own).
const reflect = (s: WindowState) => {
  root.dataset.page = pageOf(s);
  const p = shownProject(s), color = p && projectColor(p);
  if (color) root.style.setProperty('--project', color); else root.style.removeProperty('--project');
};
reflect(get());
store.subscribe(reflect);
onColors(() => reflect(get())); // a favicon's color read

// A caption that goes after 4 s, unless sticky: it stays until the next one.
const captionTimers = new Map<string, number>();
function brief(profile: string, caption: string, sticky?: boolean) {
  setCaption(profile, caption);
  clearTimeout(captionTimers.get(profile));
  if (!sticky) captionTimers.set(profile, window.setTimeout(() => setCaption(profile, ''), 4000));
}

// The agent's activity: a caption over the pane (the cursor itself is drawn inside the page, ghost.ts), sticky for what
// highlighted elements are. Not over a sign-in page, which says the agent is paused.
kulisa.on('agent', (a) => {
  if (a.task !== get().current) return; // a task in the background
  const p = get().profiles.find((x) => x.id === a.profile);
  if (!p || p.signinMode) return;
  brief(a.profile, a.caption ? `↖ agent: ${a.caption}` : '', a.sticky);
});

// Pick, then click an element: a reference to it lands in the agent's prompt (not sent), and the terminal gets the
// focus, so the human writes what is wrong around it. Picks in several panes go into one message. Pick again or Esc in
// the page cancels.
export async function togglePick(profile: string) {
  if (get().picking[profile]) return kulisa.invoke('pick:cancel', { profile });
  setCaption(profile, 'Click an element on the page · Esc to cancel');
  setIn('picking', profile, true);
  const res = await kulisa.invoke('pick:start', { profile });
  setIn('picking', profile, false);
  setCaption(profile, res && res.error ? `Pick failed: ${res.error}` : '');
}

// Screenshot (⋮ → Screenshot; its key: Element): the picture goes to the clipboard and the OS's folder of screenshots
// (src/screenshots/README.md). Element: chosen as Pick chooses; Esc, Pick or the key again cancels.
export async function screenshot(profile: string, kind: 'element' | 'visible' | 'full') {
  if (get().picking[profile]) return kulisa.invoke('pick:cancel', { profile });
  if (kind === 'element') { setCaption(profile, 'Click an element for its screenshot · Esc to cancel'); setIn('picking', profile, true); }
  const res = await act('tab:screenshot', { profile, kind });
  setIn('picking', profile, false);
  brief(profile, refused(res) ? `Screenshot failed: ${res.error}` : res.file ? 'Screenshot copied and saved' : '');
}
