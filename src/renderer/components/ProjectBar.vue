<script setup lang="ts">
// The projects' bar, under the grid or over it (☰), an island per open project, drawn as Chrome's tab groups: its
// label (its icon, the curtain in its color, and its name), its open tasks' tabs (TaskTab.vue), a click on one showing
// that project with it (the others keep running: their agents and pages), and + for a new task from the project's
// configuration (its right-click: New Task with one of its agents). A click on the label folds the group to it (the
// shown task's tab stays) and back. A right-click opens its group's panel, as Chrome's (GroupPanel.vue): its name,
// color and icon, then New Task, its closed tasks (one opens again), Move to New Window (a window of its own, e.g. for
// a second monitor; it keeps running), Move to Window (each other window; as a browser moves a tab), Project
// Settings…, Show Data Folder, Close Project (asking first; also the middle button), Delete Project…; a task's tab: the shown
// one's profiles, Rename… (its name and branch), Show Folder, Delete Task…. Dragging the label does
// the same: within the bar it changes the order, onto another window's bar it moves the project there, let go outside
// every Kulisa window it opens a window there (the main process tells where the pointer is). The button after the
// islands opens the menu of the projects (as Chrome's Tab groups: open one, delete one with its ×, Projects…, New
// Project…; one open in another window is shown there). Removing a project is asked for from either (the main process
// asks the human and does it: deleteProject).
// Each island looks like a tab of the grid: square where it meets the grid and merging into it with curves, rounded
// towards the window's edge. Every island keeps its width whichever project is shown, so showing one moves none (the
// author, 2026-10-08: islands that moved under the mouse made the human miss). Many shrink, then the bar scrolls.
import { computed, nextTick, ref, watch } from 'vue';
import Icon from './Icon.vue';
import TaskTab from './TaskTab.vue';
import GroupPanel from './GroupPanel.vue';
import { TabsList, TabsRoot } from 'reka-ui';
import ButtonMenu from './menu/ButtonMenu.vue';
import RightClickMenu from './menu/RightClickMenu.vue';
import { store } from '../lib/store';
import ProjectIcon from './ProjectIcon.vue';
import { keyText, withKeys } from '../lib/common';
import { dialog } from '../lib/dialogs';
import { profilesMenu } from '../lib/profiles';
import { terminalsOf } from '../lib/terminals';
import type { MenuItem } from '../lib/menu';
import type { TaskInfo } from '../types';

const tabs = ref<HTMLElement>();
const islands = computed(() => {
  const byId = new Map(store.projects.projects.map((p) => [p.id, p]));
  return store.projects.open.filter((o) => byId.has(o.id)).map((o) => ({ o, p: byId.get(o.id)!, open: (o.tasks || []).filter((t) => !t.closed) }));
});
// The shown one in sight.
watch(() => store.projects, () => nextTick(() => tabs.value?.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })));

const showTask = (key: string | number) => { if (key !== store.current) kulisa.invoke('task:show', String(key)); };
const remove = (id: string) => kulisa.invoke('project:delete', { id });
const openProject = (id: string) => kulisa.invoke('project:open', { id });
const close = (id: string) => kulisa.invoke('project:close', { id });
const manage = async (id?: string) => (await dialog('projects')).openProjects(id);
const create = async () => (await dialog('projects')).newProject();

