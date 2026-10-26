<script setup lang="ts">
// An agent's state (its hooks; tasks.md, The agent's state): an icon each, not told by color alone; nothing when it has
// none. On a task's tab and row, on a terminal's tab.
import { BellIcon, CheckIcon, SparklesIcon } from '@lucide/vue';
import type { TaskInfo } from '../../shared/types';

defineProps<{ state: TaskInfo['state'] | undefined }>();
const ICONS = { working: SparklesIcon, waiting: BellIcon, done: CheckIcon };
const LOOKS = { working: 'text-blue-500 motion-safe:animate-pulse', waiting: 'text-amber-500', done: 'text-green-500' };
</script>

<template>
  <span class="grid shrink-0 place-items-center" :class="state && LOOKS[state]" :data-state="state || ''" :hidden="!state">
    <component :is="ICONS[state]" v-if="state" class="size-3.5" />
  </span>
</template>
