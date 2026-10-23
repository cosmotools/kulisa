<script setup lang="ts">
// The Resources island (tasks.md, Tasks): the shown task's resources — its repository worktree(s), or the main working
// tree it works in until it makes one — each a row with its actions. More kinds come over time (the app's URL, a pull
// request). What the task made (an added repository's worktree) it can remove; the main tree and its own worktree stay.
import { computed } from 'vue';
import Icon from './Icon.vue';
import { shownTask } from '../lib/store';

const task = computed(shownTask);
const resources = computed(() => task.value?.resources ?? []);
const open = (folder: string) => kulisa.invoke('task:open-folder', { key: task.value!.key, folder });
const remove = (folder: string) => kulisa.invoke('task:remove-repo', { key: task.value!.key, repo: folder });
</script>

<template>
  <aside id="resources" aria-label="The task's resources">
    <h2>Resources</h2>
    <ul>
      <li v-for="r in resources" :key="r.folder" class="resource" :title="r.folder">
        <div class="top"><Icon :name="r.kind === 'maintree' ? 'i-folder' : 'i-git'" /><span class="label">{{ r.label }}</span></div>
        <div class="meta">{{ r.branch ? `branch ${r.branch}` : 'main working tree' }}</div>
        <div class="acts">
          <button class="link" @click="open(r.folder)">Open folder</button>
          <button v-if="r.removable" class="link danger" @click="remove(r.folder)">Remove</button>
        </div>
      </li>
    </ul>
  </aside>
</template>

<style>
#resources {
  flex: none; width: 220px; height: 100%; box-sizing: border-box; overflow-y: auto;
  border-inline-start: 1px solid var(--line); padding: var(--gap);
  h2 { margin: 0 0 var(--gap); font-size: var(--font); color: var(--text-muted); font-weight: 600; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .resource { padding: 8px; border-radius: var(--radius); background: var(--island-hi); min-width: 0; }
  .top { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--text-strong);
    .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
  .meta { color: var(--text-muted); margin: 2px 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .acts { display: flex; gap: 10px; }
  .link { background: none; border: 0; padding: 0; color: var(--accent); cursor: pointer; font: inherit; }
  .link.danger { color: var(--danger); }
  .link:hover { text-decoration: underline; }
}
</style>
