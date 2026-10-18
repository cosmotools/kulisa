<script setup lang="ts">
// The items of a menu (lib/menu.ts) as Reka's menu parts (the Menu primitives DropdownMenu and ContextMenu share: one
// set of rows for both). A submenu's rows are its own MenuRows.
import { DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from 'reka-ui';
import Icon from '../Icon.vue';
import MenuButton from '../MenuButton.vue';
import ProjectIcon from '../ProjectIcon.vue';
import { projectColor } from '../../lib/project-color';
import type { MenuItem } from '../../lib/menu';

defineProps<{ items: MenuItem[] }>();
</script>

<template>
  <template v-for="(it, i) in items" :key="i">
    <DropdownMenuSeparator v-if="it === '-'" />
    <DropdownMenuLabel v-else-if="'heading' in it" class="heading"><Icon v-if="it.icon" class="ico" :name="it.icon" />{{ it.heading }}</DropdownMenuLabel>
    <DropdownMenuSub v-else-if="'submenu' in it">
      <DropdownMenuSubTrigger class="item" :text-value="it.submenu">
        <ProjectIcon v-if="it.project" :p="it.project" :style="{ '--color': projectColor(it.project) }" />
        <span class="text"><span class="label">{{ it.submenu }}</span></span><Icon class="chevron" name="i-chevron" />
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal><DropdownMenuSubContent class="menu ready" :side-offset="4" :collision-padding="4"><MenuRows :items="it.items" /></DropdownMenuSubContent></DropdownMenuPortal>
    </DropdownMenuSub>
    <component :is="it.component" v-else-if="'component' in it" v-bind="it.props" />
    <MenuButton v-else :it />
  </template>
</template>
