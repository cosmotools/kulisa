// Voice commands' microphone (listen.js): its samples a tenth of a second at a time (the context runs at 16 kHz, the
// rate the model hears at), posted to the window, which sends them on.
const SIZE = 1600;
registerProcessor('kulisa-samples', class extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(SIZE); this.n = 0; }
  process([input]) {
    for (const s of input[0] || []) {
      this.buf[this.n++] = s;
      if (this.n === SIZE) { this.port.postMessage(this.buf, [this.buf.buffer]); this.buf = new Float32Array(SIZE); this.n = 0; }
    }
    return true;
  }
});
