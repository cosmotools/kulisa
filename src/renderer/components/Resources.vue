<script setup lang="ts">
// The Resources island (tasks.md, The Resources island): the shown task's resources, a row each, opening its folder;
// what the task added (another repository's worktree) has a 🗑.
import { computed } from 'vue';
import Icon from './Icon.vue';
import { shownTask } from '../lib/store';

const task = computed(shownTask);
const open = (folder: string) => kulisa.invoke('task:open-folder', { key: task.value!.key, folder });
const remove = (folder: string) => kulisa.invoke('task:remove-repo', { key: task.value!.key, repo: folder });
</script>

<template>
  <aside id="resources" aria-label="The task's resources">
    <h2 class="titled">Resources</h2>
    <ul>
      <!-- A row is no <button>: its 🗑 is one, and a button holds no other -->
      <li v-for="r in task?.resources" :key="r.folder"><div class="item resource" role="button" tabindex="0" :title="`Open Folder: ${r.folder}`"
        @click="open(r.folder)" @keydown.enter.space.prevent="open(r.folder)">
        <Icon class="ico" :name="r.kind === 'maintree' ? 'i-folder' : 'i-git'" />
        <span class="text"><span class="label">{{ r.label }}</span><small>{{ r.branch ? `branch ${r.branch}` : 'main working tree' }}</small></span>
        <button v-if="r.removable" type="button" class="remove icon quiet small" aria-label="Remove Repository" title="Remove Repository"
          @click.stop="remove(r.folder)"><Icon name="i-trash" /></button>
      </div></li>
    </ul>
  </aside>
</template>

<style>
#resources { flex: none; width: 220px; overflow-y: auto; border-inline-start: 1px solid var(--island-hi); padding: var(--gap);
  ul { margin: var(--gap) 0 0; padding: 0; list-style: none; }
  .item { border-radius: var(--radius); }
  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
</style>
