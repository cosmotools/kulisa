<script setup lang="ts">
// The window's one menu (lib/menu.ts: openMenu): a manual popover, closed here by a press outside it (its own button's
// press is left to the button, which toggles it), Esc, leaving the window, or a chosen row. The platform's light
// dismiss would also take the release of the right-click that opened it: on Linux a menu opens on the press, just
// below the pointer, so the release comes outside and closed it at once. Up and down move between the rows' buttons;
// Enter or Space chooses.
import { onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from './Icon.vue';
import MenuButton from './MenuButton.vue';
import { closeMenu, isOpen, isSource, menuClosed, menuEnd, menuItems, menuMounted, type MenuRow } from '../lib/menu';

const el = ref<HTMLElement>(), point = ref<HTMLElement>();
const choose = (run?: () => unknown) => { closeMenu(); run?.(); };
const isRow = (it: unknown): it is MenuRow => typeof it === 'object' && it !== null && 'label' in it;

function onKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const rows = [...el.value!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const i = rows.indexOf(document.activeElement as HTMLButtonElement), down = e.key === 'ArrowDown';
  rows.at(i < 0 ? (down ? 0 : -1) : (i + (down ? 1 : -1)) % rows.length)?.focus();
}
const outside = (e: PointerEvent) => {
  if (isOpen() && !el.value!.contains(e.target as Node) && !isSource(e.target as Node)) closeMenu();
};
const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen()) { e.preventDefault(); closeMenu(); } };
onMounted(() => {
  menuMounted(el.value!, point.value!);
  addEventListener('blur', closeMenu);
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', esc, true);
});
onBeforeUnmount(() => {
  removeEventListener('blur', closeMenu);
  document.removeEventListener('pointerdown', outside, true);
  document.removeEventListener('keydown', esc, true);
});
</script>

<template>
  <div id="menu" ref="el" popover="manual" role="menu" tabindex="-1" :class="{ end: menuEnd }"
    @toggle="!isOpen() && menuClosed()" @contextmenu.prevent @keydown="onKey">
    <template v-for="(it, i) in menuItems" :key="i">
      <hr v-if="it === '-'">
      <div v-else-if="'heading' in it" class="heading"><Icon v-if="it.icon" class="ico" :name="it.icon" />{{ it.heading }}</div>
      <small v-else-if="'note' in it" class="note">{{ it.note }}</small>
      <component :is="it.component" v-else-if="'component' in it" v-bind="it.props" />
      <template v-else-if="isRow(it)">
        <div v-if="it.remove" class="removable">
          <MenuButton :it @click="choose(it.run)" />
          <button class="remove icon quiet" aria-label="Remove" :title="it.remove.title" @click="choose(it.remove.run)"><Icon name="i-close" /></button>
        </div>
        <MenuButton v-else :it @click="choose(it.run)" />
      </template>
    </template>
  </div>
  <span id="menuPoint" ref="point" />
</template>
