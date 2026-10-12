<script setup lang="ts">
// The tasks' bar: an island per group (tasks.md, Projects; docs/window.md, The tasks' bar).
// Every island keeps its width whichever task is shown, so showing one moves none (the author, 2026-10-08: islands that
// moved under the mouse made the human miss). Where a dragged label is let go outside every Kulisa window, the main
// process says (the page does not know where the pointer is then).
import { computed, nextTick, ref, watch } from 'vue';
import TaskTab from './TaskTab.vue';
import { TabsList, TabsRoot } from 'reka-ui';
import NewTask from './NewTask.vue';
import RightClickMenu from './menu/RightClickMenu.vue';
import { store } from '../lib/store';
import ProjectIcon from './ProjectIcon.vue';
import { projectColor } from '../lib/project-color';
import { keyText } from '../lib/common';
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

const showTask = (key: string | number) => { if (key !== store.current) void kulisa.invoke('task:show', String(key)); };
const close = (id: string) => kulisa.invoke('project:close', { id });
const manage = async (id?: string) => (await dialog('projects')).openProjects(id);

// A project's own events, not its tasks' (TaskTab.vue handles those).
const projectOf = (e: Event) => (e.target as Element).closest<HTMLElement>('[data-project]')?.dataset.project;
// The middle button on the label closes the group, as a browser's tab. A new task is the bar's + (NewTask.vue), or
// New Task in the label's menu. Groups do not fold: folding on a click hid the tasks when the label was clicked by the
// way (the author, 2026-10-12).
function auxclick(e: MouseEvent) {
  const id = e.button === 1 && projectOf(e);
  if (id) void close(id);
}
// The bar's right-click menu, for what it was on. A task's tab: the shown one's profiles, Rename…, Show Folder, Delete
// Task…. A project's island: its group's menu. From what the window was last told (store.projects): it opens at once.
function menu(e: MouseEvent): MenuItem[] | null {
  const id = projectOf(e);
  if (!id) return null;
  const t = taskAt(e);
  if (t) return taskMenu(t);
  return groupItems(id);
}
// The task whose tab e was on, from what the window was last told.
function taskAt(e: Event) {
  const key = (e.target as Element).closest<HTMLElement>('.tasktab')?.dataset.task;
  return key && [...store.taskTabs.list, ...store.projects.open.flatMap((o) => o.tasks || [])].find((x) => x.key === key) || null;
}
const rename = async (key: string, name: string) => (await dialog('taskrename')).rename(key, name);
// A double click on a task's tab: its Rename…, as a shortcut to the menu's item (ROADMAP: never the only way).
function dblclick(e: MouseEvent) {
  const t = !(e.target as Element).closest('button') && taskAt(e);
  if (t) void rename(t.key, t.name);
}
// A project's actions in its group's menu, in Chrome's order where Chrome has them (New tab in group … Close group,
// Delete group last).
function groupItems(id: string): MenuItem[] {
  const { open, windows = [] } = store.projects;
  const closed = (open.find((o) => o.id === id)?.tasks || []).filter((x) => x.closed);
  const move = (to: number | null) => kulisa.invoke('project:move', { id, to, terminals: terminalsOf(id) });
  return [{ label: 'New Task', keys: id === store.projects.current ? keyText('task.new') : undefined, run: () => kulisa.invoke('task:new', { project: id }) },
    ...(closed.length ? ['-' as const, { heading: 'Closed tasks' }, ...closed.map((t) => ({ label: t.name, sub: [t.branch, t.merged && 'merged'].filter(Boolean).join(' · ') || undefined, title: t.about,
      remove: { label: 'Delete Task…', run: () => kulisa.invoke('task:delete-closed', { project: id, n: t.n }) },
      run: () => kulisa.invoke('task:open', t.key) }))] : []),
    // Its PR merged, nothing uncommitted: deleting loses nothing (projects.ts, checkMerged).
    ...(closed.some((t) => t.merged) ? [{ label: 'Delete Merged Tasks…', run: () => kulisa.invoke('project:delete-merged', { id }) }] : []),
    // The only tab stays: a new window would be the same as this one.
    '-', { label: 'Move to New Window', enabled: open.length > 1, run: () => move(null) },
    ...windows.map((w) => ({ label: `Move to Window: ${w.names.join(', ')}`, run: () => move(w.id) })),
    '-', { label: 'Project Settings…', run: () => manage(id) },
    { label: 'Show Data Folder', run: () => kulisa.invoke('project:show-data', { id }) },
    '-', { label: 'Close Group', run: () => close(id) }];
}
const taskMenu = ({ key, name }: TaskInfo): MenuItem[] => [
  ...(key === store.current ? [{ heading: 'Profiles' }, ...profilesMenu(), '-' as const] : []),
  { label: 'Rename…', run: () => rename(key, name) },
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
  void kulisa.invoke('project:drop', { id, index: at.index, terminals });
}
// Let go where no Kulisa window took it: outside them all, it goes to a new window there (the main process checks).
function dragend(e: DragEvent) {
  const id = dragged.value;
  dragged.value = null;
  if (id && e.dataTransfer!.dropEffect === 'none') void kulisa.invoke('project:drag-out', { id, terminals: terminalsOf(id) });
}

