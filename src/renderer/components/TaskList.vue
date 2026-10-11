<script setup lang="ts">
// Every project's tasks, grouped by project, under a search field: the bar's Search Tasks panel's (TaskSearch.vue; the
// author, 2026-10-11: the bar's tabs are tasks, so what lists things to open lists tasks; a project is no thing to
// open). Each project's heading in its color (a label, not a row), its tasks under it (the open ones, then the closed
// ones, the one closed last first; a click shows it in its group's window, a closed one opened again, in a group of its
// own in this window when its project has none here or elsewhere), New Task last. Reka's Listbox: ↑↓ through the rows,
// Enter opens, while the keyboard stays in the search field. The search finds a task by its name or branch, a project
// by its name (then all its tasks).
//   <TaskList @chosen="…" />   chosen: a row was opened (the panel closes)
import { computed, ref } from 'vue';
import { ListboxContent, ListboxFilter, ListboxGroup, ListboxGroupLabel, ListboxItem, ListboxRoot, useFilter } from 'reka-ui';
import ProjectIcon from './ProjectIcon.vue';
import { store } from '../lib/store';
import type { ProjectTask } from '../types';

const emit = defineEmits<{ chosen: [] }>();
const query = ref('');
const { contains } = useFilter({ sensitivity: 'base' });
const groups = computed(() => {
  const q = query.value.trim();
  return store.projects.projects.map((p) => (!q || contains(p.name, q) ? { p, tasks: p.tasks, all: true }
    : { p, tasks: p.tasks.filter((t) => contains(t.name, q) || (!!t.branch && contains(t.branch, q))), all: false }))
    .filter((g) => g.all || g.tasks.length);
});
const about = (t: ProjectTask) => [t.branch !== t.name && t.branch, t.closed && 'closed', t.merged && 'merged'].filter(Boolean).join(' · ');
// Opened, not chosen: the list keeps no selection.
function open(e: Event, id: string, task?: number) {
  e.preventDefault();
  emit('chosen');
  kulisa.invoke('project:open', { id, task });
}
</script>

<template>
  <ListboxRoot class="tasklist" highlight-on-hover aria-label="Tasks">
    <ListboxFilter v-model="query" class="tlsearch" auto-focus placeholder="Search tasks" spellcheck="false" aria-label="Search tasks" />
    <ListboxContent class="tlrows">
      <ListboxGroup v-for="{ p, tasks, all } in groups" :key="p.id" class="tlgroup" :data-project="p.id" :style="{ '--color': p.color }">
        <ListboxGroupLabel class="item tlproject" :title="p.folder"><ProjectIcon :p /><span class="text"><span class="label">{{ p.name }}</span></span></ListboxGroupLabel>
        <ListboxItem v-for="t in tasks" :key="t.n" :value="`${p.id}/${t.n}`" class="item tltask" :class="{ closed: t.closed }" :data-task="t.n"
          @select="open($event, p.id, t.n)"><span class="text"><span class="label">{{ t.name }}</span><small>{{ about(t) }}</small></span></ListboxItem>
        <ListboxItem v-if="all" :value="`${p.id}/new`" class="item tltask tlnew" @select="open($event, p.id)"><span
          class="text"><span class="label">New Task</span><small>{{ p.tasks.length ? '' : 'No tasks yet' }}</small></span></ListboxItem>
      </ListboxGroup>
      <p v-if="!groups.length" class="tlnone">{{ query.trim() ? 'No task or project has that name' : 'No projects yet' }}</p>
    </ListboxContent>
  </ListboxRoot>
</template>

<style>
/* Each project's heading in its color, its tasks under it, set in to its name; rows as a menu's but roomier; the rows
   scroll when they are many */
.tasklist { display: flex; flex-direction: column; gap: var(--gap); min-height: 0;
  .tlsearch { width: 100%; }
  .tlrows { display: flex; flex-direction: column; gap: var(--gap); min-height: 0; overflow: auto; }
  .tlgroup { display: flex; flex-direction: column; gap: 2px; }
  .item { gap: 12px; padding: 8px 14px; border-radius: var(--radius); .text { gap: 3px; } }
  .tlproject { &:hover { background: none; } .label { color: var(--text-strong); font-weight: 600; } }
  .tltask { padding-inline-start: calc(14px + 20px + 12px); .label { color: var(--text-strong); } &.closed .label { color: var(--text); } }
  .tlnew .label { color: var(--text-dim); }
  .picon { flex: none; width: 20px; height: 20px; color: var(--color); }
  .tlnone { margin: 0; padding: 8px 14px; color: var(--text-muted); }
}
</style>
