// The dictation (main/): an agent without its own recognized for by the hidden session, against a fake recognizer
// whose session is a fake program drawn as Claude Code's (its prompt, "listening" while its key comes); its hook is
// the test calling dictated. Plain Node (npm run test:unit).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Dictation } from './main/index.ts';
import type { Recognizer } from './main/index.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(test: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!test()) { if (Date.now() > end) throw new Error('not in time'); await sleep(10); }
}

// A session: draws its prompt with its placeholder (dim, unless broken), "listening" once its key comes, and the words
// heard so far after its prompt as Claude Code does (grey, its level meter after them), one more every eight keys; what
// it is sent, kept.
type Fake = { id: string; got: string[]; killed: boolean; exit: () => void };
function fakeProgram(id: string, { broken = false, heard = [] as string[] } = {}) {
  let data: (d: string) => void = () => {}; const exits: (() => void)[] = [];
  const f: Fake = { id, got: [], killed: false, exit: () => exits.forEach((x) => x()) };
  let n = 0;
  const proc = {
    write: (d: string) => {
      f.got.push(d);
      if (d !== ' ') return;
      const words = heard[Math.min(Math.floor(n++ / 8), heard.length - 1)];
      data(`\x1b[3;1Hlistening…\x1b[1;1H\x1b[2K❯ ${words ? `\x1b[38;2;153;153;153m${words}\x1b[0m` : ''}\x1b[38;2;80;200;120m▇\x1b[0m`);
    },
    kill: () => { f.killed = true; setTimeout(f.exit, 5); },
    onData: (fn: (d: string) => void) => { data = fn; if (!broken) setTimeout(() => fn('❯ \x1b[2mTry "edit a file"\x1b[22m'), 20); else setTimeout(f.exit, 20); },
    onExit: (fn: () => void) => { exits.push(fn); },
  };
  return { f, proc };
}
// accounts: their ids in order, the broken ones' sessions exiting at once.
function setup(accounts = ['a1'], broken: string[] = [], heard: string[] = []) {
  const sessions: Fake[] = [], forgot: string[] = [], skips: string[][] = [], sent: { task: string; state: string; why?: string }[] = [];
  const recognizer: Recognizer = {
    available: () => (accounts.length ? null : 'it needs Claude Code signed in'),
    start: async (skip) => {
      skips.push([...skip]);
      const id = accounts.find((a) => !skip.includes(a));
      return id ? { id, command: 'x', args: [], env: {}, cwd: '/', key: ' ', repeat: 10, clear: '\x15', submit: '\r' } : { error: 'no account could start its dictation' };
    },
    forget: (id) => forgot.push(id),
  };
  const d = new Dictation((task, v) => sent.push({ task, ...v }), { recognizer, spawn: (spec) => {
    const { f, proc } = fakeProgram(spec.id, { broken: broken.includes(spec.id), heard });
    sessions.push(f);
    return proc;
  } });
  // Codex's input: what is typed there and erased from its end.
  const typed: string[] = [];
  let input = '';
  const codex = { id: 't#1', name: 'Codex', input: { write() {} },
    type: (text: string) => { typed.push(text); input += text; }, erase: (n: number) => { input = [...input].slice(0, -n).join(''); } };
  d.shown('t', codex);
  return { d, sessions, forgot, skips, sent, typed, codex, input: () => input, state: () => d.state('t').state };
}
const held = async (d: Dictation, ms = 500) => { d.key('t', true); await sleep(ms); d.key('t', false); };

test('dictation: an agent without its own is recognized for by the hidden session: getting ready, then recording once it listens; let go, the text it heard goes into that agent\'s input; its input emptied first', async () => {
  const { d, sessions, typed, state } = setup();
  assert.equal(state(), 'ready');
  d.key('t', true);
  assert.equal(state(), 'starting', 'getting ready: nobody speaks before it hears');
  await until(() => state() === 'recording');
  const s = sessions[0]!;
  assert.deepEqual(s.got.slice(0, 4), ['\x15', '\x15', '\x15', ' '], 'the last text, put back after its block, deleted first');
  await sleep(450);
  d.key('t', false);
  assert.equal(state(), 'ready');
  const keys = s.got.length;
  await sleep(50);
  assert.equal(s.got.length, keys, 'no more of its key once let go');
  d.dictated('Open the admin profile.');
  assert.deepEqual(typed, ['Open the admin profile.']);
  d.dictated('Late.');
  assert.deepEqual(typed, ['Open the admin profile.'], 'nothing waits for it: dropped');
  // The next one: the same session, its input emptied again.
  await held(d);
  assert.equal(sessions.length, 1, 'one session for every dictation');
  d.dictated('And the settings page.');
  assert.deepEqual(typed, ['Open the admin profile.', 'And the settings page.']);
  d.close();
});

test('dictation: a short one (under three words its autoSubmit does not send) is submitted by its key a second after letting go', async () => {
  const { d, sessions, typed } = setup();
  await held(d);
  const s = sessions[0]!;
  assert.ok(!s.got.includes('\r'));
  await until(() => s.got.at(-1) === '\r', 2000);
  d.dictated('Run tests.');
  assert.deepEqual(typed, ['Run tests.']);
  d.close();
});

test("dictation: the text goes only to the agent it was spoken to while it is in front; another in front, it is dropped", async () => {
  const { d, typed, codex } = setup();
  await held(d);
  d.shown('t', { ...codex, id: 't#2' });
  d.dictated('For the first one.');
  assert.deepEqual(typed, []);
  d.close();
});

test('dictation: an account whose session fails gives way to the next; none left, the microphone is disabled saying why, and its records go', async () => {
  const { d, sessions, skips, forgot, state } = setup(['a1', 'a2'], ['a1']);
  d.key('t', true);
  await until(() => state() === 'recording');
  assert.deepEqual(sessions.map((s) => s.id), ['a1', 'a2']);
  assert.deepEqual(skips, [[], ['a1']]);
  await until(() => forgot.includes('a1'));
  d.key('t', true); // pressed again: stops
  d.close();
  await until(() => forgot.includes('a2'));
  assert.ok(sessions[1]!.killed, 'ended with Kulisa');
  const all = setup(['b1'], ['b1']);
  all.d.key('t', true);
  await until(() => all.state() === 'none');
  assert.deepEqual(all.d.state('t'), { state: 'none', why: 'Codex has no dictation of its own, and no account could start its dictation' });
  assert.ok(all.sent.at(-1)!.state === 'none', 'told to the window');
  all.d.close();
  assert.equal(all.state(), 'ready', 'tried again after its time');
});

test('dictation: no account can recognize: an agent without its own has the microphone disabled, saying why; an agent with its own and a shell are as before', () => {
  const { d } = setup([]);
  assert.deepEqual(d.state('t'), { state: 'none', why: 'Codex has no dictation of its own, and it needs Claude Code signed in' });
  d.shown('t', { id: 't#3', name: 'Claude Code', voice: { key: ' ', repeat: 33 }, input: { write() {} }, type() {}, erase() {} });
  assert.deepEqual(d.state('t'), { state: 'ready' });
  d.shown('t', null);
  assert.deepEqual(d.state('t'), { state: 'none', why: "Dictation is the agent's: a shell is in front" });
  const alone = new Dictation(() => {});
  alone.shown('t', { id: 't#1', name: 'Codex', input: null, type() {}, erase() {} });
  assert.deepEqual(alone.state('t'), { state: 'none', why: 'Codex has no dictation of its own here' });
});

test('dictation: the words go into that agent\'s input as they are heard, then the text; each time only what changed is erased and typed again; its placeholder and level meter are no words', async () => {
  const { d, typed, input } = setup(['a1'], [], ['', 'open', 'open the', 'open the admin', 'open the admin profile']);
  after(() => d.close());
  d.key('t', true);
  await until(() => input() === 'open the');
  assert.deepEqual(typed.slice(0, 2), ['open', ' the'], 'only what is new typed');
  await until(() => input() === 'open the admin profile');
  await sleep(450);
  d.key('t', false);
  d.dictated('Open the admin profile.');
  assert.equal(input(), 'Open the admin profile.', 'the text in the end: case and punctuation corrected');
  assert.ok(!typed.some((x) => x.includes('Try') || /[▁-█]/.test(x)));
  d.close();
});
