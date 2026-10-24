// Each task's microphone as the main process tells it (Dictation.vue, Pill.vue).
import { reactive } from 'vue';
import type { Voice } from '../ipc.ts';

export const voices = reactive<Record<string, Voice>>({}); // task key -> its microphone
// Starting is shown as such only when it lasts: the hidden session mostly listens in a fifth of a second, and a
// flash of "getting ready" before every recording reads as a glitch.
const SLOW = 300;
export const slow = reactive<Record<string, boolean>>({}); // task key -> starting for longer than SLOW
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function set(task: string, voice: Voice) {
  voices[task] = voice;
  if (voice.state === 'starting') {
    if (!timers.has(task)) timers.set(task, setTimeout(() => { slow[task] = true; }, SLOW));
    return;
  }
  clearTimeout(timers.get(task));
  timers.delete(task);
  delete slow[task];
}
kulisa.on('voice', ({ task, voice }) => set(task, voice));
export async function record(task: string, on: boolean) {
  if (!voices[task] || voices[task].state === 'none') return;
  set(task, await kulisa.invoke('voice:record', { task, on }));
}
export async function read(task: string) { set(task, await kulisa.invoke('voice:get', task)); }
