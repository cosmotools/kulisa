<script setup lang="ts">
// The items of a menu (lib/menu.ts) as Reka's menu parts.
import { DropdownMenuLabel, DropdownMenuSeparator } from 'reka-ui';
import Icon from '../Icon.vue';
import MenuButton from '../MenuButton.vue';
import type { MenuItem } from '../../lib/menu';

defineProps<{ items: MenuItem[] }>();
</script>

<template>
  <template v-for="(it, i) in items" :key="i">
    <DropdownMenuSeparator v-if="it === '-'" />
    <DropdownMenuLabel v-else-if="'heading' in it" class="heading"><Icon v-if="it.icon" class="ico" :name="it.icon" />{{ it.heading }}</DropdownMenuLabel>
    <DropdownMenuLabel v-else-if="'note' in it" class="note">{{ it.note }}</DropdownMenuLabel>
    <component :is="it.component" v-else-if="'component' in it" v-bind="it.props" />
    <MenuButton v-else :it />
  </template>
</template>
