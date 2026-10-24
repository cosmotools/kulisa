<script setup lang="ts">
// The Resources island (tasks.md, The Resources island), a panel of the grid (its header ResourcesTab.vue): the shown
// task's resources, a row each, opening its folder; what the task added (another repository's worktree) has a 🗑. Under
// them its artifacts, the files the agent's tools kept of its pages: a click opens one in the OS's app for it.
import { computed, watch } from 'vue';
import Icon from './Icon.vue';
import RightClickMenu from './menu/RightClickMenu.vue';
import { shownTask, store } from '../lib/store';
import type { MenuItem } from '../lib/menu';

const task = computed(shownTask);
const open = (folder: string) => kulisa.invoke('task:open-folder', { key: task.value!.key, folder });
const remove = (folder: string) => kulisa.invoke('task:remove-repo', { key: task.value!.key, repo: folder });

// The list comes when the task is shown and whenever its agent keeps one (window.ts, sendArtifacts).
watch(() => task.value?.key, (key) => { if (key) void kulisa.invoke('task:artifacts', key); }, { immediate: true });
const artifacts = computed(() => (store.artifacts.task === task.value?.key ? store.artifacts.list : []));
const KINDS: Record<string, string> = { screenshot: 'Screenshot', snapshot: 'Snapshot', request: 'Request body', response: 'Response body' };
const kindOf = (kind: string) => KINDS[kind] ?? kind;
const profileName = (id: string) => [...store.profiles, ...store.closedProfiles].find((p) => p.id === id)?.name ?? '';
const day = (t: number) => new Date(t).toDateString();
const when = (t: number) => (day(t) === day(Date.now()) ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' }));
const openFile = (file: string) => kulisa.invoke('file:open', file);
const menu = (e: MouseEvent): MenuItem[] | null => {
  const file = (e.target as Element).closest<HTMLElement>('.artifact')?.dataset.file;
  return file ? [{ label: 'Open', run: () => openFile(file) }, { label: 'Show in Folder', run: () => kulisa.invoke('file:show', file) }, '-',
    { label: 'Delete', run: () => kulisa.invoke('task:artifact-delete', { key: task.value!.key, file }) }] : null;
};
</script>

<template>
  <aside id="resources" aria-label="The task's resources">
    <ul>
      <!-- A row is no <button>: its 🗑 is one, and a button holds no other -->
      <li v-for="r in task?.resources" :key="r.folder"><div class="item resource" role="button" tabindex="0" :title="`Open Folder: ${r.folder}`"
        @click="open(r.folder)" @keydown.enter.space.self.prevent="open(r.folder)">
        <Icon class="ico" :name="r.kind === 'maintree' ? 'i-folder' : 'i-git'" />
        <span class="text"><span class="label">{{ r.label }}</span><small>{{ r.branch ? `branch ${r.branch}` : 'main working tree' }}</small></span>
        <button v-if="r.removable" type="button" class="remove icon quiet small" aria-label="Remove Repository" title="Remove Repository"
          @click.stop="remove(r.folder)"><Icon name="i-trash" /></button>
      </div></li>
    </ul>
    <template v-if="artifacts.length">
      <h3 class="titled">Artifacts</h3>
      <RightClickMenu :items="menu"><ul>
        <li v-for="a in artifacts" :key="a.file"><button type="button" class="item artifact" :data-file="a.file" :title="`Open: ${a.file}`"
          @click="openFile(a.file)">
          <img v-if="a.thumb" class="thumb" :src="a.thumb" alt=""><Icon v-else class="ico" name="i-file" />
          <span class="text"><span class="label">{{ kindOf(a.kind) }}</span><small>{{ [profileName(a.profile), when(a.time)].filter(Boolean).join(' · ') }}</small></span>
        </button></li>
      </ul></RightClickMenu>
    </template>
  </aside>
</template>

<style>
#resources { height: 100%; overflow-y: auto; padding: 0 var(--gap) var(--gap);
  ul { margin: 0; padding: 0; list-style: none; }
  .item { border-radius: var(--radius); }
  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .titled { margin-block: var(--gap) 4px; }
  /* A screenshot's picture in the icon's place: its top, where a page's head is */
  .thumb { flex: none; width: 64px; max-height: 40px; object-fit: cover; object-position: top; border-radius: 4px; border: 1px solid var(--island-hi); }
}
</style>
