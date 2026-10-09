// Voice commands (docs/window.md, The terminal): with them on, Kulisa listens for its name and a few short phrases and
// does what the human's hands would: "Эй, Кулиса" starts the agent's dictation (Workspace.dictate) and a pause ends
// it; "Кулиса, отправь" is Enter in the agent's input, "Кулиса, стоп" is Esc. Only those phrases are recognized, on
// the computer (listen-worker.js, a process of its own while they are on); what the human dictates is the agent's
// own recognition, as with the microphone button. Russian only for now (ROADMAP).
//   new Listener(shell, root)  the model kept in root (Kulisa's data folder)
//                         listener.set(window, on) turns them on (downloading the model the first time) or off;
//                         listener.audio(window, samples) the window's microphone (listen.js in the renderer)
//   Commands              what each phrase and pause does, apart from the process, for the tests
//   tokenize(vocab, text) a phrase as the model's tokens, as its keyword spotter takes it
//   ensureModel(root, progress)  the model's folder in root, downloaded when missing
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

// The model, downloaded the first time voice commands are turned on (about 30 MB): the small streaming Russian
// model of Vosk's makers (Apache-2.0) and Silero VAD (MIT), at fixed revisions, checked by their SHA-256. A new
// version of the model is a new folder; the old one goes when the new one is in place.
const ALPHACEP = 'https://huggingface.co/alphacep/vosk-model-small-streaming-ru/resolve/e18123ee13f694036a1eea82eb43f9895387cb59/';
const SILERO = 'https://huggingface.co/onnx-community/silero-vad/resolve/e71cae966052b992a7eca6b17738916ce0eca4ec/';
const MODEL = {
  id: 'ru-1',
  files: [
    ['encoder.int8.onnx', ALPHACEP + 'am-onnx/encoder.int8.onnx', 'e0db705e94ec35d803b1df4f40cda23d064e1142977c80ab288430b109777a9d'],
    ['decoder.onnx', ALPHACEP + 'am-onnx/decoder.onnx', '89b3088a9e20e1ef7f2e85ce1a3478afe6a9c4ac57369cabcc4beb8e95328ea0'],
    ['joiner.int8.onnx', ALPHACEP + 'am-onnx/joiner.int8.onnx', 'b55784b071ab7512eab4c7c44e4f5478284ef33c83562cc6a249b972515a31e5'],
    ['tokens.txt', ALPHACEP + 'lang/tokens.txt', '93bbbc0bae6b78c0bbb743d4aa9fded3bb5ff3aac5f0200e3a769a5a05e0fdf6'],
    ['silero-vad.onnx', SILERO + 'onnx/model.onnx', 'a4a068cd6cf1ea8355b84327595838ca748ec29a25bc91fc82e6c299ccdc5808'],
  ],
};
const FOLDER = 'Voice Commands'; // in Kulisa's data folder

// The phrases, each said as a whole: Kulisa's name first, so talk about a "кулиса" or "отправь" in other words does
// nothing (checked on synthetic speech: no command in sentences with either word).
const PHRASES = { hey: 'эй кулиса', send: 'кулиса отправь', stop: 'кулиса стоп' };
const KEYS = { send: 'enter', stop: 'escape' };
const SILENCE = 1.2; // s: the pause that ends a dictation started by voice
const GRACE = 1500;  // ms after the name in which a pause does not end it (the one after the name itself)
const WAIT = 8000;   // ms: the name and then nothing: the dictation ends

// A phrase as the model's tokens (its tokens.txt: sentencepiece pieces, "▁" starting a word), the longest piece
// first. The keyword spotter takes keywords so ("▁ку ли са @hey").
function tokenize(vocab, text) {
  const out = [];
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    let rest = '▁' + word;
    while (rest) {
      let n = rest.length;
      while (n && !vocab.has(rest.slice(0, n))) n--;
      if (!n) throw new Error(`the model has no token for "${rest}"`);
      out.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
  }
  return out.join(' ');
}
const keywords = (vocab) => Object.entries(PHRASES).map(([id, say]) => `${tokenize(vocab, say)} @${id}`).join('\n');

// What is heard, and what is done. act: dictating(), dictate(on), press(key), cue(); now: the clock.
// A dictation started by voice ends at the first pause after GRACE, or after WAIT with nothing said; one started by
// the button is the human's, ended by the button. A phrase heard while the agent records only ends the recording:
// the phrase is in the dictated text by then, so the text is left to read rather than sent.
class Commands {
  constructor(act, now = Date.now) { this.act = act; this.now = now; this.since = 0; this.speaking = false; }
  heard(id) {
    if (this.act.dictating()) return this.end();
    if (id === 'hey') { this.since = this.now(); this.act.dictate(true); this.act.cue(); }
    else if (KEYS[id]) this.act.press(KEYS[id]);
  }
  speech(on) {
    this.speaking = on;
    if (!on && this.mine() && this.now() - this.since > GRACE) this.end();
  }
  tick() { if (this.mine() && !this.speaking && this.now() - this.since > WAIT) this.end(); }
  mine() { if (this.since && !this.act.dictating()) this.since = 0; return !!this.since; } // ended otherwise meanwhile
  end() { this.since = 0; this.act.dictate(false); }
}

