// The task’s development terminal panel (docs/window.md, The terminal); its shared View outlives the panel.
import { createElement, useEffect, useLayoutEffect, useRef, type Ref } from 'react';
import { CheckIcon, PlusIcon } from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview-react';
import { Avatar, AvatarImage, Button, Item, ItemContent, ItemDescription, ItemMedia, ItemTitle, Spinner } from '@ui';
import { ButtonMenu, RightClickMenu } from '../components/Menus';
import { agentMark } from '../components/AgentMark';
import { useWindow } from '../lib/store';
import { useTask, useTaskActive, useTaskStore, useTaskGrid } from './state';
import { profileLaunchers } from './profiles';
import { panelView, launchers, newTerminalItems, terminalItems, terminalMenu } from './terminals';
import { avatarSrc, withKeys } from '../lib/common';
import { dialogsShown } from '../lib/cover';
import { newStageTerminal } from './environments';
import { termFocus } from '../../terminal/renderer';
import { Pill } from '../../dictation/renderer';

const NEW_TITLE = 'New conversation of an agent, or a terminal';
export function DevelopmentTerminals({ api, reviewing }: IDockviewPanelProps & { reviewing: boolean }) {
  const host = useRef<HTMLDivElement>(null), launch = useRef<HTMLDivElement>(null);
  const owner = useTaskStore();
  const grid = useTaskGrid();
  const active = useTaskActive();
  const task = useTask((s) => s.key), front = useTask((s) => s.developmentTerminals.front);
  const empty = useTask((s) => !s.developmentTerminals.list.length);
  const alone = useTask((s) => !s.profiles.length && !s.stageTerminals.length);
  const loading = useTask((s) => s.loading);
  // The tab in front before its program has started (an agent's is looked for first): a loader over its terminal, which
  // stays laid out meanwhile (the program starts at its size).
  const starting = useTask((s) => s.developmentTerminals.list.find((t) => t.id === s.developmentTerminals.front && t.starting)?.name);
  const shown = !reviewing && front !== null ? `${task}#${front}` : null;

  useLayoutEffect(() => {
    if (!active) return;
    const el = host.current!;
    // Retained panels catch up in a later frame; DOM client/offset dimensions round Dockview's fractional CSS pixels.
    panelView.isLaidOut = () => {
      const area = host.current?.closest('[data-development-grid]'), parent = grid.development.parent;
      return !!parent && area?.clientWidth === Math.round(parent.width) && area?.clientHeight === Math.round(parent.height)
        && host.current?.offsetWidth === Math.round(api.width) && host.current?.offsetHeight === Math.round(api.height);
    };
    el.append(panelView.el);
    return () => { panelView.isLaidOut = undefined; if (panelView.el.parentElement === el) panelView.el.remove(); };
  }, [api, grid, active]);
  useLayoutEffect(() => { if (active) panelView.show(shown); }, [active, shown]);
  // Another tab in front of the same task (chosen, or opened by the human): the keyboard goes to it. Not from a dialog
  // (Change Agent's tab comes in front under it): the dialog keeps the keyboard.
  const was = useRef(front);
  useEffect(() => {
    const before = was.current;
    was.current = front;
    if (active && !reviewing && front !== before && front !== null && !dialogsShown()) void termFocus(`${task}#${front}`);
  }, [task, front, reviewing, active]);

  // The big buttons, each a Tab stop (Tab to the next, Enter opens it): the first, the project's default agent, gets the
  // keyboard when the keyboard was in the terminal just closed or nowhere (not taken from a field or a dialog). No keys
  // on them: Ctrl+` opens the task's agent, which the window does not show.
  const big = empty && alone && !loading && !reviewing;
  // A question open as they come (closing an agent's tab asks first): once it has gone, also from the page (a dialog
  // keeps the keyboard in it while it fades out, and gives it back as it goes).
  useEffect(() => {
    if (!active || !big) return;
    let frame = 0;
    const take = () => {
      if (dialogsShown() || document.querySelector('[role="dialog"], [role="alertdialog"]')) { frame = requestAnimationFrame(take); return; }
      const a = document.activeElement;
      if (a && a !== document.body && !host.current?.contains(a) && !launch.current?.contains(a)) return;
      launch.current?.querySelector<HTMLElement>('[data-launcher]')?.focus();
    };
    take();
    return () => cancelAnimationFrame(frame);
  }, [big, active]);

  const menu = (e: MouseEvent) => {
    const { developmentTerminals } = owner.getState(), t = developmentTerminals.list.find((x) => x.id === developmentTerminals.front);
    return t && (e.target as Element).closest('[data-testid="terminal"]') ? terminalMenu(`${task}#${t.id}`, terminalItems(task, t)) : null;
  };

  return <div data-testid='development-terminals' data-empty={empty || undefined} className="relative grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] bg-card">
    {big ? <Launchers ref={launch} />
      : empty ? <div className="grid place-items-center">
        <ButtonMenu items={() => newTerminalItems(task)}><Button variant="ghost" size="icon-sm" aria-label="New terminal"
          title={withKeys(NEW_TITLE, 'terminal.new')}><PlusIcon /></Button></ButtonMenu>
      </div> : null}
    <RightClickMenu items={menu}>
      <div ref={host} data-testid="terminal" data-zone="terminal" hidden={empty} className="h-full py-0.5 ps-2 pe-1" />
    </RightClickMenu>
    {!empty && <Pill task={task}><CheckIcon className="size-3.5 text-success" /></Pill>}
    {starting && <div className="absolute inset-0 grid place-items-center bg-card text-sm"><div role="status" className="flex items-center gap-2 text-muted-foreground"><Spinner role={undefined} aria-hidden />Starting {starting}…</div></div>}
  </div>;
}

