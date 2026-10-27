// The shown task's terminals, a panel of the grid (docs/window.md, The terminal): the terminal in front, its tabs in the
// panel's header (TerminalsHeader). The xterms live as long as their terminals (lib/terminals.ts); the panel holds the
// shown task's. With none, the panel folds to its + (by its height with a panel over or under it, by its width when it
// is as tall as the grid), and unfolds to the size it had when one opens. With no profile open it is the grid's room for
// them: the +'s rows are big buttons in its middle instead, the closed profiles' under them.
import { createElement, useCallback, useEffect, useRef, useSyncExternalStore, type DragEvent, type ReactNode, type Ref } from 'react';
import { CheckIcon, PlusIcon } from 'lucide-react';
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import { Avatar, AvatarImage, Button, Spinner } from '@ui';
import { ButtonMenu, RightClickMenu } from '../Menus';
import { BrowserTab, TabStrip } from '../BrowserTabs';
import { agentMark } from '../AgentMark';
import { AgentState, STATES } from '../AgentState';
import { termStyle, useShade } from '../../lib/theme';
import { act, store, useWindow } from '../../lib/store';
import { profileLaunchers } from '../../lib/profiles';
import { panelView, launchers, newTerminalItems, shownTerm, tabItems, terminalMenu } from '../../lib/terminals';
import { dialog } from '../../lib/dialogs';
import { avatarSrc, useShortcuts, withKeys } from '../../lib/common';
import { grow, useStrip } from '../../lib/strip';
import { dialogsShown } from '../../lib/cover';
import { termFocus } from '../../../terminal/renderer';
import { Dictation, Pill } from '../../../dictation/renderer';
import type { Terminal } from '../../../shared/types';


const NEW_TITLE = 'New conversation of an agent, or a terminal';
// The header's height (Grid.tsx): the folded panel is one button of it.
const STRIP = 36;

// Folding: the group held at one button's size along the grid's axis it lies across (dockview's constraints), its
// header gone; its size before (before), given back when it unfolds.
type Size = { width?: number; height?: number };
function fold(api: IDockviewPanelProps['api'], grid: IDockviewPanelProps['containerApi'], before: { current: Size | null }, folded: boolean, alone: boolean) {
  const group = api.group;
  if (!group) return;
  group.header.hidden = folded;
  if (folded && !alone) {
    if (before.current) return;
    const box = group.api.boundingBox;
    const across = !box || box.height < grid.height - 1; // a panel over or under it: folded by its height
    before.current = across ? { height: group.api.height } : { width: group.api.width };
    group.api.setConstraints(across ? { minimumHeight: STRIP, maximumHeight: STRIP } : { minimumWidth: STRIP, maximumWidth: STRIP });
    group.api.setSize(across ? { height: STRIP } : { width: STRIP });
  } else if (before.current) {
    const b = before.current;
    before.current = null;
    group.api.setConstraints({ minimumHeight: 0, maximumHeight: Number.MAX_SAFE_INTEGER, minimumWidth: 0, maximumWidth: Number.MAX_SAFE_INTEGER });
    group.api.setSize(b.height ? { height: Math.max(b.height, 150) } : { width: Math.max(b.width!, 200) });
  }
}

export function Terminals({ api, containerApi }: IDockviewPanelProps) {
  const host = useRef<HTMLDivElement>(null), launch = useRef<HTMLDivElement>(null), shade = useShade();
  const task = useWindow((s) => s.current), front = useWindow((s) => s.terminals.front);
  const folded = useWindow((s) => !s.terminals.list.length);
  // No profile's pane in the grid: as dockview has them, so it folds against the grid as it is laid out.
  const alone = useSyncExternalStore(useCallback((changed: () => void) => {
    const subs = [containerApi.onDidAddPanel(changed), containerApi.onDidRemovePanel(changed)];
    return () => { for (const s of subs) s.dispose(); };
  }, [containerApi]), () => !containerApi.panels.some((p) => p.id.startsWith('profile:')));
  const loading = useWindow((s) => s.loading);
  // The tab in front before its program has started (an agent's is looked for first): a loader over its terminal, which
  // stays laid out meanwhile (the program starts at its size).
  const starting = useWindow((s) => s.terminals.list.find((t) => t.id === s.terminals.front && t.starting)?.name);
  const shown = task !== null && front !== null ? `${task}#${front}` : null;

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

  const before = useRef<Size | null>(null);
  useEffect(() => fold(api, containerApi, before, folded, alone), [api, containerApi, folded, alone]);

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
    const { terminals } = store.getState(), t = terminals.list.find((x) => x.id === terminals.front);
    return t && task && (e.target as Element).closest('[data-testid="terminal"]') ? terminalMenu(`${task}#${t.id}`, tabItems(t)) : null;
  };

  // One cell: the launchers or the folded +, and the terminal, take it in turn; the pill and the loader lie over it.
  return <div data-testid="terminals" data-folded={folded || undefined} className="relative grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] bg-card">
    {big ? <Launchers ref={launch} />
      : folded ? <div className="grid place-items-center">
        <ButtonMenu items={newTerminalItems}><Button data-unfold variant="ghost" size="icon-sm" aria-label="New terminal"
          title={withKeys(NEW_TITLE, 'terminal.new')}><PlusIcon /></Button></ButtonMenu>
      </div> : null}
    <RightClickMenu items={menu}>
      <div ref={host} data-testid="terminal" data-zone="terminal" hidden={folded} className="h-full py-0.5 ps-2 pe-1" />
    </RightClickMenu>
    {!folded && <Pill task={task}><CheckIcon className="size-3.5 text-success" /></Pill>}
    {starting && <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 bg-card text-sm text-muted-foreground">
      <Spinner aria-hidden />Starting {starting}…</div>}
  </div>;
}

