// The hidden session (../README.md, For an agent without dictation): an agent's own dictation in a terminal no one
// sees, recognizing for the agent in front of a task. One for the whole of Kulisa, started at the first dictation,
// ended after IDLE without one; the text it submits comes back by its hook (dictated).
import xterm from '@xterm/headless';
import { log } from '../../main/log.ts';

const IDLE = 10 * 60_000; // no dictation that long: its memory is let go (~190 MB), the next one waits ~1 s for it
const READY = 15_000; // its prompt drawn after its start, else it failed
const LISTENING = 5_000; // its key held: listening by then, else it failed
const SUBMIT = 1_000; // let go, no text by then: a short one stays in its input (under three words), sent by its submit key
const TEXT = 4_000; // let go, no text by then: nothing was heard
// Its screen: wide, so its input is one line (its clear key deletes a line).
const COLS = 500, ROWS = 50;

// How the caller starts it: an account of an agent whose dictation recognizes (its entry's recognizer, src/main/agents).
interface Spec {
  id: string; // the account, which forget gets back
  command: string; args: string[]; env: Record<string, string | undefined>; cwd: string;
  key: string; repeat: number; // its dictation's key, typed again and again while it records
  clear: string; submit: string; // the keys that empty its input and submit it
}
interface Recognizer {
  available(): string | null; // why no account can recognize, or null
  start(skip: string[]): Promise<Spec | { error: string }>; // one not in skip (they failed)
  forget(id: string): void; // what its session kept in its account goes
}
interface Proc { write(data: string): void; kill(): void; onData(fn: (d: string) => void): unknown; onExit(fn: () => void): unknown }
type Spawn = (s: Spec, cols: number, rows: number) => Proc | Promise<Proc>;

// node-pty loaded when a session starts, not with the module: a unit test loads it in plain Node.
const spawnPty: Spawn = async (s, cols, rows) =>
  (await import('node-pty')).default.spawn(s.command, s.args, { name: 'xterm-256color', cols, rows, cwd: s.cwd, env: s.env });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Session {
  proc: Proc; spec: Spec; screen: InstanceType<typeof xterm.Terminal>; exited = false;
  constructor(proc: Proc, spec: Spec) {
    this.proc = proc; this.spec = spec;
    this.screen = new xterm.Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
    proc.onData((d) => this.screen.write(d));
    this.screen.onData((d) => proc.write(d)); // its questions to the terminal answered, as a terminal does
    proc.onExit(() => { this.exited = true; });
  }
  text() {
    const b = this.screen.buffer.active, lines: string[] = [];
    for (let i = 0; i < b.length; i++) lines.push(b.getLine(i)?.translateToString(true) ?? '');
    return lines.join('\n');
  }
  async until(test: (text: string) => boolean, ms: number) {
    const end = Date.now() + ms;
    while (Date.now() < end && !this.exited) { if (test(this.text())) return true; await sleep(20); }
    return false;
  }
}

// A held key's life: it records until let go; text: the transcript, once it comes.
interface Hold { listening: () => void; failed: (why: string) => void; text: (text: string) => void; on: boolean }

class Hidden {
  recognizer: Recognizer; spawn: Spawn;
  session: Session | null = null; opening: Promise<Session | { error: string }> | null = null;
  failed: string[] = []; // the accounts whose session failed since the last one ended
  broken: string | null = null; // every account failed: why, until the session's time is over (close)
  hold: Hold | null = null; keys: NodeJS.Timeout | null = null; waiting: NodeJS.Timeout[] = []; idle: NodeJS.Timeout | null = null;
  constructor(recognizer: Recognizer, spawn: Spawn = spawnPty) { this.recognizer = recognizer; this.spawn = spawn; }

  available() { return this.broken ?? this.recognizer.available(); }

  // Its session, started when there is none; an account that fails gives way to the next.
  open(): Promise<Session | { error: string }> {
    if (this.session && !this.session.exited) return Promise.resolve(this.session);
    return this.opening ||= (async () => {
      try {
        for (;;) {
          const spec = await this.recognizer.start(this.failed);
          if ('error' in spec) return spec;
          let s: Session | null = null;
          try { s = new Session(await this.spawn(spec, COLS, ROWS), spec); } catch (e) { log.info(`[dictation] ${spec.id} did not start: ${(e as Error).message}`); }
          // Its records go once it has exited, however it ends: it writes them to the last.
          const started = s;
          started?.proc.onExit(() => { if (this.session === started) this.session = null; this.recognizer.forget(spec.id); });
          if (s && await s.until((t) => t.includes('❯'), READY)) {
            log.info(`[dictation] hidden session started (${spec.id})`);
            this.session = s;
            return s;
          }
          if (s) { log.info(`[dictation] ${spec.id}'s session showed no prompt`); this.end(s); }
          this.failed.push(spec.id);
        }
      } finally { this.opening = null; }
    })();
  }

  // The key held: it records until release. listening once it hears; failed when no account can.
  async start(hold: Hold) {
    if (this.hold) this.release(this.hold);
    this.cancel();
    this.hold = hold;
    clearTimeout(this.idle!);
    const s = await this.open();
    if (this.hold !== hold || !hold.on) return;
    if ('error' in s) {
      this.broken = s.error;
      this.rest();
      return hold.failed(s.error);
    }
    for (let i = 0; i < 3; i++) s.proc.write(s.spec.clear); // the text of the last one, put back after its block
    this.keys = setInterval(() => s.proc.write(s.spec.key), s.spec.repeat);
    s.proc.write(s.spec.key);
    if (await s.until((t) => /listening/i.test(t), LISTENING)) { if (this.hold === hold && hold.on) hold.listening(); return; }
    if (this.hold !== hold || !hold.on) return;
    log.info(`[dictation] ${s.spec.id}'s session did not listen`);
    this.failed.push(s.spec.id);
    this.end(s);
    void this.start(hold); // the next account
  }
  // Let go: the transcript comes by the hook; a short one is submitted by its key.
  release(hold: Hold) {
    if (hold !== this.hold) return;
    const s = this.session;
    clearInterval(this.keys!); this.keys = null;
    if (!hold.on) return;
    hold.on = false;
    this.rest();
    if (!s) return;
    this.waiting.push(setTimeout(() => { if (this.hold === hold) s.proc.write(s.spec.submit); }, SUBMIT),
      setTimeout(() => { if (this.hold === hold) this.hold = null; }, TEXT));
  }
  // Its time without a dictation starts again.
  rest() { clearTimeout(this.idle!); this.idle = setTimeout(() => this.close(), IDLE); }
  cancel() { for (const t of this.waiting) clearTimeout(t); this.waiting = []; }
  // What its hook posted: the text it heard, for the one that held the key.
  dictated(text: string) {
    const hold = this.hold;
    this.cancel();
    if (!hold || hold.on) return; // none waits for it: dropped
    this.hold = null;
    if (text.trim()) hold.text(text.trim());
  }

  end(s: Session) {
    if (this.session === s) this.session = null;
    if (!s.exited) s.proc.kill();
  }
  // Ended: no dictation for IDLE, or Kulisa quits.
  close() {
    clearTimeout(this.idle!); clearInterval(this.keys!); this.cancel();
    this.hold = null; this.failed = []; this.broken = null;
    if (this.session) { log.info('[dictation] hidden session ended'); this.end(this.session); }
  }
}

export { Hidden };
export type { Hold, Recognizer, Spawn };
