<script setup lang="ts">
// The items of a menu (lib/menu.ts) as shadcn-vue's menu parts (Reka's Menu primitives, which DropdownMenu and
// ContextMenu share: one set of rows for both). A submenu's rows are its own MenuRows.
import { DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal } from '@/components/ui/dropdown-menu';
import MenuButton from '../MenuButton.vue';
import ProjectIcon from '../ProjectIcon.vue';
import { projectColor } from '../../lib/project-color';
import { leaveClosing, type MenuItem } from '../../lib/menu';

defineProps<{ items: MenuItem[] }>();
</script>

<template>
  <template v-for="(it, i) in items" :key="i">
    <DropdownMenuSeparator v-if="it === '-'" />
    <DropdownMenuLabel v-else-if="'heading' in it" class="flex items-center gap-1.5" data-testid="menu-heading"><component :is="it.icon" v-if="it.icon" class="size-4" /><span class="truncate">{{ it.heading }}</span></DropdownMenuLabel>
    <DropdownMenuSub v-else-if="'submenu' in it">
      <DropdownMenuSubTrigger :text-value="it.submenu" :aria-label="it.submenu">
        <ProjectIcon v-if="it.project" :p="it.project" :style="{ '--color': projectColor(it.project) }" />
        <span class="truncate">{{ it.submenu }}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent class="max-h-(--reka-dropdown-menu-content-available-height) max-w-md min-w-64 overflow-y-auto [-webkit-app-region:no-drag]" data-ready :side-offset="4" :collision-padding="4" @pointerleave.capture="leaveClosing">
          <MenuRows :items="it.items" />
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
    <component :is="it.component" v-else-if="'component' in it" v-bind="it.props" />
    <MenuButton v-else :it />
  </template>
</template>
