// Each task's microphone as the main process tells it, for the microphone and the pill (../README.md).
import { createStore, useStore } from 'zustand';
import type { Voice } from '../ipc.ts';

type Voices = {
  voices: Record<string, Voice>; // task key -> its microphone
  slow: Record<string, true>; // task key -> starting for longer than SLOW
  done: Record<string, string>; // task key -> the agent whose input its text went into, just now
};
const store = createStore<Voices>()(() => ({ voices: {}, slow: {}, done: {} }));
export const useVoices = <T>(pick: (s: Voices) => T) => useStore(store, pick);

// Starting is shown as such only when it lasts: the hidden session mostly listens in a fifth of a second, and a
// flash of "getting ready" before every recording reads as a glitch.
const SLOW = 300;
const DONE = 1600; // the text put in: shown so long, then it goes
const slowTimers = new Map<string, ReturnType<typeof setTimeout>>();
const doneTimers = new Map<string, ReturnType<typeof setTimeout>>();
const without = <T>(o: Record<string, T>, key: string) => { const { [key]: _, ...rest } = o; return rest; };

function set(task: string, voice: Voice) {
  const s = store.getState(), was = s.voices[task];
  let { slow, done } = s;
  if (voice.state === 'starting') {
    if (!slowTimers.has(task)) slowTimers.set(task, setTimeout(() => store.setState((t) => ({ slow: { ...t.slow, [task]: true } })), SLOW));
  } else {
    clearTimeout(slowTimers.get(task));
    slowTimers.delete(task);
    slow = without(slow, task);
  }
  if (was?.state === 'transcribing' && voice.state === 'ready') {
    done = { ...done, [task]: was.to };
    clearTimeout(doneTimers.get(task));
    doneTimers.set(task, setTimeout(() => { doneTimers.delete(task); store.setState((t) => ({ done: without(t.done, task) })); }, DONE));
  } else if (voice.state !== 'ready') {
    clearTimeout(doneTimers.get(task));
    doneTimers.delete(task);
    done = without(done, task);
  }
  store.setState({ voices: { ...s.voices, [task]: voice }, slow, done });
}
kulisa.on('voice:state', ({ task, voice }) => set(task, voice));

export const recording = (v: Voice | undefined) => v?.state === 'recording' || v?.state === 'starting';
export async function record(task: string, on: boolean) {
  const v = store.getState().voices[task];
  if (!v || v.state === 'none') return;
  set(task, await kulisa.invoke('voice:record', { task, on }));
}
export async function read(task: string) { set(task, await kulisa.invoke('voice:get', task)); }
// A recording is not left on in a task out of sight.
export function leave(task: string) { if (recording(store.getState().voices[task])) void record(task, false); }
