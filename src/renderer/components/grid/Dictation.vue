<script setup lang="ts">
// Dictation (docs/window.md, The terminal): the agent records and turns speech into text; Kulisa only holds its key
// (Task.dictate), so nobody has to know the agent's command or key. The language is the agent's own setting, so the
// agent answers in it too. The bar stays when the terminal in front has none (a shell, an agent without its own), its
// microphone disabled: a bar that came and went would resize the terminal, and Claude Code redraws badly after one.
import { computed } from 'vue';
import Icon from '../Icon.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import { store } from '../../lib/store';
import type { MenuItem } from '../../lib/menu';
import { ask } from '../../lib/ask';
import { shownTerm } from '../../lib/terminals';
import { record, voices } from '../../lib/voice';

const v = computed(() => (store.current ? voices[store.current] : null));
const front = computed(() => store.terminals.list.find((t) => t.id === store.terminals.front));
const none = computed(() => (front.value?.agent ? `${front.value.agent.name} has no dictation of its own here` : 'Dictation is the agent\'s: a shell is in front'));
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
  <!-- The panel is not dragged by its bar from here. -->
  <div class="dictation" @dragstart.prevent>
    <button class="icon round mic" aria-label="Speak to the agent" :aria-pressed="!!v?.recording" :disabled="!v"
      :title="!v ? none : v.recording ? 'Recording: click to stop' : 'Speak to the agent: hold, or click to start and again to stop'"
      @pointerdown="press" @pointerup="release" @pointercancel="release" @click="key"><Icon name="i-mic" /></button>
    <ButtonMenu v-if="v" :items="languages"><button class="icon small lang" aria-label="Dictation language"
      :title="`Dictation in ${name(v.language, 'en')}: the language you speak${v.note ? `. ${v.note}` : ''}`">{{ v.language.toUpperCase() }}</button></ButtonMenu>
  </div>
</template>

<style>
/* The microphone in the bar's middle, the language just after it; red while it records. */
.dictation { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 4px; width: 100%;
  .mic { grid-column: 2; }
  .lang { justify-self: start; }
  .mic.round[aria-pressed="true"] { color: var(--on-accent); background: var(--danger); }
  .lang { font-weight: 600; font-size: var(--font-small); width: auto; padding-inline: 4px; } }
</style>
