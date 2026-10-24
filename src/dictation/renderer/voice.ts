// Each task's microphone as the main process tells it (Dictation.vue).
import { reactive } from 'vue';
import type { Voice } from '../ipc.ts';

export const voices = reactive<Record<string, Voice>>({}); // task key -> its microphone

kulisa.on('voice', ({ task, voice }) => { voices[task] = voice; });
export async function record(task: string, on: boolean) {
  const v = voices[task];
  if (!v || v.state === 'none') return;
  voices[task] = { state: on ? 'recording' : 'ready' }; // at once, as the button is pressed
  voices[task] = await kulisa.invoke('voice:record', { task, on });
}
export async function read(task: string) { voices[task] = await kulisa.invoke('voice:get', task); }
