<script setup lang="ts">
// An area's right-click menu at the pointer (Reka's ContextMenu; docs/ui.md, Menus). One menu for the area: items(e)
// builds its rows for what the right-click was on, none where it has no menu.
//   <RightClickMenu :items="(e) => […] | null"> <div …> </RightClickMenu>
import { shallowRef } from 'vue';
import { ContextMenuContent, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui';
import MenuRows from './MenuRows.vue';
import { covered } from '../../lib/cover';
import { focusBack, type MenuItem } from '../../lib/menu';

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
  <ContextMenuRoot v-model:open="open" :modal="false">
    <ContextMenuTrigger as-child @contextmenu="opening"><slot /></ContextMenuTrigger>
    <ContextMenuPortal>
      <!-- Not closed when the keyboard leaves it: a list's row right-clicked takes the keyboard just after the menu opens
           (Reka's Listbox, on the press), which closed it at once; a press outside, Esc or the window left close it -->
      <ContextMenuContent class="menu" :class="{ ready }" :collision-padding="4" @close-auto-focus="focusBack($event, focused)" @focus-outside.prevent>
        <MenuRows :items="rows" />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
