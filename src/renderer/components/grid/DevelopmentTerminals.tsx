// The task’s development terminal panel (docs/window.md, The terminal); its shared View outlives the panel.
import { createElement, useEffect, useLayoutEffect, useRef, type Ref } from 'react';
import { CheckIcon, PlusIcon } from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview-react';
import { Avatar, AvatarImage, Button, Item, ItemContent, ItemDescription, ItemMedia, ItemTitle, Spinner } from '@ui';
import { ButtonMenu, RightClickMenu } from '../Menus';
import { agentMark } from '../AgentMark';
import { termStyle, useShade } from '../../lib/theme';
import { store, useWindow } from '../../lib/store';
import { profileLaunchers } from '../../lib/profiles';
import { panelView, launchers, newTerminalItems, terminalItems, terminalMenu } from '../../lib/development-terminals';
import { avatarSrc, withKeys } from '../../lib/common';
import { dialogsShown } from '../../lib/cover';
import { newStageTerminal } from '../../lib/environments';
import { termFocus } from '../../../terminal/renderer';
import { Pill } from '../../../dictation/renderer';

const NEW_TITLE = 'New conversation of an agent, or a terminal';
export function DevelopmentTerminals({ api, containerApi }: IDockviewPanelProps) {
  const host = useRef<HTMLDivElement>(null), launch = useRef<HTMLDivElement>(null), shade = useShade();
  // The task from the terminals' own message (docs/window.md, The terminal).
  const task = useWindow((s) => s.developmentTerminals.task ?? null), front = useWindow((s) => s.developmentTerminals.front);
  const folded = useWindow((s) => !s.developmentTerminals.list.length);
  const alone = useWindow((s) => !s.profiles.length);
  const loading = useWindow((s) => s.loading);
  // The tab in front before its program has started (an agent's is looked for first): a loader over its terminal, which
  // stays laid out meanwhile (the program starts at its size).
  const starting = useWindow((s) => s.developmentTerminals.list.find((t) => t.id === s.developmentTerminals.front && t.starting)?.name);
  const shown = task !== null && front !== null ? `${task}#${front}` : null;

  useLayoutEffect(() => {
    // Retained panels catch up in a later frame; DOM client/offset dimensions round Dockview's fractional CSS pixels.
    panelView.isLaidOut = () => {
      const grid = document.getElementById('grid');
      return grid?.clientWidth === Math.round(containerApi.width) && grid?.clientHeight === Math.round(containerApi.height)
        && host.current?.offsetWidth === Math.round(api.width) && host.current?.offsetHeight === Math.round(api.height);
    };
    return () => { panelView.isLaidOut = undefined; };
  }, [api, containerApi]);
  useEffect(() => { host.current!.append(panelView.el); }, []);
  useEffect(() => panelView.show(shown), [shown]);
  // The terminal in the panel's own color (the grid's: Grid.css), again when the shade changes.
  useEffect(() => panelView.restyle(termStyle()), [shade]);
  // Another tab in front of the same task (chosen, or opened by the human): the keyboard goes to it. Not from a dialog
  // (Change Agent's tab comes in front under it): the dialog keeps the keyboard.
  const was = useRef({ task, front });
  useEffect(() => {
    const before = was.current;
    was.current = { task, front };
    if (task === before.task && front !== before.front && front !== null && !dialogsShown()) void termFocus(`${task}#${front}`);
  }, [task, front]);

  // The big buttons, each a Tab stop (Tab to the next, Enter opens it): the first, the project's default agent, gets the
  // keyboard when the keyboard was in the terminal just closed or nowhere (not taken from a field or a dialog). No keys
  // on them: Ctrl+` opens the task's agent, which the window does not show.
  const big = folded && alone && !loading;
  // A question open as they come (closing an agent's tab asks first): once it has gone, also from the page (a dialog
  // keeps the keyboard in it while it fades out, and gives it back as it goes).
  useEffect(() => {
    if (!big) return;
    let frame = 0;
    const take = () => {
      if (dialogsShown() || document.querySelector('[role="dialog"], [role="alertdialog"]')) { frame = requestAnimationFrame(take); return; }
      const a = document.activeElement;
      if (a && a !== document.body && !host.current?.contains(a) && !launch.current?.contains(a)) return;
      launch.current?.querySelector<HTMLElement>('[data-launcher]')?.focus();
    };
    take();
    return () => cancelAnimationFrame(frame);
  }, [big]);

  const menu = (e: MouseEvent) => {
    const { developmentTerminals } = store.getState(), t = developmentTerminals.list.find((x) => x.id === developmentTerminals.front);
    return t && task && (e.target as Element).closest('[data-testid="terminal"]') ? terminalMenu(`${task}#${t.id}`, terminalItems(t)) : null;
  };

  // One cell: the launchers or the folded +, and the terminal, take it in turn; the pill and the loader lie over it.
  return <div data-testid='development-terminals' data-folded={folded || undefined} className="relative grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] bg-card">
    {big ? <Launchers ref={launch} />
      : folded ? <div className="grid place-items-center">
        <ButtonMenu items={newTerminalItems}><Button data-unfold variant="ghost" size="icon-sm" aria-label="New terminal"
          title={withKeys(NEW_TITLE, 'terminal.new')}><PlusIcon /></Button></ButtonMenu>
      </div> : null}
    <RightClickMenu items={menu}>
      <div ref={host} data-testid="terminal" data-zone="terminal" hidden={folded} className="h-full py-0.5 ps-2 pe-1" />
    </RightClickMenu>
    {!folded && <Pill task={task}><CheckIcon className="size-3.5 text-success" /></Pill>}
    {starting && <div className="absolute inset-0 grid place-items-center bg-card text-sm"><div role="status" className="flex items-center gap-2 text-muted-foreground"><Spinner role={undefined} aria-hidden />Starting {starting}…</div></div>}
  </div>;
}

