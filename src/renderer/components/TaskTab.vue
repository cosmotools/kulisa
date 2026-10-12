<script setup lang="ts">
// A task's tab in its group (TaskBar.vue; tasks.md, Projects). No profiles' button: the tab's right-click menu has
// them, Settings edits them (the author, 2026-10-12).
//   active: the one on screen; selected: the one its project shows (another project's: where it is when shown again)
import { computed } from 'vue';
import { TabsTrigger } from 'reka-ui';
import Icon from './Icon.vue';
import type { TaskInfo } from '../types';

const props = defineProps<{ t: TaskInfo; active: boolean; selected: boolean }>();
const STATES = { working: 'is working', waiting: 'waits for you', done: 'is done' };
const title = computed(() => (props.t.branch ? `branch ${props.t.branch} in ${props.t.folder}; the app's ports + ${props.t.offset}`
  : `in the project's folder ${props.t.folder} (no git: no copy of its own)`));

</script>

<template>
  <TabsTrigger :value="t.key" as-child><div class="tasktab striptab" :class="{ active, selected }" :data-task="t.key" :title @click.stop>
    <span class="state" :data-state="t.state || ''" :title="t.state ? `The agent ${STATES[t.state]}` : ''"><Icon :name="`i-${t.state || 'done'}`" /></span>
    <span class="name">{{ t.name }}</span>
    <button class="close icon quiet small" aria-label="Close" title="Close the task: its agent stops, all else stays (open it again from its project's menu)"
      @mousedown.prevent @click="kulisa.invoke('task:close', t.key)"><Icon name="i-close" /></button>
  </div></TabsTrigger>
</template>