// A project's own events, not its tasks' (TaskTab.vue handles those).
const projectOf = (e: Event) => (e.target as Element).closest<HTMLElement>('[data-project]')?.dataset.project;
// The label folds the group to it and back, as Chrome's tab groups; + makes a task. The middle button on the label
// closes the project, as a browser's tab.
function click(e: MouseEvent) {
  const id = projectOf(e), target = e.target as Element;
  if (!id) return;
  if (target.closest('.add')) kulisa.invoke('task:new', { project: id });
  else if (target.closest('.plabel')) kulisa.invoke('project:collapse', { id, collapsed: !target.closest('.pisland')!.classList.contains('collapsed') });
}
function auxclick(e: MouseEvent) {
  const id = e.button === 1 && projectOf(e);
  if (id) close(id);
}
// The bar's right-click menu, for what it was on. A task's tab: the shown one's profiles, Rename…, Show Folder, Delete
// Task…. +: New Task with each of its agents, the default first (what + itself runs). A project's island: no menu, its
// group's panel. From what the window was last told (store.projects): it opens at once.
function menu(e: MouseEvent): MenuItem[] | null {
  const id = projectOf(e), target = e.target as Element;
  if (!id) return null;
  const { open } = store.projects;
  const key = target.closest<HTMLElement>('.tasktab')?.dataset.task;
  const t = key && [...store.taskTabs.list, ...open.flatMap((o) => o.tasks || [])].find((x) => x.key === key);
  if (t) return taskMenu(t);
  if (target.closest('.add')) {
    const agents = open.find((o) => o.id === id)?.agents || [];
    return agents.length ? [{ heading: 'New Task with' }, ...agents.map((a, i) => ({ label: a.name, sub: i ? undefined : 'the default',
      run: () => kulisa.invoke('task:new', { project: id, agent: a.id }) }))]
      : [{ note: 'No agents: add them in Project Settings…' }, { label: 'Project Settings…', run: () => manage(id) }];
  }
  panel.value!.openAt(id, target.closest('.pisland')!.querySelector<HTMLElement>('.plabel')!, groupItems(id));
  return null;
}
// A project's actions in its group's panel, in Chrome's order where Chrome has them (New tab in group … Close group,
// Delete group last).
function groupItems(id: string): MenuItem[] {
  const { open, windows = [] } = store.projects;
  const closed = (open.find((o) => o.id === id)?.tasks || []).filter((x) => x.closed);
  const move = (to: number | null) => kulisa.invoke('project:move', { id, to, terminals: terminalsOf(id) });
  return [{ label: 'New Task', keys: id === store.projects.current ? keyText('task.new') : undefined, run: () => kulisa.invoke('task:new', { project: id }) },
    ...(closed.length ? ['-' as const, { heading: 'Closed tasks' }, ...closed.map((t) => ({ label: t.name, sub: [t.branch, t.merged && 'merged'].filter(Boolean).join(' · ') || undefined,
      run: () => kulisa.invoke('task:open', t.key) }))] : []),
    // Its PR merged, nothing uncommitted: deleting loses nothing (projects.js, checkMerged).
    ...(closed.some((t) => t.merged) ? [{ label: 'Delete Merged Tasks…', run: () => kulisa.invoke('project:delete-merged', { id }) }] : []),
    // The only tab stays: a new window would be the same as this one.
    '-', { label: 'Move to New Window', enabled: open.length > 1, run: () => move(null) },
    ...windows.map((w) => ({ label: `Move to Window: ${w.names.join(', ')}`, run: () => move(w.id) })),
    '-', { label: 'Project Settings…', run: () => manage(id) },
    { label: 'Show Data Folder', run: () => kulisa.invoke('project:show-data', { id }) },
    '-', { label: 'Close Project', run: () => close(id) },
    { label: 'Delete Project…', run: () => remove(id) }];
}
const panel = ref<InstanceType<typeof GroupPanel>>();
const taskMenu = ({ key, name }: TaskInfo): MenuItem[] => [
  ...(key === store.current ? [{ heading: 'Profiles' }, ...profilesMenu(), '-' as const] : []),
  { label: 'Rename…', run: async () => (await dialog('taskrename')).rename(key, name) },
  { label: 'Show Folder', run: () => kulisa.invoke('task:show-folder', key) },
  '-', { label: 'Delete Task…', run: () => kulisa.invoke('task:delete', key) },
];

