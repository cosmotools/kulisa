<script setup lang="ts">
// The tasks' bar: a tab per open task, in the bar's order (docs/window.md, The tasks'
// bar). A tab stands for itself: its project is its icon (the author's choice). Every tab keeps its width whichever task is shown, so showing one moves
// none (tabs moving under the mouse make the human miss). Where a dragged tab is let
// go outside every Kulisa window, the main process says (the page does not know where the pointer is then).
// Under the grid, or in the title bar: App.vue puts it in one place or the other (☰ → Tasks bar).
import { computed, ref, watch } from 'vue';
import TaskTab from './TaskTab.vue';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList } from '@/components/ui/tabs';
import RightClickMenu from './menu/RightClickMenu.vue';
import { store } from '../lib/store';
import { projectColor } from '../lib/project-color';
import { keyText, withKeys } from '../lib/common';
import { dialog, openSettings } from '../lib/dialogs';
import { profilesMenu } from '../lib/profiles';
import { terminalsOf } from '../lib/terminals';
import { useStrip } from '../lib/strip';
import type { MenuItem } from '../lib/menu';
import type { ProjectEntry, TaskInfo } from '../../shared/types';
import { PlusIcon } from '@lucide/vue';

const strip = ref<HTMLElement>();
const tabs = computed(() => {
  const byId = new Map(store.projects.projects.map((p) => [p.id, p]));
  return store.projects.tabs.flatMap((t) => { const p = byId.get(t.project); return p ? [{ t, p }] : []; });
});
// More tabs than fit: the wheel scrolls them, the edges with tabs past them fade, the shown one stays in sight
// (lib/strip.ts).
useStrip(strip, () => store.current);

// A press on another tab makes it the chosen one at once, as Chrome's; its task is shown when the button is let go or
// the tab starts being dragged (pointercancel), whichever comes first: the grid's slide that showing it starts makes
// Chromium drop the drag about to begin, so a tab not shown could not be dragged otherwise; one begun goes on
// through the slide. Not on its ×, which closes it (TaskTab.vue), nor the keyboard's, shown at once.
// The pressed tab stays lit until the window is told its task is shown (or it was refused): let go of, it would go dark
// while the main process takes the pictures for the slide and light again with the new state, the tab blinking.
const pressed = ref<string | null>(null);
// The last press's switch: done once the window has taken its grid down (grid:closing comes before the answer).
let showing: Promise<unknown> = Promise.resolve();
watch(() => store.current, (current) => { if (current === pressed.value) pressed.value = null; });
function pointerdown(e: PointerEvent) {
  const at = e.button === 0 && !e.ctrlKey && e.pointerType === 'mouse' && !(e.target as Element).closest('button') && tabAt(e);
  if (!at || at.t.key === store.current) return;
  pressed.value = at.t.key;
  const done = new AbortController(), show = async () => {
    done.abort();
    const r = await (showing = kulisa.invoke('task:show', at.t.key));
    if (r?.error && pressed.value === at.t.key) pressed.value = null;
  };
  for (const type of ['pointerup', 'pointercancel']) addEventListener(type, show, { signal: done.signal });
}
const showTask = (key: string | number) => {
  if (key !== store.current && key !== pressed.value) void kulisa.invoke('task:show', String(key));
};
const manage = (id?: string) => openSettings('projects', id);

