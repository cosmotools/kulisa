<script setup lang="ts">
// The menu at a point (lib/menu.ts, menuAt): Reka's DropdownMenu with no button, placed at the point. Closed as any
// menu is; afterwards the keyboard is back where it was (the terminal).
import { computed, watch } from 'vue';
import { DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot } from 'reka-ui';
import MenuRows from './MenuRows.vue';
import { covered } from '../../lib/views';
import { focusBack, pointMenu } from '../../lib/menu';

const { open, ready } = covered('pictures');
let focused: Element | null = null;
watch(pointMenu, (m) => { if (m) { focused = document.activeElement; open.value = true; } });
watch(open, (o) => { if (!o) pointMenu.value = null; });
const at = computed(() => ({ getBoundingClientRect: () => DOMRect.fromRect({ x: pointMenu.value?.x, y: pointMenu.value?.y, width: 0, height: 0 }) }));
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal="false">
    <DropdownMenuPortal>
      <DropdownMenuContent class="menu" :class="{ ready }" :reference="at" align="start" :collision-padding="4" @close-auto-focus="focusBack($event, focused)">
        <MenuRows :items="pointMenu?.items || []" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
