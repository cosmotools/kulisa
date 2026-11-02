// Window state and task-owned UI stores (docs/window.md, The grid).
import { createStore, useStore, type StoreApi } from 'zustand';
import { createContext, useContext, useMemo } from 'react';
import type { StageTerminal } from '../../shared/stage-terminal';
import type { DiffSelection } from '../../diff/ipc';
import type { Artifact, ClosedProfile, LanguageInfo, Profile, ProjectsInfo, DevelopmentTerminalsState } from '../../shared/types';
import type { Invoke, OnTask, StageLayout, StagePosition } from '../../shared/ipc';
import { initialProjects } from './common';
import { projectColor, onColors } from './project-color';
import { setTheme } from './theme';
import { refused } from '../../shared/result';

const root = document.documentElement, query = new URLSearchParams(location.search);
export interface DevelopmentDiff extends DiffSelection { task: string }

export interface TaskState {
  key: string;
  profiles: Profile[];
  closedProfiles: ClosedProfile[];
  developmentTerminals: DevelopmentTerminalsState;
  developmentDiff: DevelopmentDiff | null;
  stageTerminals: StageTerminal[];
  stageTerminalFocus: { task: string | null; key: string | null } | null;
  stageLayout: StageLayout | null;
  stageOverflow: boolean;
  stageFollowPaused: boolean;
  stageActivity: string | null;
  stagePosition: StagePosition;
  artifacts: { task: string; list: Artifact[]; bytes: number };
  loading: boolean;
  captions: Record<string, string>;
  picking: Record<string, boolean>;
  pictures: Record<string, string>;
}
export type TaskStore = StoreApi<TaskState>;
const makeTask = (key: string) => createStore<TaskState>()(() => ({
  key, profiles: [], closedProfiles: [], developmentTerminals: { task: key, front: null, list: [] },
  developmentDiff: null, stageTerminals: [], stageTerminalFocus: null, stageLayout: null, stageOverflow: false,
  stageFollowPaused: false, stageActivity: null, stagePosition: 'above', artifacts: { task: key, list: [], bytes: 0 },
  loading: true, captions: {}, picking: {}, pictures: {},
}));
interface WindowState {
  current: string | null;
  projects: ProjectsInfo;
  tasks: Record<string, TaskStore>;
  zoom: number;
  theme: string;
  bar: string;
  language: LanguageInfo | null;
  stageFollow: boolean;
}
export const store = createStore<WindowState>()(() => ({
  current: null, projects: initialProjects || { current: null, project: null, projects: [], tabs: [], open: [], settings: false },
  tasks: {}, zoom: 1, theme: query.get('theme') || 'dark', bar: query.get('bar') || 'bottom', language: null,
  stageFollow: query.get('stageFollow') === 'true',
}));
// Window controls use the selected task; panels receive their permanent owner through Context.
const emptyTask = makeTask('');
export const taskStore = (key = store.getState().current) => key ? store.getState().tasks[key] ?? emptyTask : emptyTask;
export const TaskContext = createContext<TaskStore | null>(null);
export function useTaskStore() {
  const owner = useContext(TaskContext), current = useStore(store, (s) => owner ? null : s.current);
  return owner ?? taskStore(current);
}
export function useTask<T>(selector: (s: TaskState) => T) { return useStore(useTaskStore(), selector); }
export function useTaskActive() {
  const key = useTask((s) => s.key);
  return useWindow((s) => s.current === key);
}
const set = store.setState, get = store.getState;
export const useWindow = <T>(selector: (s: WindowState) => T) => useStore(store, selector);

const setIn = <K extends 'captions' | 'picking'>(owner: TaskStore, key: K, profile: string, value: TaskState[K][string]) => owner.setState({ [key]: { ...owner.getState()[key], [profile]: value } });
const setCaption = (profile: string, caption: string, owner = taskStore()) => setIn(owner, 'captions', profile, caption);

// The shown task (TaskInfo) and its project, from the window's tabs.
export const shownTask = (s = get(), key = s.current) => s.projects.tabs.find((t) => t.key === key);
const shownProject = (s = get()) => s.projects.projects.find((p) => p.id === s.projects.project);
// The window's actions on the shown task's profiles and tabs name it, as the grid's layout does: one sent just as the
// human switches tasks is refused, not done in the other one (main/ipc/panes.ts, onScreen).
type OnTaskChannel = { [C in keyof Invoke]: Invoke[C]['args'] extends [OnTask] ? C : never }[keyof Invoke];
type Rest<C extends OnTaskChannel> = Omit<Invoke[C]['args'][0], 'task'>;
export const actionsFor = (task: string | null) => <C extends OnTaskChannel>(channel: C, ...args: {} extends Rest<C> ? [Rest<C>?] : [Rest<C>]) =>
  kulisa.invoke(channel, ...([{ ...args[0], task }] as Invoke[C]['args']));
