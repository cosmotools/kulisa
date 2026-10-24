// The dictation of every task (../README.md): what each task's microphone shows, and recording, by the agent's own
// dictation: its key held in its terminal.
import type { Voice } from '../ipc.ts';

const LIMIT = 5 * 60_000; // a recording left on (a click and no second one)
const HOLD = 400; // the key down longer is held (records until let go), shorter is a press (until the next)

// The agent in front of a task, as the caller tells it. input: its terminal, where its key is typed (null: not
// started yet); a new one is another program, and a recording there stops.
interface Target {
  id: string; name: string;
  voice?: { key: string; repeat: number }; // its own dictation: the key typed again and again while it records
  input: { write(data: string): void } | null;
}
interface State { task: string; target: Target | null; recording: { input: Target['input']; timer: NodeJS.Timeout } | null; held: number }

class Dictation {
  tasks = new Map<string, State>();
  send: (task: string, voice: Voice) => void;
  // send: a task's microphone changed, to the window that shows it.
  constructor(send: (task: string, voice: Voice) => void) { this.send = send; }
  of(task: string) {
    let s = this.tasks.get(task);
    if (!s) this.tasks.set(task, s = { task, target: null, recording: null, held: 0 });
    return s;
  }
  state(task: string): Voice {
    const { target, recording } = this.of(task);
    if (!target) return { state: 'none', why: "Dictation is the agent's: a shell is in front" };
    if (!target.voice) return { state: 'none', why: `${target.name} has no dictation of its own here` };
    return { state: recording ? 'recording' : 'ready' };
  }
  changed(task: string) { this.send(task, this.state(task)); }
  recording(task: string) { return !!this.tasks.get(task)?.recording; }

  // The agent in front of the task, or none (a shell, no terminal); a recording in another one stops.
  shown(task: string, target: Target | null) {
    const s = this.of(task), was = s.target;
    s.target = target;
    if (s.recording && (target?.id !== was?.id || target?.input !== s.recording.input)) this.stop(s);
    this.changed(task);
  }
  // The dictation's key, as the microphone: held, it records until let go; pressed once, until the next press, or a
  // press while it records stops it.
  key(task: string, down: boolean) {
    const s = this.of(task);
    if (down) {
      if (s.recording && !s.held) this.stop(s);
      else { s.held = Date.now(); this.start(s); }
    } else {
      if (s.held && Date.now() - s.held > HOLD) this.stop(s);
      s.held = 0;
    }
    this.changed(task);
  }
  // The window lost the keyboard while the key is down: its release will never be seen, so the recording ends here.
  letGo(task: string) {
    const s = this.tasks.get(task);
    if (!s?.held) return;
    s.held = 0;
    this.stop(s);
    this.changed(task);
  }
  // The microphone's click or press (the window).
  record(task: string, on: boolean): Voice {
    const s = this.of(task);
    if (on) this.start(s); else this.stop(s);
    return this.state(task);
  }
  // The task closed: nothing of it records.
  gone(task: string) {
    const s = this.tasks.get(task);
    if (s) this.stop(s);
    this.tasks.delete(task);
  }

  // Recording: the agent's key held, as a terminal shows a held key, its repeats. It stops when told, after LIMIT, or
  // when that agent is no longer in front.
  start(s: State) {
    this.stop(s);
    const v = s.target?.voice, input = s.target?.input;
    if (!v || !input) return;
    const until = Date.now() + LIMIT;
    s.recording = { input, timer: setInterval(() => {
      if (Date.now() < until) return input.write(v.key);
      this.stop(s);
      this.changed(s.task);
    }, v.repeat) };
  }
  stop(s: State) {
    clearInterval(s.recording?.timer);
    s.recording = null;
  }
}

export { Dictation };
