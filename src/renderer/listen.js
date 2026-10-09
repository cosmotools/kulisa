// Voice commands' microphone (docs/window.md, The terminal; listen.js in the main process recognizes): loaded when
// they are first turned on. The microphone at 16 kHz, sent to the main process a tenth of a second at a time while
// they are on; nothing is kept. Chromium's echo cancellation leaves out what Kulisa itself plays.
//   hear(on)   the microphone on or off; throws when it cannot be had (no microphone, refused)
//   cue()      a short tone: the name was heard, the agent records
let stream = null, ctx = null;

export async function hear(on) {
  if (!on || stream) {
    if (!on) { stream?.getTracks().forEach((t) => t.stop()); ctx?.close(); stream = ctx = null; }
    return;
  }
  stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  ctx = new AudioContext({ sampleRate: 16000 });
  await ctx.audioWorklet.addModule(new URL('listen-worklet.js', import.meta.url));
  const node = new AudioWorkletNode(ctx, 'kulisa-samples');
  node.port.onmessage = ({ data }) => kulisa.send('listen:audio', data);
  ctx.createMediaStreamSource(stream).connect(node).connect(ctx.destination); // it writes silence; connected so it runs
}

export function cue() {
  if (!ctx) return;
  const tone = new OscillatorNode(ctx, { frequency: 880 }), gain = new GainNode(ctx, { gain: 0.08 }), t = ctx.currentTime;
  gain.gain.setTargetAtTime(0, t + 0.08, 0.02);
  tone.connect(gain).connect(ctx.destination);
  tone.start(t);
  tone.stop(t + 0.2);
}
