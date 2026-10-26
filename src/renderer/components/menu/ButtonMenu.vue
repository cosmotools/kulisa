<script setup lang="ts">
// A button with its menu (shadcn-vue's DropdownMenu; docs/ui.md, Menus). It opens on the press, as the OS's menus do,
// so a press, a drag to a row and the release there chooses it (Reka's trigger opens on the click, after the release);
// the click that follows is the press's, not another toggle.
//   <ButtonMenu :items="() => […]" end> <button …> </ButtonMenu>   end: its end edge at the button's (at a bar's end)
import { computed, provide } from 'vue';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import MenuRows from './MenuRows.vue';
import { covered } from '../../lib/cover';
import { closeMenu, focusBack, type MenuItem } from '../../lib/menu';

const props = defineProps<{ items: () => MenuItem[]; end?: boolean }>();
const { open, ready } = covered('pictures');
provide(closeMenu, () => toggle(false));
// Read while it is open: rows whose data comes after it opened (a list asked for again) show as it comes. Closing, it
// keeps the last ones as it goes.
let last: MenuItem[] = [];
const rows = computed<MenuItem[]>(() => (open.value ? (last = props.items()) : last));
let focused: Element | null = null;
function toggle(v: boolean) { if (v) focused = document.activeElement; open.value = v; }
let pressed = false;
function press(e: PointerEvent) {
  if (e.button || e.ctrlKey || (e.currentTarget as HTMLButtonElement).disabled) return;
  pressed = true;
  toggle(!open.value);
}
function click(e: MouseEvent) { if (pressed) { pressed = false; e.preventDefault(); } }
</script>

<template>
  <DropdownMenu :open :modal="false" @update:open="toggle">
    <DropdownMenuTrigger as-child @pointerdown="press" @click.capture="click"><slot /></DropdownMenuTrigger>
    <!-- Shown once the pages under it are pictures (lib/cover.ts); over the title bar, not a part of what drags the window -->
    <DropdownMenuContent class="w-auto max-w-md min-w-64 [-webkit-app-region:no-drag] not-data-ready:opacity-0" :data-ready="ready || undefined" :align="end ? 'end' : 'start'" :collision-padding="4"
      @close-auto-focus="focusBack($event, focused)" @focus-outside.prevent>
      <MenuRows :items="rows" />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
