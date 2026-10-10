<script setup lang="ts">
// The agent's terminal panel: it shows the shown task's agent (lib/terminals.ts), whose xterms live as long as their
// tasks and wait outside the grid while it has no such panel. Its right-click menu: Copy, Paste, Select all, Clear,
// Change agent….
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { fitTerminal, terminalMenu, termEl } from '../../lib/terminals';
import RightClickMenu from '../menu/RightClickMenu.vue';

const root = ref<HTMLElement>();
onMounted(() => { root.value!.append(termEl); fitTerminal(); });
onBeforeUnmount(() => { if (termEl.parentElement === root.value) document.body.append(termEl); });
</script>

<template>
  <RightClickMenu :items="(e) => terminalMenu(e.target as Element)"><div ref="root" class="termpanel" /></RightClickMenu>
</template>

<style>
.termpanel { height: 100%; }
#term, .term { height: 100%; padding: 2px 4px 2px 8px; }
/* The rows that fit, in the middle: what is left under a whole row (the panel's height is any) shared above and
   below, so no edge gets a row's height of it and a pixel more or less never costs a row (2026-10-08). */
.xterm-host { height: 100%; display: flex; flex-direction: column; justify-content: center; &[hidden] { display: none; } }
/* The agent's terminals wait outside the grid until its panel is there (no project open): they take no room. */
body > #term { display: none; }
</style>
