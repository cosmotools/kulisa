<script setup lang="ts">
// Dictation (docs/window.md, The terminal): the agent records and turns speech into text; Kulisa only holds its key
// (Task.dictate), so nobody has to know the agent's command or key. Its language is Kulisa's one (☰ → Language). The
// bar stays when the terminal in front has none (a shell, an agent without its own), its microphone disabled: a bar
// that came and went would resize the terminal, and Claude Code redraws badly after one.
import { computed } from 'vue';
import Icon from '../Icon.vue';
import { store } from '../../lib/store';
import { shownTerm } from '../../lib/terminals';
import { record, voices } from '../../lib/voice';

const v = computed(() => (store.current ? voices[store.current] : null));
const front = computed(() => store.terminals.list.find((t) => t.id === store.terminals.front));
const none = computed(() => (front.value?.agent ? `${front.value.agent.name} has no dictation of its own here` : 'Dictation is the agent\'s: a shell is in front'));

let down = 0; // when the press that started a recording began
function press(e: PointerEvent) {
  if (e.button) return;
  e.preventDefault(); // the keyboard stays in the terminal
  try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* let go anywhere */ }
  const task = store.current!;
  if (v.value?.recording) { down = 0; void record(task, false); } // the second click
  else { down = e.timeStamp; void record(task, true); }
}
function release(e: PointerEvent) {
  if (down && e.timeStamp - down > 400) void record(store.current!, false); // held; a click leaves it on until the next
  down = 0;
  shownTerm()?.focus();
}
// Enter or Space on it.
const key = (e: MouseEvent) => { if (!e.detail) void record(store.current!, !v.value?.recording); };
const language = computed(() => (store.language ? new Intl.DisplayNames(['en'], { type: 'language' }).of(store.language.language) : ''));
</script>

<template>
  <!-- The panel is not dragged by its bar from here. -->
  <div class="dictation" @dragstart.prevent>
    <button class="icon round mic" aria-label="Speak to the agent" :aria-pressed="!!v?.recording" :disabled="!v"
      :title="!v ? none : v.recording ? 'Recording: click to stop' : `Speak to the agent${language ? ` in ${language}` : ''}: hold, or click to start and again to stop`"
      @pointerdown="press" @pointerup="release" @pointercancel="release" @click="key"><Icon name="i-mic" /></button>
  </div>
</template>

<style>
/* The microphone in the bar's middle; red while it records. */
.dictation { display: grid; place-items: center; width: 100%;
  .mic.round[aria-pressed="true"] { color: var(--on-accent); background: var(--danger); } }
</style>
