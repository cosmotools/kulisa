<script setup lang="ts">
// Dictation (docs/window.md, The terminal): the agent records and turns speech into text; Kulisa only holds its key
// (Task.dictate), so nobody has to know the agent's command or key. Its language is Kulisa's one (☰ → Language). The
// trigger is a key held anywhere in the window (keys.ts, voice.hold; the main process); this button at the end of the
// terminals' row is the key's indicator, lit while it records, and a way for the mouse. The row stays when the terminal
// in front has none (a shell, an agent without its own), the button disabled: a row that came and went would resize
// the terminal, and Claude Code redraws badly after one.
import { computed } from 'vue';
import Icon from '../Icon.vue';
import { store } from '../../lib/store';
import { shownTerm } from '../../lib/terminals';
import { record, voices } from '../../lib/voice';
import { keyText } from '../../lib/common';

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
const title = computed(() => {
  if (!v.value) return none.value;
  if (v.value.recording) return `Recording: let go of ${keyText('voice.hold')}, or click to stop`;
  return `Speak to the agent${language.value ? ` in ${language.value}` : ''}: hold ${keyText('voice.hold')} anywhere, or press it once and again; or this button the same way`;
});
</script>

<template>
  <!-- The panel is not dragged by its row's buttons. -->
  <div class="dictation" @dragstart.prevent>
    <button class="icon round mic" aria-label="Speak to the agent" :aria-pressed="!!v?.recording" :disabled="!v" :title="title"
      @pointerdown="press" @pointerup="release" @pointercancel="release" @click="key"><Icon name="i-mic" /></button>
  </div>
</template>

<style>
/* At the row's end; red while it records, breathing with a ring, as a voice message's button does, so the eye catches
   from across the window that the agent is listening (not with reduced motion: red alone). */
.dictation { display: grid; place-items: center; flex: none; margin-inline-start: auto;
  .mic.round[aria-pressed="true"] { color: var(--on-accent); background: var(--danger); animation: mic-breathe 1.2s ease-in-out infinite; } }
.taskrepos + .dictation { margin-inline-start: 0; }
@keyframes mic-breathe {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 55%, transparent); }
  50% { transform: scale(1.12); box-shadow: 0 0 0 4px color-mix(in srgb, var(--danger) 0%, transparent); }
}
@media (prefers-reduced-motion: reduce) { .dictation .mic.round[aria-pressed="true"] { animation: none; } }
</style>
