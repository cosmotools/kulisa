// The dictation of every task (../README.md): what each task's microphone shows, and recording, the first way there
// is: the agent's own dictation (its key held in its terminal), else the hidden session (hidden.ts) recognizing for it.
import type { Voice } from '../ipc.ts';
import { Hidden } from './hidden.ts';
import type { Hold, Recognizer, Spawn } from './hidden.ts';

const LIMIT = 5 * 60_000; // a recording left on (a click and no second one)
const HOLD = 400; // the key down longer is held (records until let go), shorter is a press (until the next)

// The agent in front of a task, as the caller tells it. input: its terminal, where its own dictation's key is typed
// (null: not started yet); a new one is another program, and a recording there stops. type: text put into its input
// for the human to read and send; erase: the last n characters typed there deleted.
interface Target {
  id: string; name: string;
  voice?: { key: string; repeat: number }; // its own dictation: the key typed again and again while it records
  input: { write(data: string): void } | null;
  type(text: string): void;
  erase(n: number): void;
}
// A recording: by the agent's own dictation, or by the hidden session (hold), heard from when it listens.
interface Recording { input: Target['input']; timer: NodeJS.Timeout; hold?: Hold; listening?: boolean }
interface State { task: string; target: Target | null; recording: Recording | null; held: number }

class Dictation {
  tasks = new Map<string, State>();
  send: (task: string, voice: Voice) => void;
  hidden: Hidden | null;
  // send: a task's microphone changed, to the window that shows it. recognizer: for agents without their own
  // dictation (none: they have none). spawn: how its session starts (a unit test's fake).
  constructor(send: (task: string, voice: Voice) => void, { recognizer, spawn }: { recognizer?: Recognizer; spawn?: Spawn } = {}) {
    this.send = send;
    this.hidden = recognizer ? new Hidden(recognizer, spawn) : null;
  }
  of(task: string) {
    let s = this.tasks.get(task);
    if (!s) this.tasks.set(task, s = { task, target: null, recording: null, held: 0 });
    return s;
  }
  state(task: string): Voice {
    const { target, recording } = this.of(task);
    if (!target) return { state: 'none', why: "Dictation is the agent's: a shell is in front" };
    if (!target.voice) {
      if (!this.hidden) return { state: 'none', why: `${target.name} has no dictation of its own here` };
      const why = this.hidden.available();
      if (why !== null) return { state: 'none', why: `${target.name} has no dictation of its own, and ${why}` };
    }
    if (!recording) return { state: 'ready' };
    return { state: recording.hold && !recording.listening ? 'starting' : 'recording' };
  }
  changed(task: string) { this.send(task, this.state(task)); }
  recording(task: string) { return !!this.tasks.get(task)?.recording; }

  // The agent in front of the task, or none (a shell, no terminal); a recording in another one stops.
  shown(task: string, target: Target | null) {
    const s = this.of(task), was = s.target;
    s.target = target;
    if (s.recording && (target?.id !== was?.id || (target?.voice && target.input !== s.recording.input))) this.stop(s);
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
  // What the hidden session heard, posted by its hook.
  dictated(text: string) { this.hidden?.dictated(text); }
  // Kulisa quits: nothing records, the hidden session ends.
  close() { for (const s of this.tasks.values()) this.stop(s); this.hidden?.close(); }

  // Recording: the agent's key held, as a terminal shows a held key, its repeats; or the hidden session's. It stops
  // when told, after LIMIT, or when that agent is no longer in front.
  start(s: State) {
    this.stop(s);
    const t = s.target;
    if (!t) return;
    const v = t.voice, input = t.input;
    if (v) {
      if (!input) return;
      const until = Date.now() + LIMIT;
      s.recording = { input, timer: setInterval(() => {
        if (Date.now() < until) return input.write(v.key);
        this.stop(s);
        this.changed(s.task);
      }, v.repeat) };
      return;
    }
    const hidden = this.hidden;
    if (!hidden || hidden.available() !== null) return;
    const hold: Hold = {
      on: true,
      listening: () => { if (s.recording?.hold === hold) { s.recording.listening = true; this.changed(s.task); } },
      failed: () => { if (s.recording?.hold === hold) { this.stop(s); this.changed(s.task); } },
      // The words go into the input of the agent they were spoken to, while it is in front, as they are heard, then
      // the text: each time only what changed is erased and typed again (punctuation and case change at the end).
      words: (words) => put(words),
      text: (text) => put(text),
    };
    let shown: string[] = [];
    const put = (text: string) => {
      if (s.target?.id !== t.id) return;
      const next = [...text];
      let same = 0;
      while (same < shown.length && same < next.length && shown[same] === next[same]) same++;
      if (shown.length > same) s.target.erase(shown.length - same);
      if (next.length > same) s.target.type(next.slice(same).join(''));
      shown = next;
    };
    s.recording = { input, hold, timer: setTimeout(() => { this.stop(s); this.changed(s.task); }, LIMIT) };
    void hidden.start(hold);
  }
  stop(s: State) {
    const r = s.recording;
    if (!r) return;
    clearInterval(r.timer);
    s.recording = null;
    if (r.hold) this.hidden!.release(r.hold);
  }
}

export { Dictation };