// The model's folder, downloaded when missing; other versions' folders removed. progress(text) says what it does.
async function ensureModel(root, progress) {
  const base = path.join(root, FOLDER), dir = path.join(base, MODEL.id);
  for (const old of fs.existsSync(base) ? fs.readdirSync(base) : []) if (old !== MODEL.id) fs.rmSync(path.join(base, old), { recursive: true, force: true });
  if (fs.existsSync(path.join(dir, 'done'))) return dir;
  const { net } = require('electron');
  fs.mkdirSync(dir, { recursive: true });
  try {
    for (const [i, [name, url, sha]] of MODEL.files.entries()) {
      progress(`Downloading the voice model (${i + 1} of ${MODEL.files.length})…`);
      const res = await net.fetch(url);
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      const hash = crypto.createHash('sha256'), part = path.join(dir, name + '.part');
      await pipeline(Readable.fromWeb(res.body), async function* (chunks) { for await (const c of chunks) { hash.update(c); yield c; } }, fs.createWriteStream(part));
      if (hash.digest('hex') !== sha) throw new Error(`${name} is not the file expected (its SHA-256 differs)`);
      fs.renameSync(part, path.join(dir, name));
    }
    fs.writeFileSync(path.join(dir, 'done'), '');
    return dir;
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true }); // nothing half-downloaded stays
    throw e;
  }
}

class Listener {
  constructor(shell, root) { this.shell = shell; this.root = root; this.child = null; this.window = null; this.busy = ''; }
  state() { return { on: !!this.child, busy: this.busy }; }
  tell(extra) { for (const w of this.shell.windows) w.send('listen', { ...this.state(), ...extra }); }

  // On in the window the human turned them on in: its microphone, its shown workspace's agent. { on } or { error }.
  async set(window, on) {
    if (!on) { this.stop(); this.tell(); }
    if (!on || this.child || this.busy) return this.state();
    try {
      this.busy = 'Starting…';
      this.tell();
      const dir = await ensureModel(this.root, (text) => { this.busy = text; this.tell(); });
      const vocab = new Set(fs.readFileSync(path.join(dir, 'tokens.txt'), 'utf8').split('\n').map((l) => l.split(' ')[0]));
      await this.fork(window, dir, keywords(vocab));
      return this.state();
    } catch (e) {
      this.stop();
      return { ...this.state(), error: e.message };
    } finally {
      this.busy = '';
      this.tell();
    }
  }

  fork(window, dir, kw) {
    const { utilityProcess } = require('electron');
    const child = utilityProcess.fork(path.join(__dirname, 'listen-worker.js'), [], { serviceName: 'Kulisa voice commands' });
    this.child = child;
    this.window = window;
    const ws = () => (window.win.isDestroyed() ? null : window.ws);
    const voice = (w) => w.window?.send('voice', { ws: w.key, voice: w.voice() });
    const commands = new Commands({
      dictating: () => !!ws()?.dictating,
      dictate: (on) => { const w = ws(); if (w) { w.dictate(on); voice(w); } },
      press: (key) => ws()?.press(key),
      cue: () => window.send('listen', { ...this.state(), heard: 'hey' }),
    });
    this.timer = setInterval(() => commands.tick(), 250);
    window.win.once('closed', () => { if (this.child === child) { this.stop(); this.tell(); } }); // its microphone gone
    return new Promise((resolve, reject) => {
      child.on('message', (m) => {
        if (m.ready) resolve();
        else if (m.error) { console.error('[listen]', m.error); reject(new Error(m.error)); }
        else if (m.heard) { console.log('[listen] heard', m.heard); commands.heard(m.heard); } // which phrase, when one misfires
        else if ('speech' in m) commands.speech(m.speech);
      });
      child.on('exit', (code) => {
        if (this.child !== child) return;
        reject(new Error(`the voice process stopped (${code})`));
        this.stop();
        this.tell();
      });
      child.postMessage({ start: { dir, keywords: kw, silence: SILENCE } });
    });
  }

  audio(window, samples) { if (window === this.window && samples instanceof Float32Array) this.child?.postMessage(samples); }

  stop() {
    clearInterval(this.timer);
    const child = this.child;
    this.child = null;
    this.window = null;
    child?.kill();
  }
}

module.exports = { Listener, Commands, tokenize, ensureModel, PHRASES, MODEL, FOLDER };
