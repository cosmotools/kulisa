<script setup lang="ts">
// Dictation (docs/window.md, The terminal): the agent records and turns speech into text; Kulisa only holds its key
// (Task.dictate), so nobody has to know the agent's command or key. The language is the agent's own setting, so the
// agent answers in it too.
import { computed } from 'vue';
import Icon from '../Icon.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import { store } from '../../lib/store';
import type { MenuItem } from '../../lib/menu';
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

// The languages the agent understands: the system's first, then by name in each language itself.
function languages(): MenuItem[] {
  const task = store.current, now = v.value;
  if (!task || !now) return [];
  const system = navigator.language.split('-')[0];
  const order = now.languages.toSorted((a, b) => Number(b === system) - Number(a === system) || name(a).localeCompare(name(b)));
  return [{ heading: 'Dictation language' }, {
    chosen: now.language,
    rows: order.map((code) => ({ value: code, label: name(code), sub: name(code, 'en') === name(code) ? '' : name(code, 'en') })),
    async choose(code) {
      const r = await kulisa.invoke<{ language?: string; error?: string }>('voice:language', { task, code });
      if (r?.error) return ask({ message: 'The language was not changed', detail: r.error });
      if (voices[task]) voices[task]!.language = r.language!; // as it is now: recording may have changed meanwhile
    },
  }];
}
</script>

<template>
  <!-- The panel is not dragged by its header from here. -->
  <span class="dictation" :hidden="!v" @dragstart.prevent>
    <template v-if="v">
      <ButtonMenu :items="languages"><button class="icon lang" aria-label="Dictation language"
        :title="`Dictation in ${name(v.language, 'en')}: the language you speak${v.note ? `. ${v.note}` : ''}`">{{ v.language.toUpperCase() }}</button></ButtonMenu>
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
