<script setup lang="ts">
// A row of ☰ with its few choices (docs/ui.md, Menus); it stays open, so another can be tried. kind: the data attribute
// each has (data-theme, data-bar).
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from 'reka-ui';
import Icon from '../Icon.vue';

defineProps<{ kind: string; icon: string; label: string; choices: { value: string; label: string; title?: string }[]; chosen: () => string;
  choose: (value: string) => unknown }>();
</script>

<template>
  <DropdownMenuRadioGroup :class="`${kind}row`" :model-value="chosen()" @update:model-value="(v) => choose(String(v))">
    <Icon :name="icon" /><span>{{ label }}</span>
    <DropdownMenuRadioItem v-for="c in choices" :key="c.value" :value="c.value" v-bind="{ [`data-${kind}`]: c.value }" :title="c.title"
      @select.prevent>{{ c.label }}</DropdownMenuRadioItem>
  </DropdownMenuRadioGroup>
</template>

<style>
.menu :is(.themerow, .barrow) { display: flex; align-items: center; gap: 2px;
  span { flex: 1; margin-inline-end: 12px; }
  [role="menuitemradio"] { display: grid; place-items: center; height: var(--control); padding: 0 8px; color: var(--text-dim); &[data-state="checked"] { background: var(--island-hi); color: var(--text-strong); } } }
</style>
