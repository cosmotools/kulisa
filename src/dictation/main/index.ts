// The dictation's main process half: its entry (../README.md). The caller makes a Dictation (how a task's window is
// told), installs its channels, and tells it the facts only the rest knows: the agent in front of a task, the key, the
// window losing the keyboard, a task gone.
import { handle } from '../../main/ipc.ts';
import { Dictation } from './dictation.ts';

function installDictation(d: Dictation) {
  handle('voice:get', (_e, task) => d.state(task));
  handle('voice:record', (_e, { task, on }) => d.record(task, on));
}

export { Dictation, installDictation };