// HTML drag and drop, which also crosses windows. The island carries its project and what its terminals show (the
// window it goes to has neither), as a type of Kulisa's own: a page under the pointer takes nothing from it.
const DRAG = 'application/x-kulisa-project';
const dragged = ref<string | null>(null); // the project dragged from this window
const mark = ref<{ id: string; side: 'before' | 'after' } | null>(null); // where a dropped one would go
// Where an island let go at e goes: before or after the island under the pointer; the index among this window's.
function dropAt(e: DragEvent) {
  const tab = (e.target as Element).closest?.<HTMLElement>('[data-project]');
  if (!tab) return null;
  const r = tab.getBoundingClientRect(), side = e.clientX < r.x + r.width / 2 ? 'before' as const : 'after' as const;
  return { id: tab.dataset.project!, side, index: [...tabs.value!.children].indexOf(tab) + Number(side === 'after') };
}
function dragstart(e: DragEvent) {
  const id = projectOf(e);
  if (!id) return;
  dragged.value = id;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData(DRAG, JSON.stringify({ id, terminals: terminalsOf(id) }));
}
function dragover(e: DragEvent) {
  const at = e.dataTransfer!.types.includes(DRAG) && dropAt(e);
  if (!at) { mark.value = null; return; }
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  mark.value = { id: at.id, side: at.side };
}
const dragleave = (e: DragEvent) => { if (!tabs.value!.contains(e.relatedTarget as Node)) mark.value = null; };
function drop(e: DragEvent) {
  const at = dropAt(e), data = e.dataTransfer!.getData(DRAG);
  mark.value = null;
  if (!at || !data) return;
  e.preventDefault();
  const { id, terminals } = JSON.parse(data);
  kulisa.invoke('project:drop', { id, index: at.index, terminals });
}
// Let go where no Kulisa window took it: outside them all, it goes to a new window there (the main process checks).
function dragend(e: DragEvent) {
  const id = dragged.value;
  dragged.value = null;
  if (id && e.dataTransfer!.dropEffect === 'none') kulisa.invoke('project:drag-out', { id, terminals: terminalsOf(id) });
}

function projectsMenu(): MenuItem[] {
  const { current, projects, open, elsewhere = [] } = store.projects;
  const isOpen = (id: string) => open.some((o) => o.id === id) || elsewhere.includes(id);
  return [
    ...projects.map((p) => ({ label: p.name, sub: p.folder, color: p.color, ...(isOpen(p.id) ? { keys: '✓' } : {}),
      ...(p.id === current ? {} : { run: () => (isOpen(p.id) ? kulisa.invoke('project:show', { id: p.id }) : openProject(p.id)) }),
      remove: { title: 'Delete project…', run: () => remove(p.id) } })),
    '-',
    { label: 'Projects…', run: () => manage() },
    { label: 'New Project…', run: create },
    ...(current === null ? [] : ['-' as const, { label: 'Close Project', run: () => close(current) },
      { label: 'Delete Project…', run: () => remove(current) }]),
  ];
}
</script>

