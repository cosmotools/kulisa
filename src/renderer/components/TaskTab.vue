<script setup lang="ts">
// A task's tab in the bar (TaskBar.vue, which puts the project's id and color, dragging and the drop marks on it as
// attributes; tasks.md, Projects): its project's icon, as a browser's tab shows its site's, its agent's state, its name, ×. No profiles' button: the tab's right-click
// menu has them, Settings edits them (the author's choice). Reka's trigger marks the chosen one (aria-selected); the
// tab's name is its task's, not its ×'s.
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import { TabsTrigger } from '@/components/ui/tabs';
import AgentState from './AgentState.vue';
import ProjectIcon from './ProjectIcon.vue';
import type { ProjectEntry, TaskInfo } from '../../shared/types';
import { XIcon } from '@lucide/vue';

const props = defineProps<{ t: TaskInfo; p: Pick<ProjectEntry, 'name' | 'favicon'> }>();
const STATES = { working: 'is working', waiting: 'waits for you', done: 'is done' };
// The project's name is in the tooltip alone: the bar shows its icon (tasks.md, Projects).
const title = computed(() => `${props.p.name}\n` + (props.t.branch ? `branch ${props.t.branch} in ${props.t.folder}`
  : `in the project's folder ${props.t.folder} (no git: no copy of its own)`));
</script>

<template>
  <!-- Never narrow, a target for a quick throw of the mouse; its name keeps about ten letters (× kept on every tab) -->
  <TabsTrigger :value="t.key" as-child class="max-w-60 min-w-40 flex-[0_1_auto] justify-start pr-0.5 pl-2 data-dragging:opacity-50 data-[drop=after]:border-r-primary data-[drop=before]:border-l-primary">
    <div :data-task="t.key" :aria-label="t.name" :title @click.stop>
      <ProjectIcon :p />
      <AgentState :state="t.state" :title="t.state ? `The agent ${STATES[t.state]}` : ''" />
      <span class="flex-1 truncate text-left">{{ t.name }}</span>
      <Button variant="ghost" size="icon-xs" aria-label="Close" title="Close the task: its agent stops, all else stays (open it again from the sidebar)"
        @mousedown.prevent @click="kulisa.invoke('task:close', t.key)"><XIcon /></Button>
    </div>
  </TabsTrigger>
</template>
