<script setup lang="ts">
// The dictation's pill (../README.md, The pill): over the top of the terminal while the task dictates, what the
// dictation does now, the voice heard as a live wave. task: the task shown; its slot: the done mark (the window's sprite).
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { slow, voices } from './voice';

const props = defineProps<{ task: string | null }>();

const BARS = 28;
const DONE = 1600; // the text put in: shown so long, then it goes
const v = computed(() => (props.task ? voices[props.task] : undefined));
const done = ref<string | null>(null); // the agent whose input the text went into, just now
let doneTimer: ReturnType<typeof setTimeout> | undefined;
watch(v, (now, was) => {
  if (was?.state === 'transcribing' && now?.state === 'ready') {
    done.value = was.to;
    clearTimeout(doneTimer);
    doneTimer = setTimeout(() => { done.value = null; }, DONE);
  } else if (now && now.state !== 'ready') done.value = null;
});
watch(() => props.task, () => { done.value = null; });

const look = computed(() => {
  const s = v.value?.state;
  if (s === 'starting') return slow[props.task!] ? 'getting' : 'listening';
  if (s === 'recording') return 'listening';
  if (s === 'transcribing') return 'transcribing';
  return done.value ? 'done' : null;
});

// The voice heard, as a wave: Kulisa's own reading of the microphone, its level only, while it records (the agent
// records on its own; nothing of this is kept or sent). Each bar a moment, the newest at the right.
const wave = ref<HTMLElement>();
const since = ref(0), now = ref(0);
let stream: MediaStream | null = null, audio: AudioContext | null = null, frame = 0, opening = false, clock: ReturnType<typeof setInterval> | undefined;
const levels: number[] = Array(BARS).fill(0);
async function listen() {
  if (stream || opening) return;
  opening = true;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    opening = false;
    if (look.value !== 'listening') { for (const t of s.getTracks()) t.stop(); return; }
    stream = s;
    audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(s).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let last = 0, level = 0;
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (const x of data) sum += x * x;
      level = Math.max(Math.sqrt(sum / data.length), level * 0.85); // falls slower than it rises, as a meter
      if (t - last < 55) return;
      last = t;
      levels.shift();
      levels.push(Math.min(1, Math.sqrt(level) * 2.4));
      level = 0;
      wave.value?.querySelectorAll('i').forEach((bar, i) => bar.style.setProperty('--h', String(Math.max(0.1, levels[i]!))));
    };
    frame = requestAnimationFrame(tick);
  } catch { opening = false; } // no microphone to read: the wave stays flat, the dictation itself goes on
}
function quiet() {
  cancelAnimationFrame(frame);
  clearInterval(clock);
  for (const t of stream?.getTracks() ?? []) t.stop();
  void audio?.close();
  stream = null; audio = null;
  levels.fill(0);
}
watch(look, (l, was) => {
  if (l === 'listening') {
    if (was !== 'listening') {
      since.value = now.value = Date.now();
      clock = setInterval(() => { now.value = Date.now(); }, 250);
    }
    void listen();
  } else quiet();
}, { immediate: true });
onBeforeUnmount(() => { quiet(); clearTimeout(doneTimer); });

