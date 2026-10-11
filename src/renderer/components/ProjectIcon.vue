<script setup lang="ts">
// A project's icon: its site's favicon, one of Kulisa's set, or the app's curtain, in its color (--color, set by the
// row or island it is in). The projects' bar and Search Tasks.
import Icon from './Icon.vue';
import { projectIcon } from '../lib/common';
import type { ProjectEntry } from '../types';

defineProps<{ p: ProjectEntry }>();
</script>

<template>
  <img v-if="p.icon === 'favicon' && p.favicon" class="picon favicon" alt="" :src="p.favicon"><Icon v-else class="picon" :name="projectIcon(p.icon)" />
</template>
