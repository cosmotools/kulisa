<script setup lang="ts">
// A project's icon (tasks.md, Projects): its site's favicon, or the app's curtain in its color (--color, set by the
// row or island it is in).
import Icon from './Icon.vue';
import type { ProjectEntry } from '../types';

defineProps<{ p: Pick<ProjectEntry, 'favicon'> }>();
</script>

<template>
  <img v-if="p.favicon" class="picon favicon" alt="" :src="p.favicon"><Icon v-else class="picon" name="i-logo" />
</template>
