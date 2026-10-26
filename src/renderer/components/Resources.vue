<script setup lang="ts">
// The Resources island (tasks.md, The Resources island), a panel of the grid (its header ResourcesTab.vue): the shown
// task's resources, a row each, opening its folder; what the task added (another repository's worktree) has a 🗑. Under
// them its artifacts, the files the agent's tools kept of its pages: a click opens one in the OS's app for it; their
// heading says what they take (Task.artifactsUsage).
import { computed, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import RightClickMenu from './menu/RightClickMenu.vue';
import { shownTask, store } from '../lib/store';
import type { MenuItem } from '../lib/menu';
import { sizeText } from '../../shared/bytes';
import { FileTextIcon, FolderIcon, GitBranchIcon, Trash2Icon } from '@lucide/vue';

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
const deleteArtifacts = (files: string[] | null) => kulisa.invoke('task:artifacts-delete', { key: task.value!.key, files });
const menu = (e: MouseEvent): MenuItem[] | null => {
  const file = (e.target as Element).closest<HTMLElement>('[data-file]')?.dataset.file;
  return file ? [{ label: 'Open', run: () => openFile(file) }, { label: 'Show in Folder', run: () => kulisa.invoke('file:show', file) }, '-',
    { label: 'Delete', run: () => deleteArtifacts([file]) }] : null;
};
</script>

<template>
  <aside id="resources" class="h-full overflow-y-auto px-2 pb-2" aria-label="The task's resources">
    <ItemGroup>
      <!-- A row is no <button>: its 🗑 is one, and a button holds no other -->
      <Item v-for="r in task?.resources" :key="r.folder" size="xs" role="button" tabindex="0" :aria-label="r.label" :title="`Open Folder: ${r.folder}`"
        @click="open(r.folder)" @keydown.enter.space.self.prevent="open(r.folder)">
        <ItemMedia variant="icon"><component :is="r.kind === 'maintree' ? FolderIcon : GitBranchIcon" /></ItemMedia>
        <ItemContent><ItemTitle>{{ r.label }}</ItemTitle><ItemDescription>{{ r.branch ? `branch ${r.branch}` : 'main working tree' }}</ItemDescription></ItemContent>
        <ItemActions v-if="r.removable">
          <Button variant="ghost" size="icon-xs" aria-label="Remove Repository" title="Remove Repository" @click.stop="remove(r.folder)"><Trash2Icon /></Button>
        </ItemActions>
      </Item>
    </ItemGroup>
    <template v-if="artifacts.length">
      <Item size="xs">
        <ItemContent><ItemTitle>Artifacts</ItemTitle></ItemContent>
        <ItemActions><ItemDescription data-testid="artifacts-size">{{ sizeText(store.artifacts.bytes) }}</ItemDescription>
          <Button variant="ghost" size="icon-xs" aria-label="Delete All Artifacts" title="Delete All Artifacts" @click="deleteArtifacts(null)"><Trash2Icon /></Button></ItemActions>
      </Item>
      <RightClickMenu :items="menu"><ItemGroup>
        <Item v-for="a in artifacts" :key="a.file" as="button" type="button" size="xs" :data-file="a.file" :aria-label="kindOf(a.kind)" :title="`Open: ${a.file} (${sizeText(a.bytes)})`"
          @click="openFile(a.file)">
          <ItemMedia v-if="a.thumb" variant="image"><img :src="a.thumb" alt=""></ItemMedia><ItemMedia v-else variant="icon"><FileTextIcon /></ItemMedia>
          <ItemContent><ItemTitle>{{ kindOf(a.kind) }}</ItemTitle><ItemDescription>{{ [profileName(a.profile), when(a.time)].filter(Boolean).join(' · ') }}</ItemDescription></ItemContent>
        </Item>
      </ItemGroup></RightClickMenu>
    </template>
  </aside>
</template>
