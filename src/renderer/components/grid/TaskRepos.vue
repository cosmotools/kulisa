<script setup lang="ts">
// The shown task's repositories at the end of its terminals' row (docs/window.md, The terminal).
import { computed, reactive, watch } from 'vue';
import Icon from '../Icon.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { shownTask } from '../../lib/store';

const task = computed(shownTask);
// Shown in a project of several repositories only: with one there is nothing to tell.
const shown = computed(() => !!task.value && task.value.copies.length + task.value.repos.length > 1);
const fresh = reactive(new Set<string>());
// Only a copy the same task got: another task shown is no news.
watch(() => [task.value?.key, task.value?.copies.map((c) => c.folder) || []] as const, ([key, now], [was, before]) => {
  if (key !== was) return;
  for (const f of now.filter((x) => !before.includes(x))) { fresh.add(f); setTimeout(() => fresh.delete(f), 1800); }
});
// An added one goes as on the task's tab (Remove Repository); its own folder goes only with the task.
const menu = (e: MouseEvent) => {
  const t = task.value, folder = (e.target as Element).closest<HTMLElement>('.chip')?.dataset.folder;
  return t && folder && folder !== t.folder ? [{ label: 'Remove Repository', run: () => kulisa.invoke('task:remove-repo', { key: t.key, repo: folder }) }] : null;
};
</script>

<template>
  <RightClickMenu v-if="shown" :items="menu"><div class="taskrepos" aria-label="The task's repositories">
    <span v-for="c in task!.copies" :key="c.folder" class="chip" :class="{ fresh: fresh.has(c.folder) }" :data-folder="c.folder"
      :title="`${c.folder}, branch ${c.branch}`"><Icon name="i-git" /><span class="name">{{ c.name }}</span></span>
  </div></RightClickMenu>
</template>

<style>
/* It gives way before the terminals' tabs do: its chips' names are cut, the whole in their tooltips. */
.taskrepos { display: flex; align-items: center; gap: 4px; margin-inline-start: auto; min-width: 0;
  .chip.fresh { animation: repo-in 1.8s ease-out; } }
/* It comes in from the right, grows past its size and settles, lit in the accent color, which fades. */
@keyframes repo-in {
  0% { transform: translateX(24px) scale(0.4); opacity: 0; background: var(--accent); color: var(--on-accent); }
  20% { transform: none; opacity: 1; }
  30% { transform: scale(1.15); background: var(--accent); color: var(--on-accent); }
  45% { transform: none; }
}
@media (prefers-reduced-motion: reduce) { .taskrepos .chip.fresh { animation: none; } }
</style>
