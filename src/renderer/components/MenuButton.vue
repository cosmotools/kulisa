<script setup lang="ts">
// A row of a menu (menu/MenuRows.vue; docs/ui.md, Menus). Chosen with the left button only: on Linux a right-click menu
// opens on the press, and the release over a row must not choose it.
import { DropdownMenuItem, DropdownMenuRadioItem, DropdownMenuShortcut } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import ProjectIcon from './ProjectIcon.vue';
import { avatarSrc } from '../lib/common';
import { projectColor } from '../lib/project-color';
import type { MenuRow } from '../lib/menu';
import { Trash2Icon } from '@lucide/vue';

const props = defineProps<{ it: MenuRow; value?: string }>();
const leftOnly = (e: PointerEvent) => { if (e.button) e.preventDefault(); };
// Its 🗑 (it.remove) is inside the row, Reka's item: a click or a release there (a press on the menu's button, dragged
// to it) chooses the row as any, and the menu closes as for any row; this says which of the two was meant.
let removing = false;
const select = () => { const r = removing; removing = false; (r ? props.it.remove!.run : props.it.run)?.(); };
const removeKey = (e: KeyboardEvent) => { if (props.it.remove) { removing = true; (e.currentTarget as HTMLElement).click(); } };
</script>

<template>
  <component :is="value === undefined ? DropdownMenuItem : DropdownMenuRadioItem" :data-inset="it.inset || undefined" :aria-label="it.label" v-bind="value === undefined ? {} : { value }" :disabled="it.enabled === false" :text-value="it.label" :title="it.title"
    @select="select" @pointerup="leftOnly" @pointerdown="removing = false" @keydown.delete="removeKey">
    <component :is="it.icon" v-if="it.icon" /><span v-if="it.color" class="size-2.5 shrink-0 rounded-full bg-(--color)" :style="{ '--color': it.color }" />
    <ProjectIcon v-if="it.project" class="size-4 shrink-0 text-(--color)" :p="it.project" :style="{ '--color': projectColor(it.project) }" />
    <img v-if="it.avatar" class="size-4 shrink-0" alt="" :src="avatarSrc(it.avatar)">
    <span class="flex min-w-0 flex-1 flex-col"><span class="truncate">{{ it.label }}</span><small v-if="it.sub" class="truncate text-xs text-muted-foreground">{{ it.sub }}</small></span>
    <DropdownMenuShortcut v-if="it.keys">{{ it.keys }}</DropdownMenuShortcut>
    <Button v-if="it.remove" variant="ghost" size="icon-xs" class="invisible -my-1 group-focus/dropdown-menu-item:visible" tabindex="-1" :aria-label="it.remove.label" :title="it.remove.label"
      @pointerup="removing = true" @click="removing = true"><Trash2Icon /></Button>
  </component>
</template>