const time = computed(() => {
  const s = Math.max(0, Math.floor((now.value - since.value) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});
const label = computed(() => ({
  getting: 'Getting ready…',
  listening: time.value,
  transcribing: 'Transcribing…',
  done: `In ${done.value}'s input`,
})[look.value ?? 'done']);
</script>

<template>
  <Transition name="pill">
    <div v-if="look" class="dictation-pill" :data-state="look" role="status" aria-label="Dictation">
      <span class="lead"><span v-if="look === 'done'" class="mark"><slot /></span><span v-else class="dot" /></span>
      <span ref="wave" class="wave" aria-hidden="true"><i v-for="n in BARS" :key="n" :style="{ '--i': n }" /></span>
      <span class="label">{{ label }}</span>
    </div>
  </Transition>
</template>

<style>
/* A capsule of frosted glass at the terminal's top, over it (the terminal keeps its size: Claude Code redraws badly
   after a resize), not in the way of the pointer. It grows and shrinks to what it says, with a spring; red while it
   listens, the agent's blue while it transcribes, green when the text is in. */
.dictation-pill { position: absolute; z-index: 5; inset-block-start: 10px; inset-inline-start: 50%; translate: -50% 0;
  display: flex; align-items: center; gap: 10px; height: 34px; padding-inline: 13px 15px; border-radius: 17px;
  interpolate-size: allow-keywords; width: auto; transition: width 0.4s cubic-bezier(0.34, 1.3, 0.64, 1), border-color 0.4s, box-shadow 0.4s;
  background: color-mix(in srgb, var(--island) 70%, transparent); backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
  box-shadow: 0 12px 32px -8px var(--shadow), inset 0 1px 0 color-mix(in srgb, var(--text-strong) 8%, transparent);
  color: var(--text); font-size: var(--font-small); font-variant-numeric: tabular-nums; white-space: nowrap; pointer-events: none;
  --tone: var(--danger);
  &[data-state="getting"], &[data-state="transcribing"] { --tone: var(--agent); }
  &[data-state="done"] { --tone: var(--done); }
  &[data-state="listening"] { border-color: color-mix(in srgb, var(--danger) 50%, transparent);
    box-shadow: 0 12px 32px -8px var(--shadow), 0 0 30px -6px color-mix(in srgb, var(--danger) 55%, transparent); }

  .lead { display: grid; place-items: center; width: 12px; height: 12px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tone); transition: background 0.3s; }
  &[data-state="listening"] .dot { animation: pill-beat 1.4s ease-in-out infinite; }
  &[data-state="getting"] .dot { width: 10px; height: 10px; background: none; border: 2px solid color-mix(in srgb, var(--tone) 25%, transparent);
    border-block-start-color: var(--tone); animation: pill-spin 0.8s linear infinite; }
  .mark { display: grid; color: var(--tone); animation: pill-pop 0.45s cubic-bezier(0.34, 1.8, 0.64, 1); svg { width: 14px; height: 14px; } }

  /* The older moments fade to the left. */
  .wave { display: flex; align-items: center; gap: 2px; height: 20px; overflow: hidden;
    mask-image: linear-gradient(to right, transparent, black 35%);
    i { flex: none; width: 3px; height: 100%; border-radius: 2px; background: var(--tone); transform: scaleY(var(--h, 0.1));
      transition: transform 0.08s linear, background 0.3s; } }
  &[data-state="getting"] .wave i { --h: 0.1; opacity: 0.5; }
  /* Transcribing: the heard wave gives way to a wave running through the bars, the voice being worked on. */
  &[data-state="transcribing"] .wave { mask-image: linear-gradient(to right, transparent, black 25% 75%, transparent);
    i { animation: pill-wave 1.1s ease-in-out infinite; animation-delay: calc(var(--i) * -55ms); } }
  &[data-state="done"] .wave { width: 0; margin-inline-end: -10px; }

  .label { min-width: 34px; }
  &[data-state="getting"] .label, &[data-state="transcribing"] .label {
    background: linear-gradient(90deg, var(--text-muted) 0 35%, var(--text-strong) 50%, var(--text-muted) 65% 100%) 100% 0 / 300% 100%;
    background-clip: text; color: transparent; animation: pill-shimmer 1.6s linear infinite; }
}
.pill-enter-active { transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s, filter 0.3s; }
.pill-leave-active { transition: transform 0.3s ease-in, opacity 0.3s ease-in, filter 0.3s; }
.pill-enter-from { opacity: 0; transform: translateY(-16px) scale(0.6); filter: blur(4px); }
.pill-leave-to { opacity: 0; transform: translateY(-10px) scale(0.85); filter: blur(4px); }
@keyframes pill-beat { 0%, 100% { scale: 1; box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 60%, transparent); }
  50% { scale: 1.15; box-shadow: 0 0 0 5px color-mix(in srgb, var(--danger) 0%, transparent); } }
@keyframes pill-spin { to { rotate: 1turn; } }
@keyframes pill-pop { from { scale: 0.3; opacity: 0; } }
@keyframes pill-wave { 0%, 100% { transform: scaleY(0.12); } 50% { transform: scaleY(0.75); } }
@keyframes pill-shimmer { to { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) {
  .dictation-pill, .dictation-pill * { animation: none !important; transition: none !important; }
  .pill-enter-active, .pill-leave-active { transition: opacity 0.2s; }
  .pill-enter-from, .pill-leave-to { transform: none; filter: none; }
}
</style>
