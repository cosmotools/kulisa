// The first start, no project at all (docs/tasks.md, The welcome): what Kulisa does in three slides, then New Project's
// own steps under a question each. The slides' pictures are a task's window drawn small from Fluent's own parts: no
// pictures to ship, the theme's colors.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Avatar, Badge, Button, Card, CardFooter, CardHeader, Skeleton, SkeletonItem, Text, Title1 } from '@fluentui/react-components';
import { MousePointerClickIcon } from 'lucide-react';
import { agentMark } from './AgentMark';
import { avatarSrc } from './avatar';
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
const muted = { color: 'var(--colorNeutralForeground3)' };

// The first start says so (shell.firstStart): the keyboard on the slides' Next, or the steps' first field.
let focusNow: (() => void) | null = null, asked = false;
kulisa.on('project:new', () => { if (focusNow) focusNow(); else asked = true; });

const media = (q: string) => { const m = matchMedia(q); return (l: () => void) => { m.addEventListener('change', l); return () => m.removeEventListener('change', l); }; };
const lowQ = '(max-height: 640px)', tinyQ = '(max-width: 720px) and (max-height: 640px)', narrowQ = '(max-width: 720px)';
const useMedia = (q: string) => useSyncExternalStore(media(q), () => matchMedia(q).matches);

// Steps as dots, the ones done and the shown one filled.
function Dots({ label, count, at, names }: { label: string; count: number; at: number; names?: string[] }) {
  return <ol aria-label={label} style={{ display: 'flex', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
    {Array.from({ length: count }, (_, i) => <li key={i} aria-current={i === at ? 'step' : undefined} aria-label={names?.[i]}>
      <Badge size="tiny" shape="circular" appearance={i <= at ? 'filled' : 'outline'} color={i <= at ? 'brand' : 'subtle'} /></li>)}
  </ol>;
}

// A task: its agent's terminal, two profiles' panes; what the slide says lit in it.
function Picture({ slide, low }: { slide: number; low: boolean }) {
  const line = (text: string, on: boolean, color?: string) => <Text font="monospace" size={200} style={{ opacity: on ? 1 : 0, transition: 'opacity .4s', color }}>{text}</Text>;
  return <Card aria-hidden="true" size="small" appearance="filled-alternative" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', aspectRatio: '16 / 10', minWidth: 0,
    justifySelf: 'center', width: low ? 'min(100%, calc((100vh - 200px) * 1.6))' : '100%', boxSizing: 'border-box' }}>
    <Card size="small" appearance="filled-alternative" style={{ gap: 4, overflow: 'hidden' }}>
      <Text font="monospace" size={200}><Claude /> claude</Text>
      {line('> does the checkout work for every user?', true)}
      {line('⏺ Checking as Admin…', slide >= 1, 'var(--colorNeutralForeground3)')}
      {line('⏺ Checking as Customer…', slide >= 1, 'var(--colorNeutralForeground3)')}
      {line('✓ Fixed: works for both', slide >= 1, 'var(--colorPaletteGreenForeground1)')}
    </Card>
    {PANES.map((p, i) => <Card key={p.name} size="small" selected={slide === 1} style={{ overflow: 'hidden', position: 'relative' }}>
      <CardHeader image={<Avatar size={16} image={{ src: avatarSrc(p.avatar) }} />} header={<Text size={200}>{p.name}</Text>} />
      <Skeleton animation="pulse" style={{ display: 'grid', gap: 6 }}>
        <SkeletonItem size={8} /><SkeletonItem size={8} style={{ width: '70%' }} />
        <Button size="small" appearance={slide === 2 && i === 1 ? 'outline' : 'primary'} tabIndex={-1} style={{ width: '55%', minWidth: 0 }}>Buy</Button>
        <SkeletonItem size={8} style={{ width: '45%' }} />
      </Skeleton>
      {slide === 2 && i === 1 && <MousePointerClickIcon style={{ position: 'absolute', right: '20%', top: '55%', width: 20, height: 20, color: 'var(--colorPaletteYellowForeground1)' }} />}
    </Card>)}
  </Card>;
}

function Tour({ slide, setSlide, done, next }: { slide: number; setSlide: (n: number) => void; done: () => void; next: React.RefObject<HTMLButtonElement | null> }) {
  const low = useMedia(lowQ), tiny = useMedia(tinyQ), narrow = useMedia(narrowQ);
  const now = SLIDES[slide]!, last = slide === SLIDES.length - 1;
  return <section aria-label="What Kulisa does" data-slide={slide} style={{ display: 'flex', flexDirection: 'column', gap: low ? 24 : 48, width: 'min(960px, 100%)' }}>
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1.15fr)', gap: low ? 24 : 48, alignItems: 'center' }}>
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        <Title1 as="h1" style={{ textWrap: 'balance' }}>{now.title}</Title1>
        <Text size={400} style={{ ...muted, maxWidth: '42ch', lineHeight: 1.5 }}>{now.text}</Text>
      </div>
      {!tiny && <Picture slide={slide} low={low} />}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ flex: 1 }}><Dots label="Slides" count={SLIDES.length} at={slide} names={SLIDES.map((s) => s.title)} /></span>
      <Button onClick={done}>Skip</Button>
      {slide > 0 && <Button onClick={() => setSlide(slide - 1)}>Back</Button>}
      <Button ref={next} appearance="primary" onClick={() => (last ? done() : setSlide(slide + 1))}>{last ? 'Set Up a Project' : 'Next'}</Button>
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
  return <div id="welcome" style={{ flex: 1, display: 'grid', placeItems: 'safe center', overflow: 'auto', padding: 32, boxSizing: 'border-box', minHeight: 0 }}>
    {!w ? <Tour slide={slide} setSlide={setSlide} done={() => setW(wizard(true))} next={next} />
      // New Project's steps in a Card, not a dialog: nothing else is in the window to cover
      : <Card size="large" style={{ width: 'min(760px, 100%)', minHeight: 'min(520px, 100%)' }}>
        <Wizard w={w} leave={() => setW(null)} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          {({ step, steps, error, back, go }) => <>
            <CardHeader header={<Title1 as="h1">{QUESTIONS[step]}</Title1>} description={<Dots label="Steps" count={QUESTIONS.length} at={step} />} />
            {steps}
            {error}
            <CardFooter action={go}>{back}</CardFooter>
          </>}
        </Wizard>
      </Card>}
  </div>;
}
