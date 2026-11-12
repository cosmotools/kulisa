// Window-wide state (docs/window.md).
import { createStore, useStore } from 'zustand';
import { replaceEqualDeep } from '@tanstack/react-query';
import type { TaskSummary } from '../../shared/ipc';
import type { ProjectsInfo } from '../../shared/types';
import { initialProjects } from './common';
import { projectColor, onColors } from '../../appearance/renderer';

const root = document.documentElement;
interface WindowState {
  summary: TaskSummary | null;
  current: string | null;
  projects: ProjectsInfo;
}
export const store = createStore<WindowState>()(() => ({
  summary: null, current: initialProjects?.current ?? null, projects: initialProjects || { current: null, project: null, projects: [], tabs: [], open: [], settings: false },
}));
const set = store.setState, get = store.getState;
export const useWindow = <T>(selector: (s: WindowState) => T) => useStore(store, selector);

// The shown task (TaskInfo) and its project, from the window's tabs.
export const shownTask = (s = get(), key = s.current) => s.projects.tabs.find((t) => t.key === key);
const shownProject = (s = get()) => s.projects.projects.find((p) => p.id === s.projects.project);
kulisa.on('project:state', (info) => set((previous) => {
  const projects = replaceEqualDeep(previous.projects, info);
  return projects === previous.projects && info.current === previous.current ? previous : { projects, current: info.current };
}));

kulisa.on('task:summary', (summary) => set({ summary }));

// What the window shows in the grid's place, one page at a time (docs/tasks.md, The window's pages): the shown task's
// grid; with no task open, the sidebar of every project's tasks; with no project at all, the welcome. Its own switch,
// not a router's: what is shown is the main process's (current).
export type Page = 'task' | 'sidebar' | 'welcome';
export const pageOf = (s: WindowState): Page => (s.current === null ? (s.projects.projects.length ? 'sidebar' : 'welcome') : 'task');
// On the root, for CSS and the tests: the page shown, the shown task's project's color (--project; none: Kulisa's own).
const reflect = (s: WindowState) => {
  root.dataset.page = pageOf(s);
  const p = shownProject(s), color = p && projectColor(p);
  if (color) root.style.setProperty('--project', color); else root.style.removeProperty('--project');
};
reflect(get());
store.subscribe((next, previous) => {
  if (pageOf(next) !== pageOf(previous) || shownProject(next) !== shownProject(previous)) reflect(next);
});
onColors(() => reflect(get())); // a favicon's color read
