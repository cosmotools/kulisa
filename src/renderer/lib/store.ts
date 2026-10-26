// The window's state, as the main process sends it (window.ts), for the components to draw.
import { computed, reactive, watch } from 'vue';
import type { Artifact, ClosedProfile, LanguageInfo, Profile, ProjectsInfo, Terminals } from '../../shared/types';
import type { Invoke, OnTask } from '../../shared/ipc';
import { initialProjects } from './common';
import { projectColor } from './project-color';
import { setTheme } from './theme';
import { refused } from '../../shared/result';

const root = document.documentElement;
export const store = reactive({
  // The shown task's key ("<project id>/<task id>"); null with no task open (Empty.vue).
  current: null as string | null,
  // The projects and the window's tabs (the open tasks, each with its agent's state), from the projects' news.
  projects: (initialProjects || { current: null, project: null, projects: [], tabs: [], open: [], settings: false }) as ProjectsInfo,
  // The shown task's profiles, open (as Profile.info) and closed; its terminals' island.
  profiles: [] as Profile[],
  closedProfiles: [] as ClosedProfile[],
  terminals: { front: null, list: [] } as Terminals,
  // The files the agent's tools kept of a task's pages, the newest first (Resources.vue), of the task named.
  artifacts: { task: '', list: [] as Artifact[], bytes: 0 },
  zoom: 1, // the Kulisa zoom
  theme: root.dataset.theme || 'dark', // Dark, Light or System (index.html sets it from the URL before the first paint)
  bar: root.dataset.bar || 'bottom', // where the tasks' bar is
  language: null as LanguageInfo | null, // Kulisa's language (☰ → Language)
  loading: true, // the grid not laid out yet: no grid shown, the pages kept hidden (grid.ts, reveal)
  // Over each pane (by profile id): what the agent does (its caption), Pick's words; whose Pick is on.
  captions: {} as Record<string, string>,
  picking: {} as Record<string, boolean>,
  // Pictures of the pages (by profile id), standing in for the native views while a panel is dragged, a menu is
  // open or another task slides in.
  pictures: {} as Record<string, string>,
});

// The grid laid out or not (grid.ts): the grid's region busy (Grid.vue).
export function setLoading(on: boolean) { store.loading = on; }

// The window's actions on the shown task's profiles and tabs name it, as the grid's layout does: one sent just as the
// human switches tasks is refused, not done in the other one (main/ipc/panes.ts, onScreen).
// The shown task (TaskInfo) and its project, from the window's tabs.
export const shownTask = () => store.projects.tabs.find((t) => t.key === store.current);
const shownProject = () => store.projects.projects.find((p) => p.id === store.projects.project);
type OnTaskChannel = { [C in keyof Invoke]: Invoke[C]['args'] extends [OnTask] ? C : never }[keyof Invoke];
type Rest<C extends OnTaskChannel> = Omit<Invoke[C]['args'][0], 'task'>;
export const act = <C extends OnTaskChannel>(channel: C, ...args: {} extends Rest<C> ? [Rest<C>?] : [Rest<C>]) =>
  kulisa.invoke(channel, ...([{ ...args[0], task: store.current }] as Invoke[C]['args']));

kulisa.on('projects', (info) => {
  store.projects = info;
  store.current = info.current;
});

// What the window shows in the grid's place, one page at a time (docs/tasks.md, The window's pages): the shown task's
// grid; with no task open, every project's tasks (the board); with no project at all, the welcome (what Kulisa does,
// then New Project's steps). Its own switch, not a router's: what is shown is the main process's (current).
export const page = computed(() => (store.current === null ? (store.projects.projects.length ? 'board' : 'welcome') : 'task'));
kulisa.on('closed-profiles', (list) => { store.closedProfiles = list; });
kulisa.on('artifacts', (a) => { store.artifacts = a; });
kulisa.on('zoom', (z) => { store.zoom = z; });
void kulisa.invoke('zoom:get').then((z) => { store.zoom = z; });
kulisa.on('theme', (theme) => { store.theme = theme; });
kulisa.on('bar', (bar) => { store.bar = bar; });
kulisa.on('language', (info) => { store.language = info; });
void kulisa.invoke('language:get').then((info) => { store.language = info; });

// The theme of Kulisa's own UI (app.ts; lib/theme.ts). The tasks' bar
// over the grid or under it. The shown task's project's color for the whole window (--project); none: Kulisa's own colors.
watch(() => store.theme, setTheme);
watch(() => store.bar, (b) => { root.dataset.bar = b; });
watch(() => store.current === null, (none) => root.toggleAttribute('data-noproject', none), { immediate: true });
watch(page, (p) => { root.dataset.page = p; }, { immediate: true });
watch(() => { const p = shownProject(); return p && projectColor(p); }, (color) => {
  if (color) root.style.setProperty('--project', color); else root.style.removeProperty('--project');
  if (color) root.style.setProperty('--glow', color); // the glow's (App.vue): kept when the last task closes, as it fades
}, { immediate: true });

// The agent's activity: a caption over the pane (the cursor itself is drawn inside the page, ghost.ts). A sticky one
// (what highlighted elements are) stays until the next one; the others go after 4 s. Not over a sign-in page, which
// says the agent is paused.
const captionTimers = new Map<string, number>();
kulisa.on('agent', (a) => {
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
  const res = await kulisa.invoke('pick:start', { profile });
  store.picking[profile] = false;
  store.captions[profile] = res && res.error ? `Pick failed: ${res.error}` : '';
}

// Screenshot (⋮ → Screenshot; its key: Element): the picture goes to the clipboard and the OS's folder of screenshots
// (src/screenshots/README.md). Element: chosen as Pick chooses; Esc, Pick or the key again cancels.
export async function screenshot(profile: string, kind: 'element' | 'visible' | 'full') {
  if (store.picking[profile]) return kulisa.invoke('pick:cancel', { profile });
  if (kind === 'element') { store.captions[profile] = 'Click an element for its screenshot · Esc to cancel'; store.picking[profile] = true; }
  const res = await act('tab:screenshot', { profile, kind });
  store.picking[profile] = false;
  store.captions[profile] = refused(res) ? `Screenshot failed: ${res.error}` : res.file ? 'Screenshot copied and saved' : '';
  clearTimeout(captionTimers.get(profile));
  captionTimers.set(profile, window.setTimeout(() => { store.captions[profile] = ''; }, 4000));
}