// One width for all, so the rows line up.
function Launchers({ ref }: { ref: Ref<HTMLDivElement> }) {
  const task = useTask((s) => s.key), closed = useTask((s) => s.closedProfiles);
  useWindow((s) => s.projects.open); // the project's agents
  return <div ref={ref} data-testid="launchers" className="flex max-w-full flex-col gap-4 self-center justify-self-center p-3">
    <nav aria-label="New terminal" className="flex flex-wrap justify-center gap-3">
      {launchers(task).map((l) => <Button key={l.id} data-launcher variant="outline" aria-label={l.name} title={l.title} className="h-auto w-60 justify-start"
        onClick={() => void l.run()}>
        {/* shadcn's Item laid out in the button, as its examples put one in a menu's row */}
        <Item size="sm"><ItemMedia>{createElement(agentMark(l.cli), { className: 'size-8' })}</ItemMedia>
          <ItemContent className="min-w-0"><ItemTitle>{l.name}</ItemTitle>{l.sub && <ItemDescription>{l.sub}</ItemDescription>}</ItemContent></Item>
      </Button>)}
    </nav>
    <nav aria-label="Open an environment" className="flex flex-wrap justify-center gap-3">
      <Button variant="outline" className="h-auto w-60 justify-start" onClick={() => void newStageTerminal(task)}><PlusIcon />Stage Terminal</Button>
      {profileLaunchers(task, closed).map((p) => <Button key={p.id} data-launcher data-profile={p.id} variant="outline" aria-label={p.name} title={p.title}
        className="h-auto w-60 justify-start" onClick={() => void p.run()}>
        <Item size="sm"><ItemMedia>{p.avatar ? <Avatar size="lg" aria-hidden><AvatarImage src={avatarSrc(p.avatar)} alt="" /></Avatar> : <PlusIcon className="size-8" />}</ItemMedia>
          <ItemContent className="min-w-0"><ItemTitle>{p.name}</ItemTitle></ItemContent></Item>
      </Button>)}
    </nav>
  </div>;
}
