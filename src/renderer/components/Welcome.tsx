// The first start, no project at all (docs/tasks.md, The welcome): what Kulisa does in three slides, then New Project's
// own steps under a question each. The slides' pictures are a task's window drawn small from Fluent's own parts: no
// pictures to ship, the theme's colors.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Avatar, Badge, Button, Card, CardFooter, CardHeader, Carousel, CarouselCard, CarouselNav, CarouselNavButton, CarouselSlider, CarouselViewport, Skeleton,
  SkeletonItem, Text, Title1, createPresenceComponent, motionTokens } from '@fluentui/react-components';
import { CursorClick20Regular } from '@fluentui/react-icons';
import { agentMark } from './AgentMark';
import { avatarSrc } from '../lib/common';
import { Wizard } from './NewProject';
import { wizard, type Wizard as W } from '../lib/new-project';
import css from './Welcome.module.css';

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

// A line of the terminal fading in as the slide comes to it.
const FadeIn = createPresenceComponent({
  enter: { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: motionTokens.durationSlower, easing: motionTokens.curveEasyEase },
  exit: { keyframes: [{ opacity: 1 }, { opacity: 0 }], duration: motionTokens.durationSlower, easing: motionTokens.curveEasyEase },
});

// Steps as dots, the ones done and the shown one filled.
function Dots({ label, count, at, names }: { label: string; count: number; at: number; names?: string[] }) {
  return <ol aria-label={label} className={css.dots}>
    {Array.from({ length: count }, (_, i) => <li key={i} aria-current={i === at ? 'step' : undefined} aria-label={names?.[i]}>
      <Badge size="tiny" shape="circular" appearance={i <= at ? 'filled' : 'outline'} color={i <= at ? 'brand' : 'subtle'} /></li>)}
  </ol>;
}

// A task: its agent's terminal, two profiles' panes; what the slide says lit in it.
function Picture({ slide }: { slide: number }) {
  // A line in the terminal's colors (its output muted, a success green), as a terminal draws them.
  const line = (text: string, on: boolean, color?: string) => <FadeIn visible={on}><span className={color}><Text font="monospace" size={200}>{text}</Text></span></FadeIn>;
  return <div className={css.frame}><Card aria-hidden="true" size="small" appearance="filled-alternative"><div className={css.picture}>
    <Card size="small" appearance="filled-alternative">
      <Text font="monospace" size={200}><Claude /> claude</Text>
      {line('> does the checkout work for every user?', true)}
      {line('⏺ Checking as Admin…', slide >= 1, css.muted)}
      {line('⏺ Checking as Customer…', slide >= 1, css.muted)}
      {line('✓ Fixed: works for both', slide >= 1, css.done)}
    </Card>
    {PANES.map((p, i) => <Card key={p.name} size="small" selected={slide === 1}>
      <CardHeader image={<Avatar size={16} image={{ src: avatarSrc(p.avatar) }} />} header={<Text size={200}>{p.name}</Text>} />
      <Skeleton animation="pulse"><div className={css.page}>
        <SkeletonItem size={8} /><div className={css.w70}><SkeletonItem size={8} /></div>
        <div className={css.buy}><Button size="small" appearance={slide === 2 && i === 1 ? 'outline' : 'primary'} tabIndex={-1}>Buy</Button></div>
        <div className={css.w45}><SkeletonItem size={8} /></div>
      </div></Skeleton>
      {slide === 2 && i === 1 && <CursorClick20Regular className={css.pointer} />}
    </Card>)}
  </div></Card></div>;
}

// Fluent's Carousel: the slides, their dots (a click shows one); Back and Next as a teaching popover's footer has them.
function Tour({ slide, setSlide, done, next }: { slide: number; setSlide: (n: number) => void; done: () => void; next: React.RefObject<HTMLButtonElement | null> }) {
  const tiny = useMedia(tinyQ); // tiny: no room for the picture at all
  const last = slide === SLIDES.length - 1;
  return <div className={css.tour}><Carousel aria-label="What Kulisa does" data-slide={slide} activeIndex={slide} onActiveIndexChange={(_, d) => setSlide(d.index)}>
    <div className={css.tourBody}>
      <CarouselViewport>
        <CarouselSlider>
          {SLIDES.map((s, i) => <CarouselCard key={s.title} aria-label={s.title}><div className={css.slide}>
            <div className={css.words}>
              <Title1 as="h1">{s.title}</Title1>
              <span className={css.text}><Text size={400}>{s.text}</Text></span>
            </div>
            {/* the slide before's picture until this one is shown, so what it says comes in then */}
            {!tiny && <Picture slide={slide >= i ? i : Math.max(0, i - 1)} />}
          </div></CarouselCard>)}
        </CarouselSlider>
      </CarouselViewport>
      <div className={css.buttons}>
        <CarouselNav>{(i) => <CarouselNavButton aria-label={SLIDES[i]!.title} />}</CarouselNav>
        <span className={css.grow} />
        <Button onClick={done}>Skip</Button>
        {slide > 0 && <Button onClick={() => setSlide(slide - 1)}>Back</Button>}
        <Button ref={next} appearance="primary" onClick={() => (last ? done() : setSlide(slide + 1))}>{last ? 'Set Up a Project' : 'Next'}</Button>
      </div>
    </div>
  </Carousel></div>;
}

export function Welcome() {
  const [slide, setSlide] = useState(0), [w, setW] = useState<W | null>(null); // w: New Project's steps, shown
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    focusNow = () => next.current?.focus(); // the steps take it themselves, in their first field
    if (asked) { asked = false; focusNow(); }
    return () => { focusNow = null; };
  }, []);
  return <div id="welcome" className={css.root}>
    {!w ? <Tour slide={slide} setSlide={setSlide} done={() => setW(wizard(true))} next={next} />
      // New Project's steps in a Card, not a dialog: nothing else is in the window to cover
      : <div className={css.steps}><Card size="large">
        <Wizard w={w} leave={() => setW(null)} className={css.wizard}>
          {({ step, steps, error, back, go }) => <>
            <CardHeader header={<Title1 as="h1">{QUESTIONS[step]}</Title1>} description={<Dots label="Steps" count={QUESTIONS.length} at={step} />} />
            {steps}
            {error}
            <CardFooter action={go}>{back}</CardFooter>
          </>}
        </Wizard>
      </Card></div>}
  </div>;
}
