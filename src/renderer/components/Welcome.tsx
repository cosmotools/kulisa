// The first start, no project at all (docs/tasks.md, The welcome): what Kulisa does in three slides, then New Project's
// own steps under a question each. The slides' pictures are a task's window drawn small in boxes of our own: no
// pictures to ship, the theme's colors.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MousePointerClickIcon } from 'lucide-react';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from '@ui';
import { agentMark } from './AgentMark';
import { avatarSrc } from '../lib/common';
import { Wizard } from './NewProject';
import { wizard, type Wizard as W } from '../lib/new-project';

const SLIDES = [
  { title: 'Your agent, in your browsers', text: 'Claude Code, Codex or another coding agent works in the terminal, and drives browsers you have signed in to yourself.' },
  { title: 'It checks the result as every user', text: 'An admin, a customer, support: each is a browser profile of its own. The agent builds, checks as each of them, fixes, and goes again until it works.' },
  { title: 'Point at it, and say what is wrong', text: 'Pick an element in a page, and the agent knows exactly which one you mean. Watch it work, or take a break.' },
];
const QUESTIONS = ['Where is the code?', 'Who writes the code?', 'Who uses your app?'];
const PANES = [{ name: 'Admin', avatar: 'owl' }, { name: 'Customer', avatar: 'fox' }];
const Claude = agentMark('claude');

// The first start says so (shell.firstStart): the keyboard on the slides' Next, or the steps' first field.
let focusNow: (() => void) | null = null, asked = false;
kulisa.on('project:new', () => { if (focusNow) focusNow(); else asked = true; });

const media = (q: string) => { const m = matchMedia(q); return (l: () => void) => { m.addEventListener('change', l); return () => m.removeEventListener('change', l); }; };
const tinyQ = '(max-width: 720px) and (max-height: 640px)';
const useMedia = (q: string) => useSyncExternalStore(media(q), () => matchMedia(q).matches);

// Steps as dots, the ones done and the shown one filled.
function Dots({ label, count, at }: { label: string; count: number; at: number }) {
  return <ol aria-label={label} className="flex gap-1.5">
    {Array.from({ length: count }, (_, i) => <li key={i} aria-current={i === at ? 'step' : undefined}
      className={i <= at ? 'size-2 rounded-full bg-primary' : 'size-2 rounded-full border border-muted-foreground'} />)}
  </ol>;
}

