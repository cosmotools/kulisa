<script setup lang="ts">
// A project's icon (tasks.md, Projects): its site's favicon, or the app's curtain in its color (--color, set by the
// row or island it is in).
import LogoMark from './marks/LogoMark.vue';
import type { ProjectEntry } from '../../shared/types';

defineProps<{ p: Pick<ProjectEntry, 'favicon'> }>();
</script>

<template>
  <img v-if="p.favicon" class="size-4 shrink-0" data-testid="project-icon" alt="" :src="p.favicon"><LogoMark v-else class="size-4 shrink-0 text-(--color)" data-testid="project-icon" />
</template>
