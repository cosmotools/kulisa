<script setup lang="ts">
// An area's right-click menu at the pointer (shadcn-vue's ContextMenu; docs/ui.md, Menus). One menu for the area:
// items(e) builds its rows for what the right-click was on, none where it has no menu.
//   <RightClickMenu :items="(e) => […] | null"> <div …> </RightClickMenu>
import { shallowRef } from 'vue';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import MenuRows from './MenuRows.vue';
import { covered } from '../../lib/cover';
import { focusBack, leaveClosing, type MenuItem } from '../../lib/menu';

const props = defineProps<{ items: (e: MouseEvent) => MenuItem[] | null }>();
const { open, ready } = covered('pictures');
const rows = shallowRef<MenuItem[]>([]);
let focused: Element | null = null;
// Before Reka opens it (it does on the next turn, unless this one was prevented).
function opening(e: MouseEvent) {
  const list = props.items(e);
  if (!list) return e.preventDefault();
  rows.value = list;
  if (!open.value) focused = document.activeElement;
}
</script>

<template>
  <ContextMenu v-model:open="open" :modal="false">
    <ContextMenuTrigger as-child @contextmenu="opening"><slot /></ContextMenuTrigger>
    <!-- Not closed when the keyboard leaves it: a list's row right-clicked takes the keyboard just after the menu opens
         (Reka's Listbox, on the press), which closed it at once; a press outside, Esc or the window left close it -->
    <ContextMenuContent class="max-w-md min-w-64 [-webkit-app-region:no-drag] not-data-ready:opacity-0" :data-ready="ready || undefined" :collision-padding="4"
      @close-auto-focus="focusBack($event, focused)" @focus-outside.prevent @pointerleave.capture="leaveClosing">
      <MenuRows :items="rows" />
    </ContextMenuContent>
  </ContextMenu>
</template>
