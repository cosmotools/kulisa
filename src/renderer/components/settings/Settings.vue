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
// field took it (stopped: an in-place field puts its value away). One fading out as it closes is closed.
let layered = false;
addEventListener('keydown', () => { layered = !!document.querySelector('[data-dismissable-layer]:not([data-state="closed"])'); }, true);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !layered && !e.defaultPrevented) void close(); });
</script>

<template>
  <ProjectEditor ref="editor" />
  <Ask />
</template>
