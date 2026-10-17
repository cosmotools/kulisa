<script setup lang="ts">
// Every project with its tasks, a column each (tasks.md, Projects; the author, 2026-10-17: all in sight, any task one
// click away): a new tab's (the bar's +, as a browser's) and the empty window's. The project worked in last first:
// its open task, else the one closed last. New Project… after them. Esc leaves a new tab.
import { computed, onMounted, ref } from 'vue';
import Icon from '../Icon.vue';
import ProjectColumn from './ProjectColumn.vue';
import { page, store } from '../../lib/store';
import { dialog } from '../../lib/dialogs';
import type { ProjectEntry } from '../../../shared/types';

const last = (p: ProjectEntry) => (p.tasks.some((t) => !t.closed) ? Infinity : Math.max(0, ...p.tasks.map((t) => t.closedAt ?? 0)));
const projects = computed(() => [...store.projects.projects].sort((a, b) => last(b) - last(a)));
const el = ref<HTMLElement>();
onMounted(() => { if (page.value === 'newtab') el.value?.focus(); }); // its Esc
const esc = () => { if (page.value === 'newtab') store.newTab = false; };
</script>

<template>
  <div id="board" ref="el" tabindex="-1" @keydown.esc="esc">
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
