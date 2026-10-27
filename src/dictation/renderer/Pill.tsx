// The dictation's pill (../README.md, The pill): over the top of the terminal while the task dictates, what the
// dictation does now, the voice heard as a live wave. task: the task shown; children: the done mark.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge, Spinner, createMotionComponent, createPresenceComponent, makeStyles, mergeClasses, motionTokens, tokens, type BadgeProps } from '@fluentui/react-components';
import { useVoices } from './voice';

const BARS = 28;
type Look = 'getting' | 'listening' | 'transcribing' | 'done';
const COLOR: Record<Look, BadgeProps['color']> = { getting: 'informative', listening: 'danger', transcribing: 'informative', done: 'success' };

// It springs in as a recording starts; with reduced motion Fluent's motion takes 1 ms.
const Arrive = createPresenceComponent({
  enter: { keyframes: [{ opacity: 0, transform: 'translateY(-16px) scale(0.6)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'none' }],
    duration: motionTokens.durationUltraSlow, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }, // a spring's overshoot: no curve of Fluent's has one
  exit: { keyframes: [{ opacity: 1, transform: 'none', filter: 'none' }, { opacity: 0, transform: 'translateY(-10px) scale(0.85)', filter: 'blur(4px)' }],
    duration: motionTokens.durationSlow, easing: 'ease-in' },
});
const once = { iterations: 1, duration: 1 }; // reduced motion: an endless one stands still
const Beat = createMotionComponent({ keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
  duration: 1400, easing: 'ease-in-out', iterations: Infinity, reducedMotion: once });
// Transcribing: the heard wave gives way to a wave running through the bars, the voice being worked on.
const Run = createMotionComponent<{ delay: number }>(({ delay }) => ({
  keyframes: [{ transform: 'scaleY(0.12)' }, { transform: 'scaleY(0.75)' }, { transform: 'scaleY(0.12)' }],
  duration: 1100, easing: 'ease-in-out', iterations: Infinity, delay, reducedMotion: once }));

const useStyles = makeStyles({
  // Over the terminal, not above it (the terminal keeps its size: Claude Code redraws badly after a resize), and not in
  // the way of the pointer.
  place: { position: 'absolute', zIndex: 5, insetBlockStart: '10px', insetInlineStart: '50%', translate: '-50% 0', pointerEvents: 'none' },
  pill: { gap: tokens.spacingHorizontalS, paddingInline: tokens.spacingHorizontalM, boxShadow: tokens.shadow16, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  mark: { display: 'grid', placeItems: 'center', width: '14px', height: '14px' },
  clock: { minWidth: '34px' },
  wave: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXXS, height: '20px', overflow: 'hidden',
    maskImage: 'linear-gradient(to right, transparent, black 35%)' },
  getting: { opacity: 0.5 },
  running: { maskImage: 'linear-gradient(to right, transparent, black 25% 75%, transparent)' },
  // Its height set as it is heard (transform, by the meter); the transition smooths the meter's steps.
  bar: { flex: 'none', width: '3px', height: '100%', borderRadius: '2px', background: 'currentColor', transform: 'scaleY(0.1)', transition: 'transform 0.08s linear' },
});

export function Pill({ task, children }: { task: string | null; children?: ReactNode }) {
  const styles = useStyles();
  const v = useVoices((s) => (task ? s.voices[task] : undefined));
  const slow = useVoices((s) => (task ? !!s.slow[task] : false));
  const done = useVoices((s) => (task ? s.done[task] : undefined));
  const look: Look | null = v?.state === 'starting' ? (slow ? 'getting' : 'listening') : v?.state === 'recording' ? 'listening'
    : v?.state === 'transcribing' ? 'transcribing' : done ? 'done' : null;
  // What it shows stays while it goes out.
  const now = look && { look, to: done ?? '' };
  const [shown, setShown] = useState(now);
  if (now && (now.look !== shown?.look || now.to !== shown.to)) setShown(now);

  const label = !shown ? '' : shown.look === 'getting' ? 'Getting ready…' : shown.look === 'transcribing' ? 'Transcribing…'
    : shown.look === 'done' ? `In ${shown.to}'s input` : null;
  return <div className={styles.place}>
    <Arrive visible={!!look} appear unmountOnExit>
      <Badge role="status" aria-label="Dictation" data-state={shown?.look} size="extra-large" shape="circular" appearance="tint"
        color={shown ? COLOR[shown.look] : 'informative'} className={styles.pill}>
        <span className={styles.mark}>
          {shown?.look === 'done' ? children : shown?.look === 'getting' ? <Spinner size="extra-tiny" />
            : <Beat><Badge size="tiny" shape="circular" appearance="filled" color={shown ? COLOR[shown.look] : 'informative'} /></Beat>}
        </span>
        {shown?.look !== 'done' && <Wave look={shown?.look} listening={look === 'listening'} />}
        {label ?? <Clock />}
      </Badge>
    </Arrive>
  </div>;
}

// The time spoken, from the recording's start (it is mounted as the pill starts listening).
function Clock() {
  const [since] = useState(Date.now);
  const [now, setNow] = useState(since);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000)), styles = useStyles();
  return <span className={styles.clock}>{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

// The voice heard, as a wave: Kulisa's own reading of the microphone, its level only, while it records (the agent
// records on its own; nothing of this is kept or sent). Each bar a moment, the newest at the right; the older ones fade
// to the left.
function Wave({ look, listening }: { look: Look | undefined; listening: boolean }) {
  const wave = useRef<HTMLSpanElement>(null), styles = useStyles();
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
          [...wave.current?.children ?? []].forEach((bar, i) => { (bar as HTMLElement).style.transform = `scaleY(${Math.max(0.1, levels[i]!)})`; });
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

  return <span ref={wave} aria-hidden="true" className={mergeClasses(styles.wave, look === 'getting' && styles.getting, look === 'transcribing' && styles.running)}>
    {Array.from({ length: BARS }, (_, i) => look === 'transcribing'
      ? <Run key={`r${i}`} delay={-55 * (i + 1)}><i className={styles.bar} /></Run>
      : <i key={i} className={styles.bar} />)}
  </span>;
}
