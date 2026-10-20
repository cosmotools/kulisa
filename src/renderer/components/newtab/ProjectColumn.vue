<script setup lang="ts">
// A project's column (Board.vue): its name with + (a new task of it), then its tasks: those open first, shown and not
// to choose ("open": in this window's tabs or another's), then those closed, the one closed last first, each opened
// again with a click, deleted with its 🗑 (or Delete) after Delete Task…'s question; under them its tasks on the human's
// other computers (partners.ts: their cards on the remote, fetched as the board shows), each joined with a click.
import { computed, onMounted, ref } from 'vue';
import Icon from '../Icon.vue';
import ProjectIcon from '../ProjectIcon.vue';
import { projectColor } from '../../lib/project-color';
import { ago } from '../../lib/common';
import { dialog } from '../../lib/dialogs';
import RightClickMenu from '../menu/RightClickMenu.vue';
import type { ProjectEntry, ProjectTask, TaskElsewhere } from '../../../shared/types';

const { p } = defineProps<{ p: ProjectEntry }>();
const tasks = computed(() => [...p.tasks.filter((t) => !t.closed), ...p.tasks.filter((t) => t.closed)]); // closed: the last first (main)
const line = (t: ProjectTask) => [t.branch && t.branch !== t.name && t.branch, t.closed ? ago(t.closedAt) : ''].filter(Boolean).join(' · ');
const newTask = () => kulisa.invoke('project:open', { id: p.id });
// Its right-click: a new task, or one on a branch there is already.
const headerMenu = () => [{ label: 'New Task', run: newTask }, { label: 'New Task from a Branch…', run: () => dialog('frombranch').then((d) => d.open(p.id, p.name)) }];
const open = (t: ProjectTask) => { if (t.closed) void kulisa.invoke('project:open', { id: p.id, task: t.n }); };
const remove = (t: ProjectTask) => kulisa.invoke('task:delete-closed', { project: p.id, n: t.n });
const away = ref<TaskElsewhere[]>([]);
onMounted(async () => { away.value = await kulisa.invoke('project:elsewhere', { id: p.id }); });
const OS = { linux: 'Linux', macos: 'macOS', windows: 'Windows' } as const;
const where = (t: TaskElsewhere) => [t.computers.map((c) => `${c.name} (${OS[c.os]})${c.roles.length ? `: ${c.roles.join(', ')}` : ''}`).join('; '), ago(t.at)].join(' · ');
const join = (t: TaskElsewhere) => kulisa.invoke('project:open', { id: p.id, branch: t.branch, join: true });
</script>

<template>
  <section class="column" :data-project="p.id" :style="{ '--color': projectColor(p) }">
    <RightClickMenu :items="headerMenu"><header><ProjectIcon :p /><span class="name" :title="p.folder">{{ p.name }}</span>
      <button class="icon small" type="button" :title="`New Task of ${p.name}`" aria-label="New Task" @click="newTask"><Icon name="i-plus" /></button></header></RightClickMenu>
    <ul>
      <!-- A row is no <button>: its 🗑 is one, and a button holds no other -->
      <li v-for="t in tasks" :key="t.n"><div class="item" :class="{ open: !t.closed }" :data-task="`${p.id}/${t.n}`" role="button"
        :tabindex="t.closed ? 0 : -1" :aria-disabled="!t.closed" :title="t.about || t.name"
        @click="open(t)" @keydown.enter.space.prevent="open(t)" @keydown.delete="t.closed && remove(t)">
        <span class="text"><span class="label">{{ t.name }}</span><small>{{ line(t) }}</small></span>
        <kbd v-if="!t.closed">open</kbd><kbd v-else-if="t.merged">merged</kbd>
        <button v-if="t.closed" type="button" class="remove icon quiet small" tabindex="-1" aria-label="Delete Task…" title="Delete Task…" @click.stop="remove(t)"><Icon name="i-trash" /></button>
      </div></li>
      <li v-if="!tasks.length" class="empty">No tasks yet</li>
      <template v-if="away.length">
        <li class="heading">On Your Other Computers</li>
        <li v-for="t in away" :key="t.branch"><div class="item away" :data-branch="t.branch" role="button" tabindex="0" :title="`Join Task: work on it here too, on its branch ${t.branch}`"
          @click="join(t)" @keydown.enter.space.prevent="join(t)">
          <span class="text"><span class="label">{{ t.name }}</span><small>{{ where(t) }}</small></span><kbd>join</kbd>
        </div></li>
      </template>
    </ul>
  </section>
</template>

<style>
/* A project's column: an island, as the grid's panels, its tasks' rows as a menu's */
#board .column { flex: none; display: flex; flex-direction: column; width: 280px; max-height: 100%; border-radius: var(--island-radius); background: var(--island);
  header { display: flex; align-items: center; gap: var(--inset); padding: var(--inset); border-bottom: 1px solid var(--island-hi);
    .picon { width: 20px; height: 20px; color: var(--color); } .name { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
  ul { margin: 0; padding: 4px; list-style: none; overflow: auto; }
  .item { border-radius: var(--radius); &.open { opacity: .6; &:hover { background: none; } } }
  .empty { padding: var(--inset); color: var(--text-dim); }
  .heading { padding: var(--inset) var(--inset) 4px; color: var(--text-muted); font-size: var(--font-small); }
}
</style>
