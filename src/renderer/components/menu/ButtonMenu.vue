<script setup lang="ts">
// A button with its menu (Reka's DropdownMenu; docs/ui.md, Menus). It opens on the press, as the OS's menus do, so a
// press, a drag to a row and the release there chooses it (Reka's trigger opens on the click, after the release); the
// click that follows is the press's, not another toggle.
//   <ButtonMenu :items="() => […]" end> <button …> </ButtonMenu>   end: its end edge at the button's (at a bar's end)
import { shallowRef } from 'vue';
import { DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui';
import MenuRows from './MenuRows.vue';
import { covered } from '../../lib/views';
import { focusBack, type MenuItem } from '../../lib/menu';

const props = defineProps<{ items: () => MenuItem[]; end?: boolean }>();
const { open, ready } = covered('pictures');
const rows = shallowRef<MenuItem[]>([]);
let focused: Element | null = null;
function toggle(v: boolean) { if (v) { rows.value = props.items(); focused = document.activeElement; } open.value = v; }
let pressed = false;
function press(e: PointerEvent) {
  if (e.button || e.ctrlKey || (e.currentTarget as HTMLButtonElement).disabled) return;
  pressed = true;
  toggle(!open.value);
}
function click(e: MouseEvent) { if (pressed) { pressed = false; e.preventDefault(); } }
</script>

<template>
  <DropdownMenuRoot :open :modal="false" @update:open="toggle">
    <DropdownMenuTrigger as-child @pointerdown="press" @click.capture="click"><slot /></DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="menu" :class="{ ready }" :align="end ? 'end' : 'start'" :side-offset="4" :collision-padding="4" @close-auto-focus="focusBack($event, focused)">
        <MenuRows :items="rows" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