</script>

<template>
  <footer id="taskbar">
    <!-- Every open project's tasks one strip of tabs (Reka's Tabs): the shown task chosen; a press on another shows it. -->
    <RightClickMenu :items="menu"><TabsRoot as-child :model-value="store.current ?? undefined" activation-mode="manual"
      @update:model-value="showTask"><TabsList as-child :loop="false">
      <nav id="projectTabs" ref="tabs" aria-label="Open projects" @dblclick="dblclick" @auxclick="auxclick"
        @dragstart="dragstart" @dragover="dragover" @dragleave="dragleave" @drop="drop" @dragend="dragend">
      <div v-for="{ o, p, open } in islands" :key="p.id" class="pisland" :data-project="p.id" :title="p.folder || ''" :style="{ '--color': projectColor(p) }"
        :class="{ active: p.id === store.projects.current, dragging: dragged === p.id,
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
      </div>
      </nav>
    </TabsList></TabsRoot></RightClickMenu>
    <NewTask />
  </footer>
</template>

<style>
#taskbar {
  --r: var(--island-radius);
  --edge: 100%; /* the islands' side away from the grid: the curves' centers */
  display: flex; align-items: center; flex: none; align-self: center; max-width: calc(100% - 2 * var(--gap));
  margin-block-end: var(--gap);
  [data-bar="top"] & { --edge: 0%; margin-block-end: 0; }
  #projectTabs { display: flex; gap: calc(2 * var(--r) + var(--gap)); min-width: 0;
    padding-inline: var(--r); /* room for the outer islands' curves */
    overflow-x: auto; scrollbar-width: none; }
  /* As far from the last island's curve as the islands' curves from each other */
  #newTask { margin-inline-start: var(--gap); }
  /* No project open: + alone, in the middle */
  .noproject & { #projectTabs { display: none; } #newTask { margin-inline-start: 0; } }
  /* A project's island. No room on the grid's side (the grid's own gap is there), a gap on the other, 1.7 as
     much on the sides (the author, 2026-10-12). */
  .pisland { display: flex; align-items: center; gap: 2px; flex: 0 1 auto; min-width: 0; position: relative;
    padding: 0 calc(1.7 * var(--gap)) var(--gap); border-radius: 0 0 var(--r) var(--r); background: var(--well);
    &::before, &::after { content: ""; position: absolute; inset-block-start: 0; width: var(--r); aspect-ratio: 1;
      background: radial-gradient(circle at var(--x) var(--edge), transparent var(--r), var(--well) 0); }
    &::before { --x: 0%; inset-inline-end: 100%; }
    &::after { --x: 100%; inset-inline-start: 100%; }
    [data-bar="top"] & { padding-block: var(--gap) 0; border-radius: var(--r) var(--r) 0 0;
      &::before, &::after { inset-block: auto 0; } }
    /* Another project's: the task it comes back to a step brighter. */
    &:not(.active) .selected { color: var(--text-dim); }
    &.active > .plabel { color: var(--text-strong); } }
  /* The label: the project's icon (the app's curtain, in its color) and its name. A tab's height. */
  .plabel { display: flex; align-items: center; gap: 8px; height: var(--tab); padding-inline-end: 8px; color: var(--text-muted);
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
