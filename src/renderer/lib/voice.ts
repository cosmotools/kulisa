// Dictation's state per task (Dictation.vue): whether its agent has its own, whether it records. Asked for as a task is shown; a recording is not left on in a task out of sight.
import { reactive, watch } from 'vue';
import { store } from './store';
import type { Voice } from '../../shared/types';

export const voices = reactive<Record<string, Voice | null>>({}); // task key -> its agent's dictation, null: none

kulisa.on('voice', ({ task, voice }) => { voices[task] = voice; });
export async function record(task: string, on: boolean) {
  const v = voices[task];
  if (!v) return;
  v.recording = on; // at once, as the button is pressed
  const r = await kulisa.invoke('voice:record', { task, on });
  if (voices[task]) voices[task]!.recording = r.recording;
}
watch(() => store.current, async (task, before) => {
  if (before && voices[before]?.recording) void record(before, false);
  if (!task) return;
  const v = await kulisa.invoke('voice:get', task);
  voices[task] = v;
});
