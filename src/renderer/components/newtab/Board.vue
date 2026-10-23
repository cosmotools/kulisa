<script setup lang="ts">
// Every project with its tasks, a column each (tasks.md, Projects: all in sight, any task one click away): what the
// empty window shows. The project worked in last first: its open task, else the one closed last. New Project… after
// them.
import { computed } from 'vue';
import Icon from '../Icon.vue';
import ProjectColumn from './ProjectColumn.vue';
import { store } from '../../lib/store';
import { dialog } from '../../lib/dialogs';
import { lastWorked } from '../../lib/common';

const projects = computed(() => [...store.projects.projects].sort((a, b) => lastWorked(b) - lastWorked(a)));
</script>

<template>
  <div id="board">
    <ProjectColumn v-for="p in projects" :key="p.id" :p />
    <button id="boardnewproject" type="button" class="launcher" title="New Project…: its code, its agents, its profiles"
      @click="dialog('newproject').then((d) => d.open())"><Icon name="i-folder-plus" /><span class="name">New Project…</span></button>
  </div>
</template>

<style>
/* The columns side by side, as wide as the window lets them; more than fit scroll sideways */
#board { display: flex; align-items: start; gap: var(--gap); width: 100%; height: 100%; overflow: auto; outline: none;
  padding-block: var(--gap); box-sizing: border-box; align-self: stretch;
  > .launcher { flex: none; }
}
</style>
