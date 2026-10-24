<script setup lang="ts">
// What the empty window shows in the grid's place when no task is open (lib/store.ts, page): with no project at all,
// the welcome (welcome/: what Kulisa does, then the first project's steps); else every project with its tasks, a board
// (newtab/). A task's grid is shown by the grid itself.
import Welcome from './welcome/Welcome.vue';
import Board from './newtab/Board.vue';
import { page } from '../lib/store';
</script>

<template>
  <section id="empty">
    <Welcome v-if="page === 'welcome'" />
    <Board v-else-if="page === 'board'" />
  </section>
</template>

<style>
/* safe: what is taller than the window starts at its top, where scrolling reaches it (centered, its top would be cut off
   above the window's edge: the welcome in a window 400 px high) */
#empty { display: none; place-items: safe center; overflow: auto; margin-inline: var(--gap);
  :is([data-page="welcome"], [data-page="board"]) & { display: grid; }
}
</style>