<template>
  <footer id="projectbar">
    <!-- Every open project's tasks one strip of tabs (Reka's Tabs): the shown task chosen; a press on another shows it. -->
    <RightClickMenu :items="menu"><TabsRoot as-child :model-value="store.current ?? undefined" activation-mode="manual"
      @update:model-value="showTask"><TabsList as-child :loop="false">
      <nav id="projectTabs" ref="tabs" aria-label="Open projects" @click="click" @auxclick="auxclick"
        @dragstart="dragstart" @dragover="dragover" @dragleave="dragleave" @drop="drop" @dragend="dragend">
      <div v-for="{ o, p, open } in islands" :key="p.id" class="pisland" :data-project="p.id" :title="p.folder || ''" :style="{ '--color': p.color }"
        :class="{ active: p.id === store.projects.current, collapsed: !!o.collapsed, dragging: dragged === p.id,
                  'drop-before': mark?.id === p.id && mark.side === 'before', 'drop-after': mark?.id === p.id && mark.side === 'after' }">
        <div class="plabel" draggable="true">
          <ProjectIcon :p />
          <span class="name">{{ p.name }}</span>
        </div>
        <!-- The shown project's tasks live, the others' as tabs to show them with; closed ones are in its label's menu. -->
        <nav v-if="p.id === store.projects.current" id="tasks" aria-label="Tasks of the project">
          <div id="tasklist"><TaskTab v-for="t in store.taskTabs.list" :key="t.key" :t :active="t.key === store.taskTabs.active" :selected="t.key === store.taskTabs.active" /></div>
        </nav>
        <TaskTab v-for="t in open" v-else :key="t.key" :t :active="false" :selected="t.key === o.task" />
        <button class="add icon" :title="withKeys('New task: its own copy of the code, branch, agent and profiles', 'task.new')" aria-label="New task"><Icon name="i-plus" /></button>
      </div>
      </nav>
    </TabsList></TabsRoot></RightClickMenu>
    <GroupPanel ref="panel" />
    <ButtonMenu :items="projectsMenu"><button id="openProjects" class="icon" title="Projects: open another, New Project…" aria-label="Projects"><Icon name="i-projects" /></button></ButtonMenu>
  </footer>
</template>

<style>
#projectbar {
  --r: var(--island-radius);
  --edge: 100%; /* the islands' side away from the grid: the curves' centers */
  display: flex; align-items: center; flex: none; align-self: center; max-width: calc(100% - 2 * var(--gap));
  margin-block-end: var(--gap);
  .noproject & { display: none; }
  [data-bar="top"] & { --edge: 0%; margin-block-end: 0; }
  #projectTabs { display: flex; gap: calc(2 * var(--r) + var(--gap)); min-width: 0;
    padding-inline: var(--r); /* room for the outer islands' curves */
    overflow-x: auto; scrollbar-width: none; }
  /* As far from the last island's curve as the islands' curves from each other */
  #openProjects { margin-inline-start: var(--gap); }
  /* A project's island. Its tabs in the middle of the dark: no room on the grid's side (the grid's own gap is
     there), as much on the other. */
  .pisland { display: flex; align-items: center; gap: 2px; flex: 0 1 auto; min-width: 0; position: relative;
    padding: 0 4px var(--gap); border-radius: 0 0 var(--r) var(--r); background: var(--well);
    &::before, &::after { content: ""; position: absolute; inset-block-start: 0; width: var(--r); aspect-ratio: 1;
      background: radial-gradient(circle at var(--x) var(--edge), transparent var(--r), var(--well) 0); }
    &::before { --x: 0%; inset-inline-end: 100%; }
    &::after { --x: 100%; inset-inline-start: 100%; }
    [data-bar="top"] & { padding-block: var(--gap) 0; border-radius: var(--r) var(--r) 0 0;
      &::before, &::after { inset-block: auto 0; } }
    /* Another project's: the task it comes back to a step brighter. */
    &:not(.active) .selected { color: var(--text-dim); }
    &.active > .plabel { color: var(--text-strong); }
    /* Folded to its label, as a collapsed tab group: only the tab of the task it shows stays. */
    &.collapsed .tasktab:not(.active, .selected) { display: none; } }
  /* The label: the project's icon (the app's curtain, in its color) and its name. */
  .plabel { display: flex; align-items: center; gap: 8px; padding-inline: 8px; color: var(--text-muted);
    font-weight: 600; white-space: nowrap; cursor: default;
    svg, .favicon { width: 20px; height: 20px; color: var(--color); } }
  /* An island being dragged; where a dropped one would go. */
  .dragging { opacity: .5; }
  .drop-before { box-shadow: inset 2px 0 var(--accent); }
  .drop-after { box-shadow: inset -2px 0 var(--accent); }
}
/* The shown project's tasks: in its island, their tabs laid out as the other islands' tabs. */
#tasks, #tasklist { display: contents; }
</style>
