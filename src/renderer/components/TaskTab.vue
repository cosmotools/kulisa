<script setup lang="ts">
// A task's tab in the bar (TaskBar.vue, which puts the project's id and color, dragging and the drop marks on it as
// attributes; tasks.md, Projects): its project's icon, as a browser's tab shows its site's, its agent's state, its name, ×. No profiles' button: the tab's right-click
// menu has them, Settings edits them (the author's choice). Reka's trigger marks the chosen one (aria-selected); the
// tab's name is its task's, not its ×'s.
import { computed } from 'vue';
import { TabsTrigger } from 'reka-ui';
import ProjectIcon from './ProjectIcon.vue';
import { STATE_ICONS } from '../lib/agents';
import type { ProjectEntry, TaskInfo } from '../../shared/types';
import { XIcon } from '@lucide/vue';

const props = defineProps<{ t: TaskInfo; p: Pick<ProjectEntry, 'name' | 'favicon'> }>();
const STATES = { working: 'is working', waiting: 'waits for you', done: 'is done' };
// The project's name is in the tooltip alone: the bar shows its icon (tasks.md, Projects).
const title = computed(() => `${props.p.name}\n` + (props.t.branch ? `branch ${props.t.branch} in ${props.t.folder}`
  : `in the project's folder ${props.t.folder} (no git: no copy of its own)`));

</script>

<template>
  <TabsTrigger :value="t.key" as-child><div class="tasktab striptab" :data-task="t.key" :aria-label="t.name" :title @click.stop>
    <ProjectIcon :p />
    <span class="state" :data-state="t.state || ''" :title="t.state ? `The agent ${STATES[t.state]}` : ''"><component :is="STATE_ICONS[t.state || 'done']" /></span>
    <span class="name">{{ t.name }}</span>
    <button class="close icon quiet small" aria-label="Close" title="Close the task: its agent stops, all else stays (open it again from its project's menu)"
      @mousedown.prevent @click="kulisa.invoke('task:close', t.key)"><XIcon /></button>
  </div></TabsTrigger>
</template>
