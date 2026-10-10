<script setup lang="ts">
// Dictation (docs/window.md, The terminal): where the shown task's agent has its own (main/agents.js, voice), the
// language it hears and a microphone. The agent records and turns speech into text; Kulisa only holds its key
// (Task.dictate), so nobody has to know the agent's command or key. The microphone works as a voice message's button:
// held, it records until let go; a click starts, another click stops. The text goes where the cursor is in the agent's
// input, after what is there, to read and send. Lit while it records. The language opens a menu of those the agent
// understands, the system's first; it is the agent's own setting, so the agent answers in it too (said on hover).
import { computed } from 'vue';
import Icon from '../Icon.vue';
import { store } from '../../lib/store';
import { openMenu } from '../../lib/menu';
import { ask } from '../../lib/ask';
import { shownTerm } from '../../lib/terminals';
import { record, voices } from '../../lib/voice';

const v = computed(() => (store.current ? voices[store.current] : null));
const name = (code: string, inLanguage = code) => new Intl.DisplayNames([inLanguage], { type: 'language' }).of(code)!;

let down = 0; // when the press that started a recording began
function press(e: PointerEvent) {
  if (e.button) return;
  e.preventDefault(); // the keyboard stays in the terminal
  try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* let go anywhere */ }
  const task = store.current!;
  if (v.value?.recording) { down = 0; record(task, false); } // the second click
  else { down = e.timeStamp; record(task, true); }
}
function release(e: PointerEvent) {
  if (down && e.timeStamp - down > 400) record(store.current!, false); // held; a click leaves it on until the next
  down = 0;
  shownTerm()?.focus();
}
// Enter or Space on it.
const key = (e: MouseEvent) => { if (!e.detail) record(store.current!, !v.value?.recording); };

// The languages the agent understands: the system's first, then by name in each language itself.
function languages(e: MouseEvent) {
  const task = store.current, now = v.value;
  if (!task || !now) return;
  const system = navigator.language.split('-')[0];
  const order = now.languages.toSorted((a, b) => Number(b === system) - Number(a === system) || name(a).localeCompare(name(b)));
  openMenu([{ heading: 'Dictation language' }, ...order.map((code) => ({
    label: name(code), sub: name(code, 'en') === name(code) ? '' : name(code, 'en'), icon: code === now.language ? 'i-done' : undefined,
    run: async () => {
      const r = await kulisa.invoke<{ language?: string; error?: string }>('voice:language', { task, code });
      if (r?.error) return ask({ message: 'The language was not changed', detail: r.error });
      if (voices[task]) voices[task]!.language = r.language!; // as it is now: recording may have changed meanwhile
    },
  }))], e.currentTarget as Element);
}
</script>

<template>
  <!-- The panel is not dragged by its header from here. -->
  <span class="dictation" :hidden="!v" @dragstart.prevent>
    <template v-if="v">
      <button class="icon lang" aria-haspopup="menu" aria-label="Dictation language"
        :title="`Dictation in ${name(v.language, 'en')}: the language you speak${v.note ? `. ${v.note}` : ''}`" @click="languages">{{ v.language.toUpperCase() }}</button>
      <button class="icon mic" aria-label="Speak to the agent" :aria-pressed="v.recording"
        :title="v.recording ? 'Recording: click to stop' : 'Speak to the agent: hold, or click to start and again to stop'"
        @pointerdown="press" @pointerup="release" @pointercancel="release" @click="key"><Icon name="i-mic" /></button>
    </template>
  </span>
</template>

<style>
/* At the header's end; the microphone red while it records. */
.dictation { display: flex; align-items: center; gap: 2px; margin-inline-start: auto;
  &[hidden] { display: none; }
  .lang { font-weight: 600; }
  .mic[aria-pressed="true"] { color: var(--danger); } }
</style>
