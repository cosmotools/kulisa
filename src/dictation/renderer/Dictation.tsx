// The dictation's microphone (../README.md, The microphone): the key's indicator, lit while it records, and a way for
// the mouse. The trigger is a key held anywhere in the window (the main process). It stays when the agent in front has
// none, disabled: a button that came and went would resize the terminal, and Claude Code redraws badly after one.
import { useEffect, useRef, type PointerEvent } from 'react';
import { MicIcon } from 'lucide-react';
import { Button } from '@ui';
import { leave, read, record, recording as isRecording, useVoices } from './voice';

// Red while it records, breathing with a ring, as a voice message's button does, so the eye catches from across the
// window that the agent is listening (not with reduced motion: red alone). The Web Animations API: the button must not
// mount anew while pressed (the press's pointer capture). The ring in the theme's red, read as it starts.
const breathe = (ring: string): Keyframe[] => [
  { transform: 'scale(1)', boxShadow: `0 0 0 0 ${ring}` },
  { transform: 'scale(1.12)', boxShadow: '0 0 0 4px transparent' },
  { transform: 'scale(1)', boxShadow: '0 0 0 0 transparent' },
];
const still = matchMedia('(prefers-reduced-motion: reduce)');
// Lit: red while it records; getting ready (~1 s, the hidden session starting) the primary color, not red yet, so
// nobody speaks before it hears.
const VARIANT = { recording: 'destructive', starting: 'default' } as const;

// task: the task shown; keyName: the key, as the window names it; language: what it hears; onDone: let go, the
// keyboard goes back to the terminal.
export function Dictation({ task, keyName, language, onDone }: { task: string | null; keyName: string; language: string; onDone: () => void }) {
  const v = useVoices((s) => (task ? s.voices[task] : undefined));
  const slow = useVoices((s) => (task ? !!s.slow[task] : false));
  // Starting (the hidden session getting ready) is recording to the human: the key is down, a second press stops it.
  const recording = isRecording(v);
  const state = v?.state === 'starting' && !slow ? 'recording' : v?.state;
  useEffect(() => {
    if (!task) return;
    void read(task);
    return () => leave(task);
  }, [task]);

  const button = useRef<HTMLButtonElement>(null);
  const lit = state === 'recording';
  useEffect(() => {
    const b = button.current;
    if (!lit || still.matches || !b) return;
    const a = b.animate(breathe(getComputedStyle(b).getPropertyValue('--destructive')), { duration: 1200, easing: 'ease-in-out', iterations: Infinity });
    return () => a.cancel();
  }, [lit]);

  const down = useRef(0); // when the press that started a recording began
  const press = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button || !task) return;
    e.preventDefault(); // the keyboard stays in the terminal
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* let go anywhere */ }
    if (recording) { down.current = 0; void record(task, false); } // the second click
    else { down.current = e.timeStamp; void record(task, true); }
  };
  const release = (e: PointerEvent<HTMLButtonElement>) => {
    if (task && down.current && e.timeStamp - down.current > 400) void record(task, false); // held; a click leaves it on until the next
    down.current = 0;
    onDone();
  };

  const title = !v ? '' : v.state === 'none' ? v.why
    : v.state === 'starting' ? 'Getting ready to listen: speak once the microphone is red'
    : recording ? `Recording: let go of ${keyName}, or click to stop`
    : `Speak to the agent${language ? ` in ${language}` : ''}: hold ${keyName} anywhere, or press it once and again; or this button the same way`;
  // The pane is not dragged by its row's buttons. The tooltip is the native title, also on the box around: a disabled
  // button gets no pointer events, and its tooltip says why it is disabled.
  const variant = state === 'recording' || state === 'starting' ? VARIANT[state] : 'ghost';
  return <div className="grid flex-none place-items-center" title={title} onDragStart={(e) => e.preventDefault()}>
    <Button ref={button} variant={variant} size="icon-sm" aria-label="Speak to the agent" aria-pressed={recording} data-state={state}
      disabled={!v || v.state === 'none'} title={title} onPointerDown={press} onPointerUp={release} onPointerCancel={release}
      // Enter or Space on it
      onClick={(e) => { if (!e.detail && task) void record(task, !recording); }}><MicIcon /></Button>
  </div>;
}
