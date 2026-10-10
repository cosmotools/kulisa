<script setup lang="ts">
// A row of a menu (menu/MenuRows.vue; docs/ui.md, Rows): its icon, a project's dot or a profile's picture, its label
// with a line under it, its key at the end; a check when it is the chosen one of a choice (value). Reka's menu item:
// the pointer lights it, the arrows move to it, its first letter finds it. Chosen with the left button only: on Linux a
// right-click menu opens on the press, and the release over a row must not choose it.
import { DropdownMenuItem, DropdownMenuItemIndicator, DropdownMenuRadioItem } from 'reka-ui';
import Icon from './Icon.vue';
import { avatarSrc } from '../lib/common';
import type { MenuRow } from '../lib/menu';

defineProps<{ it: MenuRow; value?: string }>();
const leftOnly = (e: PointerEvent) => { if (e.button) e.preventDefault(); };
</script>

<template>
  <component :is="value === undefined ? DropdownMenuItem : DropdownMenuRadioItem" class="item" v-bind="value === undefined ? {} : { value }" :disabled="it.enabled === false" :text-value="it.label"
    @select="it.run?.()" @pointerup="leftOnly">
    <Icon v-if="it.icon" class="ico" :name="it.icon" /><span v-if="it.color" class="dot" :style="{ '--color': it.color }" />
    <img v-if="it.avatar" class="avatar" alt="" :src="avatarSrc(it.avatar)">
    <span class="text"><span class="label">{{ it.label }}</span><small>{{ it.sub }}</small></span><kbd>{{ it.keys }}</kbd>
    <DropdownMenuItemIndicator v-if="value !== undefined" as-child><Icon class="check" name="i-done" /></DropdownMenuItemIndicator>
  </component>
</template>
