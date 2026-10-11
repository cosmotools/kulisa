<script setup lang="ts">
// Search Tasks, the bar's button after the islands and its panel (tasks.md, Projects). Reka's Popover, not a menu: a
// menu takes the letters typed (its typeahead). The pages are pictures meanwhile, as under a menu.
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import Icon from './Icon.vue';
import TaskList from './TaskList.vue';
import { covered } from '../lib/views';
import { focusBack } from '../lib/menu';
import { withKeys } from '../lib/common';

const { open, ready } = covered('pictures');
let focused: Element | null = null;
const toggle = (v: boolean) => { if (v) focused = document.activeElement; open.value = v; };
</script>

<template>
  <PopoverRoot :open @update:open="toggle">
    <PopoverTrigger as-child><button id="searchTasks" class="icon" :title="withKeys('Search tasks: every project\'s', 'tasks.search')"
      aria-label="Search tasks"><Icon name="i-search" /></button></PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="menu tasksearch" :class="{ ready }" align="end" :side-offset="4" :collision-padding="4"
        @close-auto-focus="focusBack($event, focused)">
        <TaskList @chosen="open = false" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
/* Its look is a menu's; as tall as the window lets it, its rows scrolling under the search field */
.tasksearch { display: flex; flex-direction: column; width: 400px; max-width: none;
  max-height: min(560px, var(--reka-popover-content-available-height));
  .tasklist { flex: 1; } }
</style>