// A task: its agent's terminal, two profiles' panes; what the slide says lit in it.
function Picture({ slide }: { slide: number }) {
  // A line in the terminal, fading in as the slide comes to it.
  const line = (text: string, on: boolean, color = '') => <div className={`${color} transition-opacity duration-500 ${on ? 'opacity-100' : 'opacity-0'}`}>{text}</div>;
  return <div aria-hidden="true" className="grid aspect-[16/10] w-full grid-cols-[1.1fr_1fr_1fr] gap-2 overflow-hidden rounded-xl border bg-muted p-2
    [@media(max-height:640px)]:w-[min(100%,calc((100vh-200px)*1.6))] [@media(max-height:640px)]:justify-self-center">
    <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-lg border bg-card p-2 font-mono text-[10px] leading-snug">
      <div className="flex items-center gap-1"><Claude className="size-3" /> claude</div>
      {line('> does the checkout work for every user?', true)}
      {line('⏺ Checking as Admin…', slide >= 1, 'text-muted-foreground')}
      {line('⏺ Checking as Customer…', slide >= 1, 'text-muted-foreground')}
      {line('✓ Fixed: works for both', slide >= 1, 'text-success')}
    </div>
    {PANES.map((p, i) => <div key={p.name} className={`relative flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-2 transition-shadow ${slide === 1 ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-center gap-1.5 text-[11px]"><img src={avatarSrc(p.avatar)} alt="" className="size-4 rounded-full" />{p.name}</div>
      <div className="grid gap-1.5">
        <div className="h-2 rounded-sm bg-muted" />
        <div className="h-2 w-[70%] rounded-sm bg-muted" />
        <div className={slide === 2 && i === 1 ? 'grid h-5 w-[55%] place-items-center rounded-md border border-primary text-[10px] text-primary'
          : 'grid h-5 w-[55%] place-items-center rounded-md bg-primary text-[10px] text-primary-foreground'}>Buy</div>
        <div className="h-2 w-[45%] rounded-sm bg-muted" />
      </div>
      {slide === 2 && i === 1 && <MousePointerClickIcon className="absolute top-[55%] right-[20%] size-5 text-warning" />}
    </div>)}
  </div>;
}

// The slides, their dots (a click shows one); Back and Next as a teaching popover's footer has them.
function Tour({ slide, setSlide, done, next }: { slide: number; setSlide: (n: number) => void; done: () => void; next: React.RefObject<HTMLButtonElement | null> }) {
  const tiny = useMedia(tinyQ); // tiny: no room for the picture at all
  const last = slide === SLIDES.length - 1, s = SLIDES[slide]!;
  return <section aria-label="What Kulisa does" data-slide={slide} className="flex w-[min(960px,100%)] flex-col gap-12 [@media(max-height:640px)]:gap-6">
    <div aria-roledescription="slide" aria-label={s.title} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-12
      max-[720px]:grid-cols-1 [@media(max-height:640px)]:gap-6">
      <div className="grid min-w-0 gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{s.title}</h1>
        <p className="max-w-[42ch] text-base text-muted-foreground">{s.text}</p>
      </div>
      {!tiny && <Picture slide={slide} />}
    </div>
    <div className="flex items-center gap-2">
      <div role="group" aria-label="Slides" className="flex">
        {SLIDES.map((x, i) => <Button key={x.title} variant="ghost" size="icon-xs" aria-label={x.title} aria-current={i === slide || undefined} onClick={() => setSlide(i)}>
          <span className={i === slide ? 'size-2 rounded-full bg-primary' : 'size-2 rounded-full bg-muted-foreground/40'} />
        </Button>)}
      </div>
      <span className="flex-1" />
      <Button variant="outline" onClick={done}>Skip</Button>
      {slide > 0 && <Button variant="outline" onClick={() => setSlide(slide - 1)}>Back</Button>}
      <Button ref={next} onClick={() => (last ? done() : setSlide(slide + 1))}>{last ? 'Set Up a Project' : 'Next'}</Button>
    </div>
  </section>;
}

export function Welcome() {
  const [slide, setSlide] = useState(0), [w, setW] = useState<W | null>(null); // w: New Project's steps, shown
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    focusNow = () => next.current?.focus(); // the steps take it themselves, in their first field
    if (asked) { asked = false; focusNow(); }
    return () => { focusNow = null; };
  }, []);
  return <div id="welcome" className="box-border grid min-h-0 flex-1 [place-items:safe_center] overflow-auto p-8">
    {!w ? <Tour slide={slide} setSlide={setSlide} done={() => setW(wizard(true))} next={next} />
      // New Project's steps in a Card, not a dialog: nothing else is in the window to cover
      : <Card className="min-h-[min(520px,100%)] w-[min(760px,100%)]">
        <Wizard w={w} leave={() => setW(null)} className="flex min-h-0 flex-1 flex-col gap-4">
          {({ step, steps, error, back, go }) => <>
            <CardHeader>
              <CardTitle><h1 className="text-xl">{QUESTIONS[step]}</h1></CardTitle>
              <Dots label="Steps" count={QUESTIONS.length} at={step} />
            </CardHeader>
            <CardContent className="min-h-0 flex-1"><div className="flex flex-col gap-4">{steps}{error}</div></CardContent>
            <CardFooter>{back}<div className="ms-auto">{go}</div></CardFooter>
          </>}
        </Wizard>
      </Card>}
  </div>;
}
