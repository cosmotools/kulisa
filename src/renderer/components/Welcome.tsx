// The first start, no project at all (docs/tasks.md, The welcome): what Kulisa does in three slides, then New Project's
// own steps under a question each. The slides' pictures are a task's window drawn small from Fluent's own parts: no
// pictures to ship, the theme's colors.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Avatar, Badge, Button, Card, CardFooter, CardHeader, Skeleton, SkeletonItem, Text, Title1, createPresenceComponent, makeStyles, mergeClasses, motionTokens,
  tokens } from '@fluentui/react-components';
import { CursorClick20Regular } from '@fluentui/react-icons';
import { agentMark } from './AgentMark';
import { avatarSrc } from './avatar';
import { Wizard } from './NewProject';
import { wizard, type Wizard as W } from '../lib/new-project';
import { useCommonStyles } from './theme';

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
const low = '@media (max-height: 640px)', narrow = '@media (max-width: 720px)';

const useStyles = makeStyles({
  root: { flex: 1, display: 'grid', placeItems: 'safe center', overflow: 'auto', padding: tokens.spacingHorizontalXXXL, boxSizing: 'border-box', minHeight: 0 },
  dots: { display: 'flex', gap: tokens.spacingHorizontalSNudge, margin: 0, padding: 0, listStyle: 'none' },
  done: { color: tokens.colorPaletteGreenForeground1 },
  picture: { display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', aspectRatio: '16 / 10', minWidth: 0, justifySelf: 'center', width: '100%', boxSizing: 'border-box',
    [low]: { width: 'min(100%, calc((100vh - 200px) * 1.6))' } },
  terminal: { gap: tokens.spacingVerticalXS, overflow: 'hidden' },
  pane: { overflow: 'hidden', position: 'relative' },
  page: { display: 'grid', gap: tokens.spacingVerticalSNudge },
  w70: { width: '70%' },
  w45: { width: '45%' },
  buy: { width: '55%', minWidth: 0 },
  pointer: { position: 'absolute', right: '20%', top: '55%', color: tokens.colorPaletteYellowForeground1 },
  tour: { display: 'flex', flexDirection: 'column', gap: '48px', width: 'min(960px, 100%)', [low]: { gap: tokens.spacingVerticalXXL } },
  slide: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)', gap: '48px', alignItems: 'center',
    [narrow]: { gridTemplateColumns: 'minmax(0, 1fr)' }, [low]: { gap: tokens.spacingHorizontalXXL } },
  words: { display: 'grid', gap: tokens.spacingVerticalL, minWidth: 0 },
  title: { textWrap: 'balance' },
  text: { maxWidth: '42ch', lineHeight: 1.5 },
  buttons: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  grow: { flex: 1 },
  steps: { width: 'min(760px, 100%)', minHeight: 'min(520px, 100%)' },
  wizard: { flex: 1, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, minHeight: 0 },
});

// A line of the terminal fading in as the slide comes to it.
const FadeIn = createPresenceComponent({
  enter: { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: motionTokens.durationSlower, easing: motionTokens.curveEasyEase },
  exit: { keyframes: [{ opacity: 1 }, { opacity: 0 }], duration: motionTokens.durationSlower, easing: motionTokens.curveEasyEase },
});

// Steps as dots, the ones done and the shown one filled.
function Dots({ label, count, at, names }: { label: string; count: number; at: number; names?: string[] }) {
  const styles = useStyles();
  return <ol aria-label={label} className={styles.dots}>
    {Array.from({ length: count }, (_, i) => <li key={i} aria-current={i === at ? 'step' : undefined} aria-label={names?.[i]}>
      <Badge size="tiny" shape="circular" appearance={i <= at ? 'filled' : 'outline'} color={i <= at ? 'brand' : 'subtle'} /></li>)}
  </ol>;
}

// A task: its agent's terminal, two profiles' panes; what the slide says lit in it.
function Picture({ slide }: { slide: number }) {
  const styles = useStyles(), common = useCommonStyles();
  const line = (text: string, on: boolean, className?: string) => <FadeIn visible={on}><Text font="monospace" size={200} className={className}>{text}</Text></FadeIn>;
  return <Card aria-hidden="true" size="small" appearance="filled-alternative" className={styles.picture}>
    <Card size="small" appearance="filled-alternative" className={styles.terminal}>
      <Text font="monospace" size={200}><Claude /> claude</Text>
      {line('> does the checkout work for every user?', true)}
      {line('⏺ Checking as Admin…', slide >= 1, common.muted)}
      {line('⏺ Checking as Customer…', slide >= 1, common.muted)}
      {line('✓ Fixed: works for both', slide >= 1, styles.done)}
    </Card>
    {PANES.map((p, i) => <Card key={p.name} size="small" selected={slide === 1} className={styles.pane}>
      <CardHeader image={<Avatar size={16} image={{ src: avatarSrc(p.avatar) }} />} header={<Text size={200}>{p.name}</Text>} />
      <Skeleton animation="pulse" className={styles.page}>
        <SkeletonItem size={8} /><SkeletonItem size={8} className={styles.w70} />
        <Button size="small" appearance={slide === 2 && i === 1 ? 'outline' : 'primary'} tabIndex={-1} className={styles.buy}>Buy</Button>
        <SkeletonItem size={8} className={styles.w45} />
      </Skeleton>
      {slide === 2 && i === 1 && <CursorClick20Regular className={styles.pointer} />}
    </Card>)}
  </Card>;
}

function Tour({ slide, setSlide, done, next }: { slide: number; setSlide: (n: number) => void; done: () => void; next: React.RefObject<HTMLButtonElement | null> }) {
  const tiny = useMedia(tinyQ), styles = useStyles(), common = useCommonStyles(); // tiny: no room for the picture at all
  const now = SLIDES[slide]!, last = slide === SLIDES.length - 1;
  return <section aria-label="What Kulisa does" data-slide={slide} className={styles.tour}>
    <div className={styles.slide}>
      <div className={styles.words}>
        <Title1 as="h1" className={styles.title}>{now.title}</Title1>
        <Text size={400} className={mergeClasses(common.muted, styles.text)}>{now.text}</Text>
      </div>
      {!tiny && <Picture slide={slide} />}
    </div>
    <div className={styles.buttons}>
      <span className={styles.grow}><Dots label="Slides" count={SLIDES.length} at={slide} names={SLIDES.map((s) => s.title)} /></span>
      <Button onClick={done}>Skip</Button>
      {slide > 0 && <Button onClick={() => setSlide(slide - 1)}>Back</Button>}
      <Button ref={next} appearance="primary" onClick={() => (last ? done() : setSlide(slide + 1))}>{last ? 'Set Up a Project' : 'Next'}</Button>
    </div>
  </section>;
}

export function Welcome() {
  const [slide, setSlide] = useState(0), [w, setW] = useState<W | null>(null); // w: New Project's steps, shown
  const next = useRef<HTMLButtonElement>(null), styles = useStyles();
  useEffect(() => {
    focusNow = () => next.current?.focus(); // the steps take it themselves, in their first field
    if (asked) { asked = false; focusNow(); }
    return () => { focusNow = null; };
  }, []);
  return <div id="welcome" className={styles.root}>
    {!w ? <Tour slide={slide} setSlide={setSlide} done={() => setW(wizard(true))} next={next} />
      // New Project's steps in a Card, not a dialog: nothing else is in the window to cover
      : <Card size="large" className={styles.steps}>
        <Wizard w={w} leave={() => setW(null)} className={styles.wizard}>
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
