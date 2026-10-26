<script setup lang="ts">
// A row of a menu (menu/MenuRows.vue; docs/ui.md, Menus). Chosen with the left button only: on Linux a right-click menu
// opens on the press, and the release over a row must not choose it.
import { DropdownMenuItem, DropdownMenuRadioItem, DropdownMenuShortcut } from '@/components/ui/dropdown-menu';
import { avatarSrc } from '../lib/common';
import type { MenuRow } from '../lib/menu';

defineProps<{ it: MenuRow; value?: string }>();
const leftOnly = (e: PointerEvent) => { if (e.button) e.preventDefault(); };
</script>

<template>
  <component :is="value === undefined ? DropdownMenuItem : DropdownMenuRadioItem" :aria-label="it.label" v-bind="value === undefined ? {} : { value }" :disabled="it.enabled === false" :text-value="it.label" :title="it.title"
    @select="it.run?.()" @pointerup="leftOnly">
    <component :is="it.icon" v-if="it.icon" />
    <img v-if="it.avatar" class="size-4 shrink-0" alt="" :src="avatarSrc(it.avatar)">
    <span class="flex min-w-0 flex-1 flex-col"><span class="truncate">{{ it.label }}</span><small v-if="it.sub" class="truncate text-xs text-muted-foreground">{{ it.sub }}</small></span>
    <DropdownMenuShortcut v-if="it.keys">{{ it.keys }}</DropdownMenuShortcut>
  </component>
</template>
