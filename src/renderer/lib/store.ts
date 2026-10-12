// The window's state, as the main process sends it (window.ts), for the components to draw.
import { reactive, watch } from 'vue';
import type { ClosedProfile, Profile, ProjectsInfo, TaskInfo, Terminals } from '../types';
import { initialProjects } from './common';
import { projectColor } from './project-color';

const root = document.documentElement;
export const store = reactive({
  // The shown task's key ("<project id>/<n>"); null with no project open (Empty.vue).
  current: null as string | null,
  // The shown project's open tasks and the one its group shows: from the projects' news as a project is shown, so its
  // group has them at once (not the last project's until the tasks' news), then from the tasks' news.
  taskTabs: { list: [] as TaskInfo[], active: null as string | null },
  projects: (initialProjects || { current: null, projects: [], open: [] }) as ProjectsInfo,
  // The shown task's profiles, open (as Profile.info) and closed; its terminals' island.
  profiles: [] as Profile[],
  closedProfiles: [] as ClosedProfile[],
  terminals: { front: null, list: [] } as Terminals,
  zoom: 1, // the Kulisa zoom
  theme: root.dataset.theme || 'dark', // Dark, Light or System (index.html sets it from the URL before the first paint)
  bar: root.dataset.bar || 'bottom', // where the tasks' bar is
  loading: true, // the grid not laid out yet: no grid shown, the pages kept hidden (grid.ts, reveal)
  // Over each pane (by profile id): what the agent does (its caption), Pick's words; whose Pick is on.
  captions: {} as Record<string, string>,
  picking: {} as Record<string, boolean>,
  // Pictures of the pages (by profile id), standing in for the native views while a panel is dragged, a menu is
  // open or another task slides in.
  pictures: {} as Record<string, string>,
});

// The grid laid out or not (grid.ts): the root's class at once, as the view transition and the pages' views go by it.
export function setLoading(on: boolean) { store.loading = on; root.classList.toggle('loading', on); }

// The window's actions on the shown task's profiles and tabs name it, as the grid's layout does: one sent just as the
// human switches tasks or projects is refused, not done in the other one (app.ts, onScreen).
export const act = <T = any>(channel: string, args: Record<string, unknown> = {}) => kulisa.invoke<T>(channel, { ...args, task: store.current });

kulisa.on<ProjectsInfo>('projects', (info) => {
  store.projects = info;
  const shown = info.open.find((o) => o.id === info.current);
  if (shown) store.taskTabs = { list: (shown.tasks || []).filter((t) => !t.closed), active: shown.task ?? null };
});
kulisa.on<{ current: string | null; list: TaskInfo[] }>('tasks', ({ current, list }) => {
  store.current = current;
  store.taskTabs = { list, active: current };
});
kulisa.on<ClosedProfile[]>('closed-profiles', (list) => { store.closedProfiles = list; });
kulisa.on<number>('zoom', (z) => { store.zoom = z; });
void kulisa.invoke<number>('zoom:get').then((z) => { store.zoom = z; });
kulisa.on<string>('theme', (theme) => { store.theme = theme; });
kulisa.on<string>('bar', (bar) => { store.bar = bar; });

// The theme of Kulisa's own UI (app.ts): CSS does the rest (tokens.css: color-scheme, light-dark()). The tasks' bar
// over the grid or under it. The open project's color for the whole window (--project); none: Kulisa's own colors.
watch(() => store.theme, (t) => { root.dataset.theme = t; });
watch(() => store.bar, (b) => { root.dataset.bar = b; });
watch(() => store.current === null, (none) => root.classList.toggle('noproject', none), { immediate: true });
watch(() => { const p = store.projects.projects.find((x) => x.id === store.projects.current); return p && projectColor(p); }, (color) => {
  if (color) root.style.setProperty('--project', color); else root.style.removeProperty('--project');
}, { immediate: true });

// The agent's activity: a caption over the pane (the cursor itself is drawn inside the page, ghost.ts). A sticky one
// (what highlighted elements are) stays until the next one; the others go after 4 s. Not over a sign-in page, which
// says the agent is paused.
const captionTimers = new Map<string, number>();
kulisa.on<{ task: string; profile: string; caption: string; sticky?: boolean }>('agent', (a) => {
  if (a.task !== store.current) return; // a task in the background
  const p = store.profiles.find((x) => x.id === a.profile);
  if (!p || p.signinMode) return;
  store.captions[a.profile] = a.caption ? `↖ agent: ${a.caption}` : '';
  clearTimeout(captionTimers.get(a.profile));
  if (!a.sticky) captionTimers.set(a.profile, window.setTimeout(() => { store.captions[a.profile] = ''; }, 4000));
});

// Pick, then click an element: a reference to it lands in the agent's prompt (not sent), and the terminal gets the
// focus, so the human writes what is wrong around it. Picks in several panes go into one message. Pick again or Esc in
// the page cancels.
export async function togglePick(profile: string) {
  if (store.picking[profile]) return kulisa.invoke('pick:cancel', { profile });
  store.captions[profile] = 'Click an element on the page · Esc to cancel';
  store.picking[profile] = true;
  const res = await kulisa.invoke<{ error?: string } | null>('pick:start', { profile });
  store.picking[profile] = false;
  store.captions[profile] = res && res.error ? `Pick failed: ${res.error}` : '';
}