export const act = <C extends OnTaskChannel>(channel: C, ...args: {} extends Rest<C> ? [Rest<C>?] : [Rest<C>]) => actionsFor(get().current)(channel, ...args);
export function useTaskActions() {
  const owner = useTaskStore(), key = owner.getState().key;
  return useMemo(() => actionsFor(key), [key]);
}

kulisa.on('project:state', (info) => {
  const tasks = Object.fromEntries(Object.entries(get().tasks).filter(([key]) => info.tabs.some((t) => t.key === key)));
  if (info.current && !tasks[info.current]) tasks[info.current] = makeTask(info.current);
  set({ projects: info, current: info.current, tasks });
});

// What the window shows in the grid's place, one page at a time (docs/tasks.md, The window's pages): the shown task's
// grid; with no task open, the sidebar of every project's tasks; with no project at all, the welcome. Its own switch,
// not a router's: what is shown is the main process's (current).
export type Page = 'task' | 'sidebar' | 'welcome';
export const pageOf = (s: WindowState): Page => (s.current === null ? (s.projects.projects.length ? 'sidebar' : 'welcome') : 'task');
kulisa.on('profile:closed', ({ task, list }) => get().tasks[task]?.setState({ closedProfiles: list }));
kulisa.on('task:artifact:state', (a) => get().tasks[a.task]?.setState({ artifacts: a }));
kulisa.on('zoom:state', (z) => set({ zoom: z }));
void kulisa.invoke('zoom:get').then((z) => set({ zoom: z }));
kulisa.on('theme:state', (theme) => { set({ theme }); setTheme(theme); });
kulisa.on('bar:state', (bar) => set({ bar }));
kulisa.on('language:state', (info) => set({ language: info }));
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
function brief(profile: string, caption: string, sticky?: boolean, owner = taskStore()) {
  setCaption(profile, caption, owner);
  clearTimeout(captionTimers.get(profile)); captionTimers.delete(profile);
  if (!sticky) captionTimers.set(profile, window.setTimeout(() => { captionTimers.delete(profile); setCaption(profile, '', owner); }, 4000));
}

// The agent's activity: a caption over the pane (the cursor itself is drawn inside the page, ghost.ts), sticky for what
// highlighted elements are. Not over a sign-in page, which says the agent is paused.
kulisa.on('agent:caption', (a) => {
  if (a.task !== get().current) return; // a task in the background
  const p = taskStore().getState().profiles.find((x) => x.id === a.profile);
  if (!p || p.signinMode) return;
  brief(a.profile, a.caption ? `↖ agent: ${a.caption}` : '', a.sticky);
});

// Pick, then click an element: a reference to it lands in the agent's prompt (not sent), and the terminal gets the
// focus, so the human writes what is wrong around it. Picks in several panes go into one message. Pick again or Esc in
// the page cancels.
export async function togglePick(profile: string, owner = taskStore()) {
  if (owner.getState().key !== get().current) return;
  if (owner.getState().picking[profile]) return kulisa.invoke('pick:cancel', { profile });
  setCaption(profile, 'Click an element on the page · Esc to cancel', owner);
  setIn(owner, 'picking', profile, true);
  const res = await kulisa.invoke('pick:start', { profile });
  setIn(owner, 'picking', profile, false);
  setCaption(profile, res && res.error ? `Pick failed: ${res.error}` : '', owner);
}

// Screenshot (⋮ → Screenshot; its key: Element): the picture goes to the clipboard and the task's artifacts in Resources
// (src/screenshots/README.md). Element: chosen as Pick chooses; Esc, Pick or the key again cancels.
export async function screenshot(profile: string, kind: 'element' | 'visible' | 'full', owner = taskStore()) {
  if (owner.getState().key !== get().current) return;
  if (owner.getState().picking[profile]) return kulisa.invoke('pick:cancel', { profile });
  if (kind === 'element') { setCaption(profile, 'Click an element for its screenshot · Esc to cancel', owner); setIn(owner, 'picking', profile, true); }
  const res = await actionsFor(owner.getState().key)('tab:screenshot', { profile, kind });
  setIn(owner, 'picking', profile, false);
  brief(profile, refused(res) ? `Screenshot failed: ${res.error}` : res.file ? 'Screenshot copied and saved' : '', undefined, owner);
}
