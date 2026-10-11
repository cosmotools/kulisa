<script setup lang="ts">
// A project's icon (tasks.md, Projects), in its color: --color, set by the row or island it is in.
import Icon from './Icon.vue';
import { projectIcon } from '../lib/common';
import type { ProjectEntry } from '../types';

defineProps<{ p: Pick<ProjectEntry, 'icon' | 'favicon'> }>();
</script>

<template>
  <img v-if="p.icon === 'favicon' && p.favicon" class="picon favicon" alt="" :src="p.favicon"><Icon v-else class="picon" :name="projectIcon(p.icon)" />
</template>
