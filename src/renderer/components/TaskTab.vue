<script setup lang="ts">
// A task's tab in its project's group (ProjectBar.vue): its agent's state (working, waiting for you, done; from its
// hooks), its name, how many of its profiles are open (on every tab, so their widths stay as the shown one changes;
// on the shown one a button with the menu of them), × closing it (its agent stops, it stays in its project's menu; the
// last one closes the project). A press shows it, of any project: Reka's tab (the bar's Tabs, ProjectBar.vue), as a
// browser's; not on its × or its profiles' chip. Its right-click menu is the projects' bar's (ProjectBar.vue, taskMenu).
//   active: the one on screen; selected: the one its project shows (another project's: where it is when shown again)
import { computed } from 'vue';
import { TabsTrigger } from 'reka-ui';
import Icon from './Icon.vue';
import ButtonMenu from './menu/ButtonMenu.vue';
import { store } from '../lib/store';
import { plural } from '../lib/common';
import { profilesMenu } from '../lib/profiles';
import type { TaskInfo } from '../types';

const props = defineProps<{ t: TaskInfo; active: boolean; selected: boolean }>();
const STATES = { working: 'is working', waiting: 'waits for you', done: 'is done' };
const title = computed(() => (props.t.branch ? `branch ${props.t.branch} in ${props.t.folder}; the app's ports + ${props.t.offset}`
  : `in the project's folder ${props.t.folder} (no git: no copy of its own)`));
const profilesTitle = computed(() => `Profiles of this task: ${store.profiles.length} open${store.closedProfiles.length ? `, ${store.closedProfiles.length} closed` : ''}`);

</script>

<template>
  <TabsTrigger :value="t.key" as-child><div class="tasktab striptab" :class="{ active, selected }" :data-task="t.key" :title @click.stop>
    <span class="state" :data-state="t.state || ''" :title="t.state ? `The agent ${STATES[t.state]}` : ''"><Icon :name="`i-${t.state || 'done'}`" /></span>
    <span class="name">{{ t.name }}</span>
    <ButtonMenu v-if="active" :items="profilesMenu"><button id="openProfiles" class="chip" :title="profilesTitle" :aria-label="profilesTitle">
      <Icon name="i-users" /><span class="count">{{ store.profiles.length }}</span>
    </button></ButtonMenu>
    <span v-else class="chip" :title="`${plural(t.profiles, 'profile')} open`"><Icon name="i-users" /><span class="count">{{ t.profiles }}</span></span>
    <button class="close icon quiet small" aria-label="Close" title="Close the task: its agent stops, all else stays (open it again from its project's menu)"
      @mousedown.prevent @click="kulisa.invoke('task:close', t.key)"><Icon name="i-close" /></button>
  </div></TabsTrigger>
</template>