// One width for all, so the rows line up.
function Launchers({ ref }: { ref: Ref<HTMLDivElement> }) {
  const closed = useWindow((s) => s.closedProfiles);
  useWindow((s) => s.projects); // the project's agents
  return <div ref={ref} data-testid="launchers" className="flex max-w-full flex-col gap-4 self-center justify-self-center p-3">
    <nav aria-label="New terminal" className="flex flex-wrap justify-center gap-3">
      {launchers().map((l) => <Button key={l.id} data-launcher variant="outline" aria-label={l.name} title={l.title} className="h-auto w-60 justify-start"
        onClick={() => void l.run()}>
        {/* shadcn's Item laid out in the button, as its examples put one in a menu's row */}
        <Item size="sm"><ItemMedia>{createElement(agentMark(l.cli), { className: 'size-8' })}</ItemMedia>
          <ItemContent className="min-w-0"><ItemTitle>{l.name}</ItemTitle>{l.sub && <ItemDescription>{l.sub}</ItemDescription>}</ItemContent></Item>
      </Button>)}
    </nav>
    <nav aria-label="Open an environment" className="flex flex-wrap justify-center gap-3">
      <Button variant="outline" className="h-auto w-60 justify-start" onClick={() => void newStageTerminal()}><PlusIcon />Stage Terminal</Button>
      {profileLaunchers(closed).map((p) => <Button key={p.id} data-launcher data-profile={p.id} variant="outline" aria-label={p.name} title={p.title}
        className="h-auto w-60 justify-start" onClick={() => void p.run()}>
        <Item size="sm"><ItemMedia>{p.avatar ? <Avatar size="lg" aria-hidden><AvatarImage src={avatarSrc(p.avatar)} alt="" /></Avatar> : <PlusIcon className="size-8" />}</ItemMedia>
          <ItemContent className="min-w-0"><ItemTitle>{p.name}</ItemTitle></ItemContent></Item>
      </Button>)}
    </nav>
  </div>;
}
