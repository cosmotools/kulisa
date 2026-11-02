// State, actions and panel ownership of retained task screens (docs/window.md, The grid).
import { createStore, useStore, type StoreApi } from 'zustand';
import { replaceEqualDeep } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';
import type { StageTerminal } from '../../shared/stage-terminal';
import type { DiffSelection } from '../../diff/ipc';
import type { Artifact, ClosedProfile, Profile, DevelopmentTerminalsState } from '../../shared/types';
import type { Invoke, OnTask, StageLayout, StagePosition } from '../../shared/ipc';
import { refused } from '../../shared/result';
import { store, useWindow } from '../lib/store';
import type { TaskGrid } from './grid';

export interface TaskState {
  key: string;
  profiles: Profile[];
  closedProfiles: ClosedProfile[];
  developmentTerminals: DevelopmentTerminalsState;
  developmentDiff: DiffSelection | null;
  developmentTerminalFocus: object | null;
  stageTerminals: StageTerminal[];
  stageTerminalFocus: { key: string | null } | null;
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
  developmentDiff: null, developmentTerminalFocus: null, stageTerminals: [], stageTerminalFocus: null, stageLayout: null, stageOverflow: false,
  stageFollowPaused: false, stageActivity: null, stagePosition: 'above', artifacts: { task: key, list: [], bytes: 0 },
  loading: true, captions: {}, picking: {}, pictures: {},
}));
export const tasks = createStore<Record<string, TaskStore>>(() => ({}));
function syncTasks() {
  const { projects, current } = store.getState();
  const open = new Set(projects.tabs.map((t) => t.key)), previous = tasks.getState();
  const next = Object.fromEntries(Object.entries(previous).filter(([key]) => open.has(key)));
  if (current && !next[current]) next[current] = makeTask(current);
  tasks.setState(replaceEqualDeep(previous, next), true);
}
syncTasks();
store.subscribe((next, previous) => {
  if (next.projects.tabs !== previous.projects.tabs || next.current && !tasks.getState()[next.current]) syncTasks();
});

// Window commands use the selected task; panels use the controller supplied by their TaskView.
const emptyTask = makeTask('');
export const taskStore = (key = store.getState().current) => key ? tasks.getState()[key] ?? emptyTask : emptyTask;
export const TaskContext = createContext<TaskGrid | null>(null);
export function useTaskGrid() {
  const grid = useContext(TaskContext);
  if (!grid) throw new Error('A grid panel requires its TaskView');
  return grid;
}
export function useTaskStore() {
  const owner = useContext(TaskContext), current = useStore(store, (s) => owner ? null : s.current);
  return owner?.state ?? taskStore(current);
}
export function useTask<T>(selector: (s: TaskState) => T) { return useStore(useTaskStore(), selector); }
export function useTaskActive(enabled = true) {
  const key = useTask((s) => s.key);
  return useWindow((s) => enabled && s.current === key);
}
const get = store.getState;

const setIn = <K extends 'captions' | 'picking'>(owner: TaskStore, key: K, profile: string, value: TaskState[K][string]) => owner.setState({ [key]: { ...owner.getState()[key], [profile]: value } });
const setCaption = (profile: string, caption: string, owner = taskStore()) => setIn(owner, 'captions', profile, caption);

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

// IPC copies objects; retaining equal parts keeps unchanged panels out of React's update path.
function receive<K extends keyof TaskState>(task: string, field: K, value: TaskState[K]) {
  tasks.getState()[task]?.setState((previous) => {
    const next = replaceEqualDeep(previous[field], value);
    return next === previous[field] ? previous : { ...previous, [field]: next };
  });
}
kulisa.on('profile:state', ({ task, list }) => receive(task, 'profiles', list));
kulisa.on('profile:closed', ({ task, list }) => receive(task, 'closedProfiles', list));
kulisa.on('development-terminal:state', (state) => receive(state.task ?? '', 'developmentTerminals', state));
kulisa.on('stage-terminal:state', ({ task, list }) => receive(task, 'stageTerminals', list));
kulisa.on('task:artifact:state', (a) => receive(a.task, 'artifacts', a));

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