// The task whose tab an event was on (TaskTab.vue handles a tab's own clicks).
const tabAt = (e: Event) => { const el = (e.target as Element).closest<HTMLElement>('[data-task]'); return el && tabs.value.find(({ t }) => t.key === el.dataset.task) || null; };
// The middle button on a tab closes the task, as a browser's tab (Close All Tasks is in the menu).
function auxclick(e: MouseEvent) {
  const at = e.button === 1 && tabAt(e);
  if (at) void kulisa.invoke('task:close', at.t.key);
}
// A tab's right-click menu: the shown one's profiles, the repositories it may add, Rename…, Show Folder, Move to
// Window, Close, Delete Task…; then its project's, in a submenu of its name (the project has no label to open it on).
// From what the window was last told (store.projects): it opens at once.
function menu(e: MouseEvent): MenuItem[] | null {
  const at = tabAt(e);
  return at && [...taskMenu(at.t), '-', { submenu: at.p.name, project: at.p, items: projectItems(at.p) }];
}
const rename = async (key: string, name: string) => (await dialog('taskrename')).rename(key, name);
// A double click on a task's tab: its Rename…, as a shortcut to the menu's item (ROADMAP: never the only way). On a
// tab not shown, after its first press has shown it: the grid that goes closes the dialogs open over it.
async function dblclick(e: MouseEvent) {
  const at = !(e.target as Element).closest('button') && tabAt(e);
  if (!at) return;
  await showing.catch(() => {});
  void rename(at.t.key, at.t.name);
}
// Move to New Window, Move to Window: … (one row per other window, named as it names itself: window.ts, label):
// to(null) for a new one. The only tab stays: a new window would be the same as this one.
const moveRows = (to: (id: number | null) => unknown, { enabled = true } = {}): MenuItem[] => [
  { label: 'Move to New Window', enabled: enabled && store.projects.tabs.length > 1, run: () => to(null) },
  ...(store.projects.windows || []).map((w) => ({ label: `Move to Window: ${w.name}`, enabled, run: () => to(w.id) })),
];
const taskMenu = ({ key, name, repos, resources }: TaskInfo): MenuItem[] => [
  ...(key === store.current ? [{ heading: 'Profiles' }, ...profilesMenu(), '-' as const] : []),
  // The project's repositories it has no copy of, one added when its work needs it (tasks.md, Tasks).
  ...(repos.length ? [{ heading: 'Add Repository' }, ...repos.map((r) => ({ label: r.split(/[\\/]/).pop()!, title: r,
    run: () => kulisa.invoke('task:add-repo', { key, repo: r }) })), '-' as const] : []),
  // Those added (removable resources), not the task's own worktree or the main tree: those are not removed here.
  ...(resources.some((r) => r.removable) ? [{ heading: 'Remove Repository' }, ...resources.filter((r) => r.removable)
    .map((r) => ({ label: r.label, title: r.folder, run: () => kulisa.invoke('task:remove-repo', { key, repo: r.folder }) })), '-' as const] : []),
  { label: 'Rename…', run: () => rename(key, name) },
  { label: 'Show Folder', run: () => kulisa.invoke('task:show-folder', key) },
  '-', ...moveRows((to) => kulisa.invoke('task:move', { key, to, terminals: terminalsOf(key) })),
  '-', { label: 'Close', run: () => kulisa.invoke('task:close', key) },
  { label: 'Delete Task…', run: () => kulisa.invoke('task:delete', key) },
];
// A project's rows (its submenu): what is not one task's. Its closed tasks are the sidebar's. Move All Tasks: its
// open tasks of this window, together.
function projectItems(p: ProjectEntry): MenuItem[] {
  const id = p.id, mine = store.projects.tabs.filter((t) => t.project === id);
  const merged = p.tasks.some((t) => t.closed && t.merged); // its PR merged, nothing uncommitted: deleting loses nothing (projects.ts, checkMerged)
  const terminals = () => Object.assign({}, ...mine.map((t) => terminalsOf(t.key)));
  return [{ label: 'New Task', keys: id === store.projects.project ? keyText('task.new') : undefined, run: () => kulisa.invoke('task:new', { project: id }) },
    '-', ...moveRows((to) => kulisa.invoke('project:move-all', { id, to, terminals: terminals() }), { enabled: mine.length < store.projects.tabs.length })
      .map((r) => (typeof r === 'object' && 'label' in r ? { ...r, label: r.label.replace('Move to', 'Move All Tasks to') } : r)),
    '-', { label: 'Project Settings…', run: () => manage(id) },
    { label: 'Show Data Folder', run: () => kulisa.invoke('project:show-data', { id }) },
    ...(merged ? [{ label: 'Delete Merged Tasks…', run: () => kulisa.invoke('project:delete-merged', { id }) }] : []),
    '-', { label: 'Close All Tasks', run: () => kulisa.invoke('project:close-tasks', { id }) }];
}

