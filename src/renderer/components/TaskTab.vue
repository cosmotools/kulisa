<script setup lang="ts">
// A task's tab in its project's group (ProjectBar.vue): its agent's state (working, waiting for you, done; from its
// hooks), its name, how many of its profiles are open (on every tab, so their widths stay as the shown one changes;
// on the shown one a button with the menu of them), × closing it (its agent stops, it stays in its project's menu; the
// last one closes the project). A click shows it, of any project. Its right-click menu: the shown one's profiles,
// Rename… (its name and branch), Show Folder, Delete Task….
//   active: the one on screen; selected: the one its project shows (another project's: where it is when shown again)
import { computed } from 'vue';
import Icon from './Icon.vue';
import { store } from '../lib/store';
import { plural } from '../lib/common';
import { openMenu } from '../lib/menu';
import { profilesMenu } from '../lib/profiles';
import { dialog } from '../lib/dialogs';
import type { TaskInfo } from '../types';

const props = defineProps<{ t: TaskInfo; active: boolean; selected: boolean }>();
const STATES = { working: 'is working', waiting: 'waits for you', done: 'is done' };
const title = computed(() => (props.t.branch ? `branch ${props.t.branch} in ${props.t.folder}; the app's ports + ${props.t.offset}`
  : `in the project's folder ${props.t.folder} (no git: no copy of its own)`));
const profilesTitle = computed(() => `Profiles of this task: ${store.profiles.length} open${store.closedProfiles.length ? `, ${store.closedProfiles.length} closed` : ''}`);

function click(e: MouseEvent) {
  const target = e.target as Element, chip = target.closest('#openProfiles');
  if (target.closest('.close')) kulisa.invoke('task:close', props.t.key);
  else if (chip) openMenu(profilesMenu(), chip);
  else if (props.t.key !== store.current) kulisa.invoke('task:show', props.t.key);
}
function menu(e: MouseEvent) {
  const key = props.t.key;
  openMenu([
    ...(key === store.current ? [{ heading: 'Profiles' }, ...profilesMenu(), '-' as const] : []),
    { label: 'Rename…', run: async () => (await dialog('taskrename')).rename(key, props.t.name) },
    { label: 'Show Folder', run: () => kulisa.invoke('task:show-folder', key) },
    '-', { label: 'Delete Task…', run: () => kulisa.invoke('task:delete', key) },
  ], e);
}
</script>

<template>
  <div class="tasktab striptab" :class="{ active, selected }" :data-task="t.key" :title @click.stop="click" @contextmenu.prevent.stop="menu">
    <span class="state" :data-state="t.state || ''" :title="t.state ? `The agent ${STATES[t.state]}` : ''"><Icon :name="`i-${t.state || 'done'}`" /></span>
    <span class="name">{{ t.name }}</span>
    <button v-if="active" id="openProfiles" class="chip" aria-haspopup="menu" :title="profilesTitle" :aria-label="profilesTitle">
      <Icon name="i-users" /><span class="count">{{ store.profiles.length }}</span>
    </button>
    <span v-else class="chip" :title="`${plural(t.profiles, 'profile')} open`"><Icon name="i-users" /><span class="count">{{ t.profiles }}</span></span>
    <button class="close icon quiet small" aria-label="Close" title="Close the task: its agent stops, all else stays (open it again from its project's menu)"><Icon name="i-close" /></button>
  </div>
</template>
