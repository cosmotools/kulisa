// The dictation's pill (../README.md, The pill): over the top of the terminal while the task dictates, what the
// dictation does now, the voice heard as a live wave. task: the task shown; children: the done mark. Over the terminal,
// not above it (the terminal keeps its size: Claude Code redraws badly after a resize), and not in the way of the
// pointer.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge, Spinner } from '@ui';
import { useVoices } from './voice';

const BARS = 28;
type Look = 'getting' | 'listening' | 'transcribing' | 'done';
const VARIANT = { getting: 'secondary', listening: 'destructive', transcribing: 'secondary', done: 'outline' } as const;

// None of its motions with reduced motion (the heard wave stays, being what is heard).
const still = matchMedia('(prefers-reduced-motion: reduce)');
// It springs in as a recording starts (a spring's overshoot), and fades up as it goes: tw-animate-css, shadcn's motion.
const ARRIVE = 'animate-in fade-in zoom-in-60 slide-in-from-top-4 blur-in-xs duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]';
const LEAVE = 'animate-out fade-out zoom-out-85 slide-out-to-top-2.5 blur-out-xs duration-300 ease-in fill-mode-forwards';
// The beat and the transcribing wave: the Web Animations API, keyframes Tailwind has none of. Refs, stable: a motion starts as its element comes and ends as it goes, not again as the pill draws anew.
const beat = (el: HTMLElement | null) => {
  if (!el || still.matches) return;
  const a = el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 1400, easing: 'ease-in-out', iterations: Infinity });
  return () => a.cancel();
};
// Transcribing: the heard wave gives way to a wave running through the bars (data-i: a bar's place), the voice being
// worked on.
const run = (el: HTMLElement | null) => {
  if (!el || still.matches) return;
  const a = el.animate([{ scale: '1 0.12' }, { scale: '1 0.75' }, { scale: '1 0.12' }],
    { duration: 1100, easing: 'ease-in-out', iterations: Infinity, delay: -55 * (Number(el.dataset.i) + 1) });
  return () => a.cancel();
};

export function Pill({ task, children }: { task: string | null; children?: ReactNode }) {
  const v = useVoices((s) => (task ? s.voices[task] : undefined));
  const slow = useVoices((s) => (task ? !!s.slow[task] : false));
  const done = useVoices((s) => (task ? s.done[task] : undefined));
  const look: Look | null = v?.state === 'starting' ? (slow ? 'getting' : 'listening') : v?.state === 'recording' ? 'listening'
    : v?.state === 'transcribing' ? 'transcribing' : done ? 'done' : null;
  // What it shows stays while it goes out.
  const now = look && { look, to: done ?? '' };
  const [shown, setShown] = useState(now);
  if (now && (now.look !== shown?.look || now.to !== shown.to)) setShown(now);
  // There while it shows, and while it goes out (with reduced motion at once: no motion to wait for).
  const [there, setThere] = useState(!!look);
  if (!!look !== there && (look || still.matches)) setThere(!!look);

  if (!there || !shown) return null;
  const label = shown.look === 'getting' ? 'Getting ready…' : shown.look === 'transcribing' ? 'Transcribing…'
    : shown.look === 'done' ? `In ${shown.to}'s input` : null;
  // It floats: the popover's color and a shadow behind the badge, which is translucent, over the terminal's text.
  return <div className="pointer-events-none absolute start-1/2 top-2.5 z-10 -translate-x-1/2">
    <span className={`inline-flex rounded-4xl bg-popover shadow-lg motion-reduce:animate-none ${look ? ARRIVE : LEAVE}`}
      onAnimationEnd={(e) => { if (!look && e.target === e.currentTarget) setThere(false); }}>
      <Badge role="status" aria-label="Dictation" data-state={shown.look} variant={VARIANT[shown.look]} className="h-8">
        <span className="inline-flex items-center gap-2 px-1 text-sm whitespace-nowrap tabular-nums">
          <span className="grid size-3.5 place-items-center">
            {shown.look === 'done' ? children : shown.look === 'getting' ? <Spinner className="size-3.5" />
              : <span ref={beat} className="size-2 rounded-full bg-current" />}
          </span>
          {shown.look !== 'done' && <Wave look={shown.look} listening={look === 'listening'} />}
          {label ?? <Clock />}
        </span>
      </Badge>
    </span>
  </div>;
}

// The time spoken, from the recording's start (it is mounted as the pill starts listening).
function Clock() {
  const [since] = useState(Date.now);
  const [now, setNow] = useState(since);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return <span className="min-w-8.5">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

// A bar of the wave: its height (scale) set as it is heard, by the meter; the transition smooths the meter's steps.
const BAR = 'h-full w-0.75 flex-none rounded-xs bg-current scale-y-10 transition-[scale] duration-75 ease-linear';

// The voice heard, as a wave: Kulisa's own reading of the microphone, its level only, while it records (the agent
// records on its own; nothing of this is kept or sent). Each bar a moment, the newest at the right; the older ones fade
// to the left (a mask: alpha alone).
function Wave({ look, listening }: { look: Look | undefined; listening: boolean }) {
  const wave = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!listening) return;
    let stream: MediaStream | null = null, audio: AudioContext | null = null, frame = 0, gone = false;
    const levels: number[] = Array<number>(BARS).fill(0);
    void (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
        if (gone) { for (const t of s.getTracks()) t.stop(); return; }
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
          [...wave.current?.children ?? []].forEach((bar, i) => { (bar as HTMLElement).style.scale = `1 ${Math.max(0.1, levels[i]!)}`; });
        };
        frame = requestAnimationFrame(tick);
      } catch { /* no microphone to read: the wave stays flat, the dictation itself goes on */ }
    })();
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      for (const t of stream?.getTracks() ?? []) t.stop();
      void audio?.close();
    };
  }, [listening]);

  return <span ref={wave} aria-hidden="true" data-look={look}
    className="flex h-5 items-center gap-0.5 overflow-hidden mask-l-from-65% data-[look=getting]:opacity-50 data-[look=transcribing]:mask-x-from-75%">
    {Array.from({ length: BARS }, (_, i) => look === 'transcribing'
      ? <i key={`r${i}`} ref={run} data-i={i} className={BAR} />
      : <i key={i} className={BAR} />)}
  </span>;
}
