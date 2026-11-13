// First-start welcome (docs/tasks.md, The welcome): one introduction with web/CLI examples, then the shared project
// flow. The examples are drawings, not live browser profiles or terminals; no hidden browser or terminal processes are started.
import { useEffect, useRef, useState } from 'react';
import { ArrowRightIcon, GitBranchIcon, GlobeIcon, KeyboardIcon, MousePointer2Icon,
  PanelTopIcon, PauseIcon, PlayIcon, SquareTerminalIcon } from 'lucide-react';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@ui';
import { ProjectSetup } from '../new-project';
import { WebExample } from './WebExample';
import { CliExample } from './CliExample';
import { AgentTerminal } from './AgentTerminal';
import { CoffeeBreak } from './CoffeeBreak';
import './animations.css';
import { AppLogo } from '../../../appearance/renderer';
import { agentMark } from '../../../agent-presentation/renderer';

let focusNow: (() => void) | null = null, asked = false;
kulisa.on('project:new', () => { if (focusNow) focusNow(); else asked = true; });
const Claude = agentMark('claude'), Codex = agentMark('codex');

function Example() {
  const [example, setExample] = useState('web'), [paused, setPaused] = useState(false), web = example === 'web';
  return <div data-paused={paused} className="welcome-demo relative min-w-0"><Tabs value={example} onValueChange={setExample} className="min-w-0">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{web ? 'One agent. Multiple browser profiles.' : 'Build your own coding agent.'}</span>
      <TabsList aria-label="Example application">
        <TabsTrigger value="web"><GlobeIcon />Web app</TabsTrigger>
        <TabsTrigger value="cli"><SquareTerminalIcon />CLI app</TabsTrigger>
      </TabsList>
    </div>
    {/* Draw the shared work area with theme tokens. Real profiles or terminals here would start processes before setup. */}
    <div className="relative"><div className="overflow-hidden rounded-xl border bg-muted/40 shadow-sm">
      <div className="flex h-9 items-center gap-2 border-b bg-card px-4 text-xs"><PanelTopIcon className="size-3.5 text-muted-foreground" />{web ? 'Build an online store' : 'Build your own coding agent'}<span className="ms-auto flex items-center gap-1 text-muted-foreground"><GitBranchIcon className="size-3" />{web ? 'checkout' : 'agent-tools'}</span></div>
      <div className="grid">
        <div inert={!web} className={`col-start-1 row-start-1 ${web ? '' : 'invisible'}`}><TabsContent forceMount value="web"><WebExample key={example} /></TabsContent></div>
        <div inert={web} className={`col-start-1 row-start-1 ${web ? 'invisible' : ''}`}><TabsContent forceMount value="cli"><CliExample key={example} /></TabsContent></div>
      </div>
      <AgentTerminal key={example} web={web} controls={<Button type="button" variant="ghost" size="icon-xs" className="motion-reduce:hidden" aria-label={paused ? 'Play demonstration' : 'Pause demonstration'} title={paused ? 'Play demonstration' : 'Pause demonstration'} onClick={() => setPaused((x) => !x)}>{paused ? <PlayIcon /> : <PauseIcon />}</Button>} />
    </div>
    <CoffeeBreak key={example} />
    </div>
    <p className={`mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground ${web ? 'invisible' : ''}`}>
      <KeyboardIcon className="size-3.5 shrink-0" />You and your agent can use the same terminal.
    </p>
  </Tabs></div>;
}

function Introduction({ start, button }: { start: () => void; button: React.RefObject<HTMLButtonElement | null> }) {
  return <section aria-label="What Kulisa does" className="grid w-full max-w-7xl gap-12 [@media(max-height:1000px)]:gap-5">
    <div className="flex items-center gap-3 [@media(max-height:850px)]:hidden"><AppLogo size={32} /><span className="text-xl font-semibold tracking-tight">Kulisa</span></div>
    <div className="grid items-center gap-12 lg:[@media(min-height:601px)]:grid-cols-[.8fr_1.4fr] [@media(max-height:1000px)]:gap-6">
      <div className="flex flex-col items-start gap-6 [@media(max-height:850px)]:gap-4">
        <h1 className="text-4xl leading-[1.12] font-semibold tracking-tight xl:text-5xl [@media(max-height:600px)]:text-3xl">Your agentic IDE.<br /><span className="text-muted-foreground">Build together.</span></h1>
        <p className="max-w-[40ch] text-base leading-relaxed text-muted-foreground [@media(max-height:600px)]:text-sm">Develop, run and test software together with the coding agent you choose. Try web and command-line apps in shared browsers and interactive terminals.</p>
        <div className="flex items-center gap-2 text-sm"><Claude className="size-5" /><Codex className="size-5" /><span className="ms-1 text-muted-foreground">Your agent. Your code. Your computer.</span></div>
        <div className="mt-2 flex flex-col items-start gap-3">
          <Button ref={button} size="lg" onClick={start}>Create a project<ArrowRightIcon /></Button>
          <p className="text-xs text-muted-foreground">Start from an idea, a folder or a repository.</p>
        </div>
      </div>
      <div className="min-w-0 max-lg:max-w-160 max-lg:justify-self-center max-lg:[@media(max-height:800px)]:hidden [@media(max-height:600px)]:hidden"><Example /></div>
    </div>
    <div className="grid grid-cols-3 gap-8 border-t pt-6 max-md:gap-4 [@media(max-height:850px)]:hidden">
      <div><p className="mb-2 flex items-center gap-2 text-sm font-medium"><PlayIcon className="size-4" />Try the real app</p><p className="text-sm text-muted-foreground">Check web apps as different users. Test CLI apps in interactive terminals.</p></div>
      <div><p className="mb-2 flex items-center gap-2 text-sm font-medium"><MousePointer2Icon className="size-4" />Work together</p><p className="text-sm text-muted-foreground">Watch the agent, try things yourself and show what needs to change.</p></div>
      <div><p className="mb-2 flex items-center gap-2 text-sm font-medium"><GitBranchIcon className="size-4" />Keep work moving</p><p className="text-sm text-muted-foreground">Open several tasks, each with its own conversation and branch when needed.</p></div>
    </div>
  </section>;
}

export function Welcome() {
  const [creating, setCreating] = useState(false), button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    focusNow = () => button.current?.focus();
    if (asked) { asked = false; focusNow(); }
    return () => { focusNow = null; };
  }, []);
  return <div id="welcome" className="flex min-h-0 flex-1 flex-col overflow-auto p-6 lg:p-10 [@media(max-height:1000px)]:p-6">
    {creating ? <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Make room for your next project</h1><p className="mt-2 text-sm text-muted-foreground">Choose an agent, bring your code and start building.</p></div>
      <ProjectSetup onBack={() => setCreating(false)} />
    </div> : <div className="grid min-h-0 flex-1 [place-items:safe_center]"><Introduction start={() => setCreating(true)} button={button} /></div>}
  </div>;
}