// HTML drag and drop, which also crosses windows. The tab carries its task and what its terminals show (the window it
// goes to has neither), as a type of Kulisa's own: a page under the pointer takes nothing from it.
const DRAG = 'application/x-kulisa-task';
const dragged = ref<string | null>(null); // the task dragged from this window
const mark = ref<{ key: string; side: 'before' | 'after' } | null>(null); // where a dropped one would go
// Where a tab let go at e goes: before or after the tab under the pointer; the index among this window's.
function dropAt(e: DragEvent) {
  const tab = (e.target as Element).closest?.<HTMLElement>('[data-task]');
  if (!tab) return null;
  const r = tab.getBoundingClientRect(), side = e.clientX < r.x + r.width / 2 ? 'before' as const : 'after' as const;
  return { key: tab.dataset.task!, side, index: [...strip.value!.children].indexOf(tab) + Number(side === 'after') };
}
function dragstart(e: DragEvent) {
  const at = tabAt(e);
  if (!at) return;
  dragged.value = at.t.key;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData(DRAG, JSON.stringify({ key: at.t.key, terminals: terminalsOf(at.t.key) }));
}
function dragover(e: DragEvent) {
  const at = e.dataTransfer!.types.includes(DRAG) && dropAt(e);
  if (!at) { mark.value = null; return; }
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  mark.value = { key: at.key, side: at.side };
}
const dragleave = (e: DragEvent) => { if (!strip.value!.contains(e.relatedTarget as Node)) mark.value = null; };
function drop(e: DragEvent) {
  const at = dropAt(e), data = e.dataTransfer!.getData(DRAG);
  mark.value = null;
  if (!at || !data) return;
  e.preventDefault();
  const { key, terminals } = JSON.parse(data);
  void kulisa.invoke('task:drop', { key, index: at.index, terminals });
}
// Let go where no Kulisa window took it: outside them all, it goes to a new window there (the main process checks).
function dragend(e: DragEvent) {
  const key = dragged.value;
  dragged.value = null;
  if (key && e.dataTransfer!.dropEffect === 'none') void kulisa.invoke('task:drag-out', { key, terminals: terminalsOf(key) });
}
const shown = computed(() => tabs.value.find(({ t }) => t.key === store.current)?.p);
</script>

<template>
  <!-- Under the grid: the window's last row. In the title bar (TopBar.vue): after the logo, where a browser's tabs are;
       not a handle to drag the window by (the window is dragged after it). -->
  <nav id="taskbar" aria-label="Open tasks" class="flex min-w-0 items-center gap-1" :class="store.bar === 'top' ? '[-webkit-app-region:no-drag]' : 'h-11 border-t px-2'">
    <!-- Every open task a tab (shadcn-vue's Tabs): the shown one chosen, or the one pressed until it is shown; a press on
         another shows it. More than fit scroll (lib/strip.ts), their edges faded; the shown one kept clear of a fade. -->
    <RightClickMenu :items="menu"><Tabs class="min-w-0" :model-value="(pressed ?? store.current) ?? undefined" activation-mode="manual" @update:model-value="showTask">
      <TabsList as-child :loop="false" class="no-scrollbar max-w-full scroll-fade-x scroll-px-10 justify-start overflow-x-auto">
        <div id="projectTabs" ref="strip" @dblclick="dblclick" @auxclick="auxclick" @pointerdown="pointerdown"
          @dragstart="dragstart" @dragover="dragover" @dragleave="dragleave" @drop="drop" @dragend="dragend">
          <TaskTab v-for="{ p, t } in tabs" :key="t.key" :t :p :data-project="p.id" :style="{ '--color': projectColor(p) }"
            draggable="true" :data-dragging="dragged === t.key || undefined" :data-drop="mark?.key === t.key ? mark.side : undefined" />
        </div>
      </TabsList>
    </Tabs></RightClickMenu>
    <!-- A new task of the shown one's project, at once; another project's: the sidebar -->
    <Button id="newTask" variant="ghost" size="icon-sm" :title="withKeys(`New task of ${shown?.name ?? 'the project'}`, 'task.new')" aria-label="New task"
      @click="kulisa.invoke('task:new')"><PlusIcon /></Button>
  </nav>
</template>
