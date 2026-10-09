// Voice commands (listen.js): the phrases as the model's tokens, and what each phrase and pause does.
const { test } = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Commands, tokenize, ensureModel, PHRASES, MODEL, FOLDER } = require('../../src/main/listen');

test('a phrase is the model\'s tokens, each word starting with ▁, the longest piece first', () => {
  const vocab = new Set(['▁э', 'й', '▁ку', '▁к', 'ли', 'л', 'и', 'са', 'с', 'а', '▁отправ', 'ь']);
  assert.equal(tokenize(vocab, 'Эй  Кулиса'), '▁э й ▁ку ли са');
  assert.equal(tokenize(vocab, 'кулиса отправь'), '▁ку ли са ▁отправ ь');
  assert.throws(() => tokenize(vocab, 'стоп'), /no token/);
  for (const say of Object.values(PHRASES)) assert.match(say, /кулиса/); // the name in each: no command without it
});

// The agent's side as the core does it, and a clock moved by hand.
function setup() {
  const log = [], clock = { t: 1000 };
  const ws = { dictating: false };
  const c = new Commands({
    dictating: () => ws.dictating,
    dictate: (on) => { ws.dictating = on; log.push(on ? 'record' : 'stop recording'); },
    press: (key) => log.push(key),
    cue: () => log.push('cue'),
  }, () => clock.t);
  return { c, log, ws, clock, at: (t) => { clock.t = 1000 + t; } };
}

test('the name starts dictation with a tone; the pause after it does not end it, the one after the task does', () => {
  const { c, log, at } = setup();
  c.speech(true); c.heard('hey'); // "Эй, Кулиса", then a breath
  at(700); c.speech(false);
  assert.deepEqual(log, ['record', 'cue']);
  at(1800); c.speech(true); // the task
  at(5000); c.speech(false);
  assert.deepEqual(log, ['record', 'cue', 'stop recording']);
});

test('the name and the task in one breath: dictation ends when the speech does', () => {
  const { c, log, at } = setup();
  c.speech(true); c.heard('hey');
  at(4000); c.speech(false);
  assert.deepEqual(log, ['record', 'cue', 'stop recording']);
});

test('the name and nothing after it: dictation ends by itself', () => {
  const { c, log, at } = setup();
  c.heard('hey');
  at(7000); c.tick();
  assert.deepEqual(log, ['record', 'cue']);
  at(8500); c.tick();
  assert.deepEqual(log, ['record', 'cue', 'stop recording']);
});

test('"отправь" is Enter and "стоп" is Esc when nothing records', () => {
  const { c, log } = setup();
  c.heard('send'); c.heard('stop');
  assert.deepEqual(log, ['enter', 'escape']);
});

test('a phrase while the agent records only ends the recording: its words are in the text, so nothing is sent', () => {
  const { c, log, ws } = setup();
  ws.dictating = true; // the microphone button
  c.heard('send');
  assert.deepEqual(log, ['stop recording']);
});

test('a dictation started by the button is the human\'s: a pause does not end it', () => {
  const { c, log, ws, at } = setup();
  ws.dictating = true;
  c.speech(true); at(3000); c.speech(false); at(20000); c.tick();
  assert.deepEqual(log, []);
});

test('a dictation by voice ended by the button meanwhile is not ended again', () => {
  const { c, log, ws, at } = setup();
  c.heard('hey');
  ws.dictating = false; // the human clicked the microphone
  at(3000); c.speech(false); at(9000); c.tick();
  assert.deepEqual(log, ['record', 'cue']);
});

test('the model kept is the current version only: another version\'s folder goes', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-listen-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const base = path.join(root, FOLDER);
  fs.mkdirSync(path.join(base, 'ru-0'), { recursive: true });
  fs.mkdirSync(path.join(base, MODEL.id));
  fs.writeFileSync(path.join(base, MODEL.id, 'done'), ''); // downloaded: nothing is fetched
  assert.equal(await ensureModel(root, () => {}), path.join(base, MODEL.id));
  assert.deepEqual(fs.readdirSync(base), [MODEL.id]);
});
