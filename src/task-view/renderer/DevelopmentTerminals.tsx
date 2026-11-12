// The task’s development terminal panel (docs/window.md, The terminal); its shared View outlives the panel.
import { createElement, useEffect, useLayoutEffect, useRef, type Ref } from 'react';
import { PlusIcon } from 'lucide-react';
import { cn } from 'cn';
import { Avatar, AvatarImage, Button, Item, ItemContent, ItemDescription, ItemMedia, ItemTitle, Spinner } from '@ui';
import { ButtonMenu, RightClickMenu } from '../../menus/renderer';
import { agentMark } from '../../agent-presentation/renderer';
import { store, useTask, useTaskActive } from './state';
import { profileLaunchers } from './profiles';
import { panelView, launchers, newTerminalItems, terminalItems, terminalMenu } from './terminals';
import { avatarSrc } from '../../appearance/renderer';
import { withKeys } from '../../window-client/renderer';
import { dialogsShown, onDialogs } from '../../layers/renderer';
import { newStageTerminal } from './environments';
import { termFocus } from '../../terminal/renderer';

const NEW_TITLE = 'New conversation of an agent, or a terminal';
export function DevelopmentTerminals({ visible }: { visible: boolean }) {
  const host = useRef<HTMLDivElement>(null), launch = useRef<HTMLDivElement>(null);
  const active = useTaskActive();
  const task = useTask((s) => s.key), front = useTask((s) => s.developmentTerminals.front);
  const empty = useTask((s) => !s.developmentTerminals.list.length);
  const alone = useTask((s) => !s.profiles.length && !s.stageTerminals.length);
  const loading = useTask((s) => s.loading);
  const focus = useTask((s) => s.developmentTerminalFocus);
  // The tab in front before its program has started (an agent's is looked for first): a loader over its terminal, which
  // stays laid out meanwhile (the program starts at its size).
  const starting = useTask((s) => s.developmentTerminals.list.find((t) => t.id === s.developmentTerminals.front && t.starting)?.name);
  // A new background agent still needs its first measured size before the main process starts it.
  const shown = (visible || starting) && front !== null ? `${task}#${front}` : null;

  useLayoutEffect(() => {
    const el = host.current!;
    el.append(panelView.el);
    return () => { if (panelView.el.parentElement === el) { panelView.show(null); panelView.el.remove(); } };
  }, []);
  useLayoutEffect(() => { panelView.show(shown); }, [shown]);
  // Another tab in front of the same task (chosen, or opened by the human): the keyboard goes to it. Not from a dialog
  // (Change Agent's tab comes in front under it): the dialog keeps the keyboard.
  const was = useRef(front);
  useEffect(() => {
    const before = was.current;
    was.current = front;
    if (!active || !visible || front === null || !focus && front === before) return;
    let cancelled = false;
    const key = `${task}#${front}`;
    void termFocus(key, () => {
      const state = store.getState();
      return !cancelled && store.getState().current === task && state.developmentTerminals.front === front && state.workbenchItem === 'terminals'
        && state.developmentTerminalFocus === focus && !store.getState().covered && !dialogsShown() && !panelView.el.contains(document.activeElement);
    }).then(() => {
      if (!cancelled && focus && store.getState().developmentTerminalFocus === focus) store.setState({ developmentTerminalFocus: null });
    });
    return () => { cancelled = true; };
  }, [task, focus, front, visible, active]);

  // The big buttons, each a Tab stop (Tab to the next, Enter opens it): the first, the project's default agent, gets the
  // keyboard when the keyboard was in the terminal just closed or nowhere (not taken from a field or a dialog). No keys
  // on them: Ctrl+` opens the task's agent, which the window does not show.
  const big = empty && alone && !loading && visible;
  useEffect(() => {
    if (!active || !big) return;
    const take = () => {
      if (store.getState().current !== task || store.getState().covered || dialogsShown() || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      stop();
      const a = document.activeElement;
      if (a && a !== document.body && !host.current?.contains(a) && !launch.current?.contains(a)) return;
      launch.current?.querySelector<HTMLElement>('[data-launcher]')?.focus();
    };
    const stop = onDialogs(take);
    take();
    return stop;
  }, [big, active, task]);

  const menu = (e: MouseEvent) => {
    const { developmentTerminals } = store.getState(), t = developmentTerminals.list.find((x) => x.id === developmentTerminals.front);
    return t && (e.target as Element).closest('[data-testid="terminal"]') ? terminalMenu(`${task}#${t.id}`, terminalItems(task, t)) : null;
  };

  return <div data-testid='development-terminals' data-empty={empty || undefined} aria-hidden={!visible || undefined} inert={!visible || undefined}
    className={cn('absolute inset-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] bg-card', !visible && 'invisible')}>
    {big ? <Launchers ref={launch} />
      : empty ? <ButtonMenu items={() => newTerminalItems(task)}><Button data-unfold variant="ghost" size="icon-sm" className="self-center justify-self-center" aria-label="New terminal"
          title={withKeys(NEW_TITLE, 'terminal.new')}><PlusIcon /></Button></ButtonMenu>
      : null}
    <RightClickMenu items={menu}>
      <div ref={host} data-testid="terminal" data-zone="terminal" hidden={empty} className="h-full py-0.5 ps-2 pe-1" />
    </RightClickMenu>
    {starting && <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 bg-card text-sm text-muted-foreground"><Spinner role={undefined} aria-hidden />Starting {starting}…</div>}
  </div>;
}

// One width for all, so the rows line up.
function Launchers({ ref }: { ref: Ref<HTMLDivElement> }) {
  const task = useTask((s) => s.key), closed = useTask((s) => s.closedProfiles);
  useTask((s) => s.projects.open); // the project's agents
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
