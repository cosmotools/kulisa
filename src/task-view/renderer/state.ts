// State, actions and panel ownership of retained task screens (../README.md, The grid).
import { createStore, useStore, type StoreApi } from 'zustand';
import { replaceEqualDeep } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import type { StageTerminal } from '../../shared/stage-terminal';
import type { DiffSelection } from '../../diff/ipc';
import type { Artifact, ClosedProfile, Profile, DevelopmentTerminalsState, ProjectsInfo } from '../../shared/types';
import type { StageLayout, StagePosition } from '../../shared/ipc';
import { projectColor, onColors } from '../../appearance/renderer';
import { actionsFor } from '../../window-client/renderer';
import type { TaskGrid } from './grid';
import type { ActivityItem } from './development';

const query = new URLSearchParams(location.search);
export const taskIdentity = query.get('task')!;
export interface TaskState {
  active: boolean; covered: boolean; projects: ProjectsInfo;
  key: string;
  profiles: Profile[];
  closedProfiles: ClosedProfile[];
  developmentTerminals: DevelopmentTerminalsState;
  workbenchItem: ActivityItem;
  developmentDiff: DiffSelection | null;
  selectedArtifact: string | null;
  artifactNavigation: number;
  developmentTerminalFocus: object | null;
  stageTerminals: StageTerminal[];
  stageLayout: StageLayout | null;
  stageOverflow: boolean;
  stageFollowPaused: boolean;
  stageActivity: string | null;
  stagePosition: StagePosition;
  artifacts: { task: string; list: Artifact[]; bytes: number };
  loading: boolean;
  pictures: Record<string, string>;
}
export type TaskStore = StoreApi<TaskState>;
const key = taskIdentity;
export const store = createStore<TaskState>()(() => ({
  active: true, covered: false,
  projects: JSON.parse(query.get('projects') || 'null') ?? { current: null, project: null, projects: [], tabs: [], open: [], settings: false },
  key, profiles: [], closedProfiles: [], developmentTerminals: { task: key, front: null, list: [] },
  workbenchItem: 'terminals', developmentDiff: null, selectedArtifact: null, artifactNavigation: 0, developmentTerminalFocus: null, stageTerminals: [], stageLayout: null, stageOverflow: false,
  stageFollowPaused: false, stageActivity: null, stagePosition: 'above', artifacts: { task: key, list: [], bytes: 0 },
  loading: true, pictures: {},
}));
export const TaskContext = createContext<TaskGrid | null>(null);
export function useTaskGrid() {
  const grid = useContext(TaskContext);
  if (!grid) throw new Error('A grid panel requires its TaskView');
  return grid;
}
export function useTask<T>(selector: (s: TaskState) => T) { return useStore(store, selector); }
export function useTaskActive(enabled = true) {
  return useTask((s) => enabled && s.active && !s.covered);
}
const get = store.getState;
export const currentTask = (state = get()): string | null => state.active ? state.key : null;

// The window's actions on the shown task's profiles and tabs name it, as the grid's layout does: one sent just as the
// human switches tasks is refused, not done in the other one (main/ipc/panes.ts, onScreen).
export const act = actionsFor(taskIdentity);

// IPC copies objects; retaining equal parts keeps unchanged panels out of React's update path.
function receive<K extends keyof TaskState>(task: string, field: K, value: TaskState[K]) {
  if (task !== key) return;
  store.setState((previous) => {
    const next = replaceEqualDeep(previous[field], value);
    return next === previous[field] ? previous : { ...previous, [field]: next };
  });
}
kulisa.on('project:state', (info) => receive(key, 'projects', info));
kulisa.on('task:activity', (activity) => store.setState(activity));
kulisa.on('task:initial', (presentation) => store.setState(presentation));
kulisa.on('profile:state', ({ task, list }) => receive(task, 'profiles', list));
kulisa.on('profile:closed', ({ task, list }) => receive(task, 'closedProfiles', list));
kulisa.on('development-terminal:state', (state) => receive(state.task ?? '', 'developmentTerminals', state));
kulisa.on('stage-terminal:state', ({ task, list }) => receive(task, 'stageTerminals', list));
kulisa.on('task:artifact:state', (a) => receive(a.task, 'artifacts', a));

export const shownTask = (s = get(), task: string | null = currentTask(s)) => s.projects.tabs.find((t) => t.key === task);
const reflect = () => {
  const state = get(), project = state.projects.projects.find((p) => p.id === state.projects.project);
  const color = project && projectColor(project), root = document.documentElement;
  root.dataset.page = state.active ? 'task' : state.projects.projects.length ? 'sidebar' : 'welcome';
  if (color) root.style.setProperty('--project', color); else root.style.removeProperty('--project');
};
reflect();
store.subscribe((next, previous) => { if (next.active !== previous.active || next.projects !== previous.projects) reflect(); });
onColors(reflect);
