<script setup lang="ts">
// The items of a menu (lib/menu.ts) as Reka's menu parts. A row's × is an item of its own, so the arrows reach it.
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuSeparator } from 'reka-ui';
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
    <DropdownMenuRadioGroup v-else-if="'choose' in it" :model-value="it.chosen" @update:model-value="(v) => it.choose(String(v))">
      <MenuButton v-for="r in it.rows" :key="r.value" :it="r" :value="r.value" />
    </DropdownMenuRadioGroup>
    <div v-else-if="it.remove" class="removable">
      <MenuButton :it />
      <DropdownMenuItem class="remove icon quiet" aria-label="Remove" :title="it.remove.title" @select="it.remove.run()"
        @pointerup="(e: PointerEvent) => e.button && e.preventDefault()"><Icon name="i-close" /></DropdownMenuItem>
    </div>
    <MenuButton v-else :it />
  </template>
</template>
