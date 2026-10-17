<script setup lang="ts">
// The bar's +, after the tabs (tasks.md, Projects): a new tab, as a browser's, showing every project with its tasks
// (newtab/): a task of one made, or one opened again, there. Again, or Ctrl+Shift+A, goes back.
import Icon from './Icon.vue';
import { toggleNewTab } from '../lib/store';
import { withKeys } from '../lib/common';
</script>

<template>
  <button id="newTask" class="icon" :title="withKeys('New tab: a task of any project, new or closed', 'task.menu')" aria-label="New tab"
    @click="toggleNewTab"><Icon name="i-plus" /></button>
</template>
