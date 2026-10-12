<script setup lang="ts">
// A row of a menu (menu/MenuRows.vue; docs/ui.md, Rows). Chosen with the left button only: on Linux a right-click menu
// opens on the press, and the release over a row must not choose it.
import { DropdownMenuItem, DropdownMenuItemIndicator, DropdownMenuRadioItem } from 'reka-ui';
import Icon from './Icon.vue';
import ProjectIcon from './ProjectIcon.vue';
import { avatarSrc } from '../lib/common';
import type { MenuRow } from '../lib/menu';

const props = defineProps<{ it: MenuRow; value?: string }>();
const leftOnly = (e: PointerEvent) => { if (e.button) e.preventDefault(); };
// Its 🗑 (it.remove) is inside the row, Reka's item: a click or a release there (a press on the menu's button, dragged
// to it) chooses the row as any, and the menu closes as for any row; this says which of the two was meant.
let removing = false;
const select = () => { const r = removing; removing = false; (r ? props.it.remove!.run : props.it.run)?.(); };
const removeKey = (e: KeyboardEvent) => { if (props.it.remove) { removing = true; (e.currentTarget as HTMLElement).click(); } };
</script>

<template>
  <component :is="value === undefined ? DropdownMenuItem : DropdownMenuRadioItem" :class="['item', { inset: it.inset }]" v-bind="value === undefined ? {} : { value }" :disabled="it.enabled === false" :text-value="it.label" :title="it.title"
    @select="select" @pointerup="leftOnly" @pointerdown="removing = false" @keydown.delete="removeKey">
    <Icon v-if="it.icon" class="ico" :name="it.icon" /><span v-if="it.color" class="dot" :style="{ '--color': it.color }" />
    <ProjectIcon v-if="it.project" :p="it.project" :style="{ '--color': it.project.color }" />
    <img v-if="it.avatar" class="avatar" alt="" :src="avatarSrc(it.avatar)">
    <span class="text"><span class="label">{{ it.label }}</span><small>{{ it.sub }}</small></span><kbd>{{ it.keys }}</kbd>
    <button v-if="it.remove" class="remove icon quiet small" tabindex="-1" :aria-label="it.remove.label" :title="it.remove.label"
      @pointerup="removing = true" @click="removing = true"><Icon name="i-trash" /></button>
    <DropdownMenuItemIndicator v-if="value !== undefined" as-child><Icon class="check" name="i-done" /></DropdownMenuItemIndicator>
  </component>
</template>
