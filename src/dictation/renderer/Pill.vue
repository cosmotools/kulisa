<script setup lang="ts">
// The dictation's pill (../README.md, The pill): over the top of the terminal while the task dictates, what the
// dictation does now, the voice heard as a live wave. task: the task shown; its slot: the done mark (the window's icon).
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
  <!-- Over the terminal's top (the terminal keeps its size: Claude Code redraws badly after a resize), the pointer going
       through it. Red while it listens, blue while it gets ready or transcribes, green when the text is in. -->
  <Transition enter-active-class="animate-in fade-in zoom-in-75 slide-in-from-top-4 duration-300 motion-reduce:zoom-in-100 motion-reduce:slide-in-from-top-0"
    leave-active-class="animate-out fade-out zoom-out-90 slide-out-to-top-2 duration-200 motion-reduce:zoom-out-100 motion-reduce:slide-out-to-top-0">
    <div v-if="look" class="group pointer-events-none absolute top-2.5 left-1/2 z-5 flex h-8.5 -translate-x-1/2 items-center gap-2.5 rounded-full border bg-popover/70 ps-3.5 pe-4
      text-xs whitespace-nowrap text-popover-foreground tabular-nums shadow-lg backdrop-blur-lg backdrop-saturate-150 data-[state=listening]:border-destructive/50"
      :data-state="look" role="status" aria-label="Dictation">
      <span class="grid size-3 place-items-center">
        <span v-if="look === 'done'" class="grid text-green-500 motion-safe:animate-in motion-safe:zoom-in-50 [&_svg]:size-3.5"><slot /></span>
        <span v-else-if="look === 'getting'" class="size-2.5 rounded-full border-2 border-blue-500/25 border-t-blue-500 motion-safe:animate-spin" />
        <span v-else class="size-2 rounded-full bg-destructive group-data-[state=transcribing]:bg-blue-500 motion-safe:group-data-[state=listening]:animate-pulse" />
      </span>
      <!-- The older moments fade to the left -->
      <span ref="wave" class="flex h-5 items-center gap-0.5 overflow-hidden mask-l-from-65% group-data-[state=done]:hidden" aria-hidden="true">
        <i v-for="n in BARS" :key="n" class="h-full w-0.75 flex-none scale-y-(--h,0.1) rounded-xs bg-destructive transition-transform duration-75 ease-linear
          group-data-[state=getting]:bg-blue-500/50 group-data-[state=transcribing]:bg-blue-500 motion-safe:group-data-[state=transcribing]:animate-pulse"
          :style="{ animationDelay: `${n * -55}ms` }" />
      </span>
      <span class="min-w-8.5 group-data-[state=getting]:motion-safe:animate-pulse group-data-[state=transcribing]:motion-safe:animate-pulse">{{ label }}</span>
    </div>
  </Transition>
</template>