// The +'s rows as big buttons in the grid's middle, the agent's mark beside its name, an account's email under it; the
// task's closed profiles under them (lib/profiles.ts, profileLaunchers). One width for all, so the rows line up; the
// name and line cut with … inside.
function Launchers({ ref }: { ref: Ref<HTMLDivElement> }) {
  const closed = useWindow((s) => s.closedProfiles);
  useWindow((s) => s.projects); // the project's agents
  return <div ref={ref} data-testid="launchers" className="flex max-w-full flex-col gap-4 self-center justify-self-center p-3">
    <nav aria-label="New terminal" className="flex flex-wrap justify-center gap-3">
      {launchers().map((l) => <Button key={l.id} data-launcher variant="outline" aria-label={l.name} title={l.title} className="h-auto w-60 justify-start"
        onClick={() => void l.run()}>
        <Big icon={createElement(agentMark(l.cli), { className: 'size-8' })} name={l.name ?? ''} sub={l.sub} />
      </Button>)}
    </nav>
    <nav aria-label="Open a profile" className="flex flex-wrap justify-center gap-3">
      {profileLaunchers(closed).map((p) => <Button key={p.id} data-launcher data-profile={p.id} variant="outline" aria-label={p.name} title={p.title}
        className="h-auto w-60 justify-start" onClick={() => void p.run()}>
        <Big icon={p.avatar ? <Avatar size="lg" aria-hidden><AvatarImage src={avatarSrc(p.avatar)} alt="" /></Avatar> : <PlusIcon className="size-8" />} name={p.name} />
      </Button>)}
    </nav>
  </div>;
}

// A big button's inside: its icon, its name and the line under it.
function Big({ icon, name, sub }: { icon: ReactNode; name: string; sub?: string }) {
  return <span className="flex min-w-0 items-center gap-3 py-3">
    {icon}
    <span className="flex min-w-0 flex-col items-start">
      <span className="max-w-full truncate">{name}</span>
      {sub && <span className="max-w-full truncate text-xs font-normal text-muted-foreground">{sub}</span>}
    </span>
  </span>;
}


const tabTitle = (t: Terminal) => (t.agent ? `${t.agent.name}${t.state ? `: it ${STATES[t.state]}` : ''}` : t.command || "Your shell in the task's folder");
const handOver = (t: Terminal) => void dialog('handover').then((d) => d.open(t));
const language = new Intl.DisplayNames(['en'], { type: 'language' });
const noDrag = (e: DragEvent) => e.preventDefault();

// The panel's header: each terminal's tab, then +; at its end the dictation's microphone (src/dictation). The panel is
// dragged by the row's empty end, not by its tabs and buttons. A tab is as wide as its name, up to 220 px, never
// shrinking (the agents' marks look alike); past that the strip scrolls. An agent's mark on its tab is Change Agent,
// its own click (a button holds no other: a span with the role, as the tab's ×).
export function TerminalsHeader({ api }: IDockviewPanelHeaderProps) {
  const list = useWindow((s) => s.terminals.list), front = useWindow((s) => s.terminals.front);
  const task = useWindow((s) => s.current), lang = useWindow((s) => s.language?.language);
  const hold = useShortcuts().find((s) => s.id === 'voice.hold')?.keys[0] || '';
  const strip = useRef<HTMLDivElement>(null);
  useStrip(strip, front);
  const tabMenu = (e: MouseEvent) => {
    const id = (e.target as Element).closest<HTMLElement>('[data-id]')?.dataset.id, t = list.find((x) => String(x.id) === id);
    return t ? tabItems(t) : null;
  };
  return <div data-panel={api.id} data-testid="terminal-tabs" hidden={!list.length} className="flex h-full min-w-0 items-center gap-1 px-1">
    <RightClickMenu items={tabMenu} className="flex min-w-0 flex-[0_1_auto]">
      <nav aria-label="Terminals" className="flex min-w-0" onDragStart={noDrag}>
        <TabStrip stripRef={strip} label="Open terminals" value={front === null ? '' : String(front)}
          onChoose={(v) => void act('terminal:show', { id: Number(v) })}>
          {list.map((t) => {
            const Mark = agentMark(t.agent?.cli ?? 'shell');
            return <BrowserTab key={t.id} ref={grow} value={String(t.id)} data-id={t.id} aria-label={t.name} title={tabTitle(t)} className="max-w-[220px] flex-none"
              icon={<>
                {t.agent
                  ? <span role="button" tabIndex={-1} aria-label={`${t.agent.name}: change agent…`} className="inline-flex rounded-sm hover:bg-foreground/10"
                    title="Change agent: hand the task to another agent, or this one afresh; it goes on with this conversation"
                    onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); handOver(t); }}><Mark /></span>
                  : <Mark />}
                <AgentState state={t.state} />
              </>}
              close={{ title: t.agent ? "Close: the agent stops (asked first); its conversation stays in the task's history" : 'Close: what runs there stops',
                run: () => void act('terminal:close', { id: t.id }) }}>
              {t.name}
            </BrowserTab>;
          })}
        </TabStrip>
      </nav>
    </RightClickMenu>
    <ButtonMenu items={newTerminalItems}><Button variant="ghost" size="icon-sm" aria-label="New terminal"
      title={withKeys(NEW_TITLE, 'terminal.new')} onDragStart={noDrag}><PlusIcon /></Button></ButtonMenu>
    <span className="flex-1" />
    <Dictation task={task} keyName={hold} language={lang ? language.of(lang) ?? '' : ''} onDone={() => shownTerm()?.focus()} />
  </div>;
}
