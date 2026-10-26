<script setup lang="ts">
// Settings' window (docs/window.md, Settings): its page (ProjectEditor.vue), and the questions about what is done in it
// (Ask.vue). Esc closes it, as a dialog's; the OS's ×
// asks first (settings:closing): either way the page saves what is typed, then closes it.
import { ref } from 'vue';
import ProjectEditor from './ProjectEditor.vue';
import Ask from '../Ask.vue';

const editor = ref<InstanceType<typeof ProjectEditor>>();
const close = () => editor.value?.close();
kulisa.on('settings:closing', close);
// Esc closes the window unless a layer (a menu, a question, a popover: Reka's) was open, which Esc closes first, or a
// field took it (stopped: an in-place field puts its value away).
let layered = false;
addEventListener('keydown', () => { layered = !!document.querySelector('[data-dismissable-layer]'); }, true);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !layered && !e.defaultPrevented) void close(); });
</script>

<template>
  <ProjectEditor ref="editor" />
  <Ask />
</template>

<style>
/* The window is its page, the tree and the chosen page each scrolling on their own (ProjectEditor.vue) */
html { height: 100%; overflow: hidden; }
body {
  margin: 0; height: 100%; display: flex; overflow: clip;
  font: var(--font) var(--sans); color: var(--text); background: var(--island);
  user-select: none; cursor: default; /* a desktop app: labels and buttons are not text to select; fields are */
}
#app { display: contents; }
</style>
