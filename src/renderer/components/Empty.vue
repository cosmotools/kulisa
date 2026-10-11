<script setup lang="ts">
// What a window shows in the grid's place with no project open (after its last one is closed; at the first start,
// with the projects' manager opened on New Project over it: app.js, firstStart): an empty island, "No project is
// open", New Project…. Around it the window is as always: the title bar (Projects, ☰ with the links and Kulisa's
// version), the projects' bar with no islands but Search Tasks, every project's tasks. It replaced the Welcome screen
// (the author, 2026-10-11), whose list of tasks is Search Tasks' now.
import { dialog } from '../lib/dialogs';

kulisa.on('project:new', () => dialog('projects').then((d) => d.newProject()));
</script>

<template>
  <section id="empty">
    <h2>No project is open</h2>
    <button id="emptynew" @click="dialog('projects').then((d) => d.newProject())">New Project…</button>
  </section>
</template>

<style>
#empty { display: none; flex: 1; place-content: center; justify-items: center; gap: calc(var(--gap) * 2);
  margin: var(--gap); border-radius: var(--island-radius); background: var(--island);
  .noproject & { display: grid; }
  [data-bar="top"] & { order: 1; } /* under the projects' bar, as the grid */
  h2 { margin: 0; font-size: 1.3em; color: var(--text-dim); }
}
</style>
