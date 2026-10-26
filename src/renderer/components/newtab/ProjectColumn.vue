<script setup lang="ts">
// A project's column (Board.vue): its name with + (a new task of it), then its tasks: those open first, shown and not
// to choose ("open": in this window's tabs or another's), then those closed, the one closed last first, each opened
// again with a click, deleted with its 🗑 (or Delete) after Delete Task…'s question.
import { computed } from 'vue';
import Icon from '../Icon.vue';
import ProjectIcon from '../ProjectIcon.vue';
import { projectColor } from '../../lib/project-color';
import { taskLine } from '../../lib/common';
import type { ProjectEntry, ProjectTask } from '../../../shared/types';

const { p } = defineProps<{ p: ProjectEntry }>();
const tasks = computed(() => [...p.tasks.filter((t) => !t.closed), ...p.tasks.filter((t) => t.closed)]); // closed: the last first (main)
const newTask = () => kulisa.invoke('project:open', { id: p.id });
const open = (t: ProjectTask) => { if (t.closed) void kulisa.invoke('project:open', { id: p.id, task: t.id }); };
const remove = (t: ProjectTask) => kulisa.invoke('task:delete-closed', { project: p.id, id: t.id });
</script>

<template>
  <section class="column" :data-project="p.id" :aria-label="p.name" :style="{ '--color': projectColor(p) }">
    <header><ProjectIcon :p /><span class="name" :title="p.folders[0]">{{ p.name }}</span>
      <button class="icon small" type="button" :title="`New Task of ${p.name}`" aria-label="New Task" @click="newTask"><Icon name="i-plus" /></button></header>
    <ul>
      <!-- A row is no <button>: its 🗑 is one, and a button holds no other -->
      <li v-for="t in tasks" :key="t.id"><div class="item" :data-task="`${p.id}/${t.id}`" role="button" :aria-label="t.name"
        :tabindex="t.closed ? 0 : -1" :aria-disabled="!t.closed" :title="t.name"
        @click="open(t)" @keydown.enter.space.prevent="open(t)" @keydown.delete="t.closed && remove(t)">
        <span class="text"><span class="label">{{ t.name }}</span><small>{{ taskLine(t) }}</small></span>
        <kbd v-if="!t.closed">open</kbd><kbd v-else-if="t.merged">merged</kbd>
        <button v-if="t.closed" type="button" class="remove icon quiet small" tabindex="-1" aria-label="Delete Task…" title="Delete Task…" @click.stop="remove(t)"><Icon name="i-trash" /></button>
      </div></li>
      <li v-if="!tasks.length" class="empty">No tasks yet</li>
    </ul>
  </section>
</template>

<style>
/* A project's column: an island, as the grid's panels, its tasks' rows as a menu's */
#board .column { flex: none; display: flex; flex-direction: column; width: 280px; max-height: 100%; border-radius: var(--island-radius); background: var(--island);
  header { display: flex; align-items: center; gap: var(--inset); padding: var(--inset); border-bottom: 1px solid var(--island-hi);
    .picon { width: 20px; height: 20px; color: var(--color); } .name { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
  ul { margin: 0; padding: 4px; list-style: none; overflow: auto; }
  .item { border-radius: var(--corner); &[aria-disabled="true"] { opacity: .6; &:hover { background: none; } } }
  .empty { padding: var(--inset); color: var(--text-dim); }
}
</style>
