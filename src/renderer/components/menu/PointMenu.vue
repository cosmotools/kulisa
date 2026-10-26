<script setup lang="ts">
// The menu at a point (lib/menu.ts, menuAt): shadcn-vue's DropdownMenu with no button, placed at the point. Closed as
// any menu is; afterwards the keyboard is back where it was (the terminal).
import { computed, watch } from 'vue';
import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import MenuRows from './MenuRows.vue';
import { covered } from '../../lib/cover';
import { focusBack, pointMenu } from '../../lib/menu';

const { open, ready } = covered('pictures');
let focused: Element | null = null;
watch(pointMenu, (m) => { if (m) { focused = document.activeElement; open.value = true; } });
watch(open, (o) => { if (!o) pointMenu.value = null; });
const at = computed(() => ({ getBoundingClientRect: () => DOMRect.fromRect({ x: pointMenu.value?.x, y: pointMenu.value?.y, width: 0, height: 0 }) }));
</script>

<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <DropdownMenuContent class="w-auto max-w-md min-w-64 [-webkit-app-region:no-drag] not-data-ready:opacity-0" :data-ready="ready || undefined" :reference="at" :collision-padding="4"
      @close-auto-focus="focusBack($event, focused)" @focus-outside.prevent>
      <MenuRows :items="pointMenu?.items || []" />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
