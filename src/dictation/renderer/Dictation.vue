<script setup lang="ts">
// The dictation's microphone (../README.md): the key's indicator, lit while it records, and a way for the mouse. The
// trigger is a key held anywhere in the window (the main process). It stays when the agent in front has none, disabled:
// a button that came and went would resize the terminal, and Claude Code redraws badly after one.
// task: the task shown; keyName: the key, as the window names it; language: what it hears; done: let go, the keyboard
// goes back to the terminal. The button is the slot's (the window's): mic, its attributes and handlers, bound to it.
import { computed, watch } from 'vue';
import { read, record, slow, voices } from './voice';

const props = defineProps<{ task: string | null; keyName: string; language: string }>();
const emit = defineEmits<{ done: [] }>();

const v = computed(() => (props.task ? voices[props.task] : undefined));
// Starting (the hidden session getting ready) is recording to the human: the key is down, a second press stops it.
const recording = computed(() => v.value?.state === 'recording' || v.value?.state === 'starting');
const state = computed(() => (v.value?.state === 'starting' && !slow[props.task!] ? 'recording' : v.value?.state));
// A recording is not left on in a task out of sight.
watch(() => props.task, async (task, before) => {
  if (before && ['recording', 'starting'].includes(voices[before]?.state ?? '')) void record(before, false);
  if (task) await read(task);
}, { immediate: true });

let down = 0; // when the press that started a recording began
function press(e: PointerEvent) {
  if (e.button) return;
  e.preventDefault(); // the keyboard stays in the terminal
  try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* let go anywhere */ }
  const task = props.task!;
  if (recording.value) { down = 0; void record(task, false); } // the second click
  else { down = e.timeStamp; void record(task, true); }
}
function release(e: PointerEvent) {
  if (down && e.timeStamp - down > 400) void record(props.task!, false); // held; a click leaves it on until the next
  down = 0;
  emit('done');
}
// Enter or Space on it.
const key = (e: MouseEvent) => { if (!e.detail) void record(props.task!, !recording.value); };
const title = computed(() => {
  if (!v.value) return '';
  if (v.value.state === 'none') return v.value.why;
  if (v.value.state === 'starting') return 'Getting ready to listen: speak once the microphone is red';
  if (recording.value) return `Recording: let go of ${props.keyName}, or click to stop`;
  return `Speak to the agent${props.language ? ` in ${props.language}` : ''}: hold ${props.keyName} anywhere, or press it once and again; or this button the same way`;
});
</script>

<template>
  <slot :mic="{ 'aria-label': 'Speak to the agent', 'aria-pressed': recording, 'data-state': state, 'disabled': !v || v.state === 'none', title,
                onPointerdown: press, onPointerup: release, onPointercancel: release, onClick: key }" />
</template>
