<script setup lang="ts">
// What the window shows in the grid's place when it is not a task's grid (lib/store.ts, page): with no project at all,
// the welcome (welcome/: what Kulisa does, then the first project's steps); else every project with its tasks
// (newtab/), the empty window's and a new tab's (the bar's +).
import Welcome from './welcome/Welcome.vue';
import Board from './newtab/Board.vue';
import { page } from '../lib/store';
</script>

<template>
  <section id="empty">
    <Welcome v-if="page === 'welcome'" />
    <Board v-else-if="page !== 'task'" />
  </section>
</template>

<style>
/* safe: what is taller than the window starts at its top, where scrolling reaches it (centered, its top would be cut off
   above the window's edge: the welcome in a window 400 px high) */
#empty { display: none; place-items: safe center; overflow: auto; margin-inline: var(--gap);
  :is([data-page="welcome"], [data-page="board"], [data-page="newtab"]) & { display: grid; }
}
</style>
