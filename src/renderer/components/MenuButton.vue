<script setup lang="ts">
// A row of a menu (Menu.vue; docs/ui.md, Rows): its icon, a project's dot or a profile's picture, its label with a
// line under it, its key at the end.
import Icon from './Icon.vue';
import { avatarSrc } from '../lib/common';
import type { MenuRow } from '../lib/menu';

defineProps<{ it: MenuRow }>();
</script>

<template>
  <button class="item" role="menuitem" :disabled="it.enabled === false">
    <Icon v-if="it.icon" class="ico" :name="it.icon" /><span v-if="it.color" class="dot" :style="{ '--color': it.color }" />
    <img v-if="it.avatar" class="avatar" alt="" :src="avatarSrc(it.avatar)">
    <span class="text"><span class="label">{{ it.label }}</span><small>{{ it.sub }}</small></span><kbd>{{ it.keys }}</kbd>
  </button>
</template>
