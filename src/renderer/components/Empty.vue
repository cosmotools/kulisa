<script setup lang="ts">
// The empty window's island (CLAUDE.md, Terminology; tasks.md, Projects).
import { dialog } from '../lib/dialogs';
import { withKeys } from '../lib/common';
import { toggleNewTask } from '../lib/menu';

kulisa.on('project:new', () => dialog('projects').then((d) => d.newProject()));
</script>

<template>
  <section id="empty">
    <h2>No task is open</h2>
    <div class="start">
      <button id="emptynewtask" class="primary" :title="withKeys('Of which project, or a closed one', 'task.menu')" @click.stop="toggleNewTask">New Task</button>
      <button id="emptynew" @click="dialog('projects').then((d) => d.newProject())">New Project…</button>
    </div>
  </section>
</template>

<style>
#empty { display: none; flex: 1; place-content: center; justify-items: center; gap: calc(var(--gap) * 2);
  margin: var(--gap); border-radius: var(--island-radius); background: var(--island);
  .noproject & { display: grid; }
  [data-bar="top"] & { order: 1; } /* under the tasks' bar, as the grid */
  h2 { margin: 0; font-size: 1.3em; color: var(--text-dim); }
  .start { display: flex; gap: var(--gap); }
}
</style>
