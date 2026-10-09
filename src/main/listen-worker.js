// Voice commands' ears (listen.js): a utility process of its own, so its model's memory (about 100 MB) is there only
// while the human has them on, and goes whole when they are turned off. It hears the window's microphone (16 kHz
// samples, a tenth of a second at a time) and says when one of the phrases was spoken (sherpa-onnx's keyword spotter
// on a small streaming Russian model) and when speech starts and stops (Silero VAD). Nothing leaves the computer.
//   in:  { start: { dir, keywords, silence } }  the model's folder, the phrases as its tokens, the pause that ends speech (s)
//        Float32Array                           samples
//   out: { ready } | { heard: id } | { speech: bool } | { error }
const path = require('path');
const sherpa = require('sherpa-onnx-node');

let kws, stream, vad, speaking = false;
const post = (m) => process.parentPort.postMessage(m);

function start({ dir, keywords, silence }) {
  const f = (name) => path.join(dir, name);
  kws = new sherpa.KeywordSpotter({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: { encoder: f('encoder.int8.onnx'), decoder: f('decoder.onnx'), joiner: f('joiner.int8.onnx') },
      tokens: f('tokens.txt'), numThreads: 1, provider: 'cpu', debug: 0,
    },
    maxActivePaths: 4, numTrailingBlanks: 1, keywordsScore: 1.5, keywordsThreshold: 0.25,
    keywordsBuf: keywords, keywordsBufSize: Buffer.byteLength(keywords),
  });
  stream = kws.createStream();
  vad = new sherpa.Vad({
    sileroVad: { model: f('silero-vad.onnx'), threshold: 0.5, minSpeechDuration: 0.25, minSilenceDuration: silence, windowSize: 512 },
    sampleRate: 16000, numThreads: 1, provider: 'cpu', debug: 0,
  }, 30);
  post({ ready: true });
}

function hear(samples) {
  stream.acceptWaveform({ sampleRate: 16000, samples });
  while (kws.isReady(stream)) {
    kws.decode(stream);
    const { keyword } = kws.getResult(stream);
    if (keyword) { post({ heard: keyword }); kws.reset(stream); }
  }
  vad.acceptWaveform(samples);
  while (!vad.isEmpty()) vad.pop(); // only whether there is speech matters, not its samples
  if (vad.isDetected() !== speaking) post({ speech: (speaking = !speaking) });
}

process.parentPort.on('message', ({ data }) => {
  try {
    if (data?.start) start(data.start);
    else if (kws && data instanceof Float32Array) hear(data);
  } catch (e) { post({ error: e.message }); }
});
