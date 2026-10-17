<script setup lang="ts">
// What the window shows in the grid's place when it is not a task's grid (lib/store.ts, page): with no project at all,
// New Project's steps (the first start: what to do is plain); else every project with its tasks (newtab/), the empty
// window's and a new tab's (the bar's +).
import { ref } from 'vue';
import Wizard from './newproject/Wizard.vue';
import Board from './newtab/Board.vue';
import { page } from '../lib/store';

const wizard = ref<InstanceType<typeof Wizard>>();
kulisa.on('project:new', () => void wizard.value?.focus()); // the first start: the keyboard there
</script>

<template>
  <section id="empty">
    <div v-if="page === 'wizard'" class="box">
      <header><h2>New Project</h2></header>
      <Wizard ref="wizard" />
    </div>
    <Board v-else-if="page !== 'task'" />
  </section>
</template>

<style>
#empty { display: none; place-items: center; overflow: auto; margin-inline: var(--gap);
  :is([data-page="wizard"], [data-page="board"], [data-page="newtab"]) & { display: grid; }
  /* New Project: a dialog's look in the grid's place, no backdrop: nothing else is in the window to cover */
  .box { display: flex; flex-direction: column; width: min(760px, 100%); min-height: min(480px, 100%); border-radius: var(--island-radius);
    background: var(--island); border: 1px solid var(--line); box-shadow: 0 12px 40px var(--shadow); overflow: hidden; } /* a dialog's frame: its side list is the window's color */
  header { padding: var(--inset) var(--pad); border-bottom: 1px solid var(--island-hi); h2 { margin: 0; font-size: var(--font); font-weight: 600; } }
}
</style>
