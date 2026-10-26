// The shown task's terminals, a panel of the grid (docs/window.md, The terminal): the terminal in front, its tabs in the
// panel's header (TerminalsHeader). The xterms live as long as their terminals (lib/terminals.ts); the panel holds the
// shown task's. With none, the panel folds to its + (by its height with a panel over or under it, by its width when it
// is as tall as the grid), and unfolds to the size it had when one opens. With no profile open it is the grid's room for
// them: the +'s rows are big buttons in its middle instead, the closed profiles' under them.
import { useCallback, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Avatar, Button, Spinner, Tab, TabList, Text, tokens } from '@fluentui/react-components';
import { CheckIcon, MessageCircleQuestionIcon, MicIcon, PlusIcon, SparklesIcon, XIcon } from 'lucide-react';
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import { ButtonMenu, RightClickMenu } from '../Menus';
import { agentMark } from '../AgentMark';
import { ThemeShown, termStyle } from '../theme';
import { act, store, useWindow } from '../../lib/store';
import { profileLaunchers } from '../../lib/profiles';
import { island, launchers, newTerminalItems, shownTerm, tabItems, terminalMenu } from '../../lib/terminals';
import { dialog } from '../../lib/dialogs';
import { avatarSrc, keyText, withKeys } from '../../lib/common';
import { useStrip } from '../../lib/strip';
import { dialogsShown } from '../../lib/cover';
import { termFocus } from '../../../terminal/renderer';
import type { Terminal } from '../../../shared/types';

function Dictation(_: { task: string | null; keyName: string; language: string; onDone: () => void; children: ReactNode }) { return null; }
function Pill(_: { task: string | null; children: ReactNode }) { return null; }

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
  const host = useRef<HTMLDivElement>(null), launch = useRef<HTMLDivElement>(null), theme = useContext(ThemeShown);
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

  useEffect(() => { host.current!.append(island.el); }, []);
  useEffect(() => island.show(shown), [shown]);
  useEffect(() => island.restyle(termStyle(theme, 'colorNeutralBackground1')), [theme]);
  // Another tab in front of the same task (chosen, or opened by the human): the keyboard goes to it. Not from a dialog
  // (Change Agent's tab comes in front under it): Fluent's dialog hides itself from the keyboard and the screen reader
  // once the keyboard leaves it.
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
  // A question open as they come (closing an agent's tab asks first): once it has gone, also from the page (Fluent's
  // dialog keeps the keyboard in it until then, and gives it back as it goes).
  useEffect(() => {
    if (!big) return;
    let frame = 0;
    const take = () => {
      if (dialogsShown() || document.querySelector('[aria-modal="true"]')) { frame = requestAnimationFrame(take); return; }
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

  return <div data-testid="terminals" data-folded={folded || undefined}
    style={{ height: '100%', position: 'relative', display: 'grid', gridTemplateRows: 'minmax(0, 1fr)' }}>
    {big ? <Launchers ref={launch} />
      : folded ? <div style={{ display: 'grid', placeItems: 'center' }}>
        <ButtonMenu items={newTerminalItems}><Button data-unfold appearance="subtle" size="small" icon={<PlusIcon />}
          aria-label="New terminal" title={withKeys(NEW_TITLE, 'terminal.new')} /></ButtonMenu>
      </div> : null}
    <RightClickMenu items={menu}>
      <div ref={host} data-testid="terminal" data-zone="terminal" hidden={folded} style={{ height: '100%', padding: '2px 4px 2px 8px', boxSizing: 'border-box' }} />
    </RightClickMenu>
    {!folded && <Pill task={task}><CheckIcon /></Pill>}
    {starting && <div role="status" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: tokens.spacingHorizontalS, background: tokens.colorNeutralBackground1, color: tokens.colorNeutralForeground3 }}>
      <Spinner size="extra-tiny" />Starting {starting}…</div>}
  </div>;
}

// The +'s rows as big buttons in the grid's middle, the agent's mark over its name, an account's email under it; the
// task's closed profiles under them (lib/profiles.ts, profileLaunchers).
function Launchers({ ref }: { ref: React.Ref<HTMLDivElement> }) {
  const closed = useWindow((s) => s.closedProfiles);
  useWindow((s) => s.projects); // the project's agents
  const big = { flexDirection: 'column', width: 140, height: 116, gap: 4, padding: 12 } as const;
  const line = { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
  const row = { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: tokens.spacingHorizontalL } as const;
  return <div ref={ref} data-testid="launchers" style={{ alignSelf: 'center', justifySelf: 'center', display: 'flex', flexDirection: 'column',
    gap: tokens.spacingVerticalL, padding: tokens.spacingHorizontalM, maxWidth: '100%', boxSizing: 'border-box' }}>
    <nav aria-label="New terminal" style={row}>
      {launchers().map((l) => <Button key={l.id} data-launcher appearance="secondary" style={big} aria-label={l.name} title={l.title}
        icon={<l.icon style={{ fontSize: 32 }} />} onClick={() => void l.run()}>
        <span style={line}>{l.name}</span>
        {l.sub && <Text size={200} style={{ ...line, color: tokens.colorNeutralForeground3 }}>{l.sub}</Text>}
      </Button>)}
    </nav>
    <nav aria-label="Open a profile" style={row}>
      {profileLaunchers(closed).map((p) => <Button key={p.id} data-launcher data-profile={p.id} appearance="secondary" style={big} aria-label={p.name} title={p.title}
        icon={p.avatar ? <Avatar size={32} image={{ src: avatarSrc(p.avatar) }} aria-hidden /> : <PlusIcon style={{ fontSize: 32 }} />}
        onClick={() => void p.run()}><span style={line}>{p.name}</span></Button>)}
    </nav>
  </div>;
}

// An agent's state, from its hooks, an icon each, not told by color alone.
const STATES: Record<NonNullable<Terminal['state']>, string> = { working: 'is working', waiting: 'waits for you', done: 'is done' };
function State({ state }: { state: Terminal['state'] }) {
  const icon = state === 'working' ? <SparklesIcon style={{ color: tokens.colorBrandForeground1 }} />
    : state === 'waiting' ? <MessageCircleQuestionIcon style={{ color: tokens.colorStatusWarningForeground1 }} />
      : state === 'done' ? <CheckIcon style={{ color: tokens.colorStatusSuccessForeground1 }} /> : null;
  return <span data-state={state || ''} style={{ display: icon ? 'inline-flex' : 'none' }}>{icon}</span>;
}

const tabTitle = (t: Terminal) => (t.agent ? `${t.agent.name}${t.state ? `: it ${STATES[t.state]}` : ''}` : t.command || "Your shell in the task's folder");
const handOver = (t: Terminal) => void dialog('handover').then((d) => d.open(t));
const language = new Intl.DisplayNames(['en'], { type: 'language' });

// The panel's header: each terminal's tab, then +; at its end the dictation's microphone (src/dictation). The panel is
// dragged by the row's empty end, not by its tabs and buttons. Fluent's Tab is a button, and a button holds no other:
// the agent's mark (Change Agent) and × in it are spans that take the click.
export function TerminalsHeader({ api }: IDockviewPanelHeaderProps) {
  const list = useWindow((s) => s.terminals.list), front = useWindow((s) => s.terminals.front);
  const task = useWindow((s) => s.current), lang = useWindow((s) => s.language?.language);
  const row = useRef<HTMLDivElement>(null), strip = useRef<HTMLElement>(null);
  useStrip(strip, front);
  // dockview's tab grows to its content: the row would run past the panel, its + and microphone with it.
  useEffect(() => { const tab = row.current?.closest<HTMLElement>('.dv-tab'); if (tab) Object.assign(tab.style, { minWidth: '0', flexShrink: '1' }); }, []);
  const tabMenu = (e: MouseEvent) => {
    const id = (e.target as Element).closest<HTMLElement>('[data-id]')?.dataset.id, t = list.find((x) => String(x.id) === id);
    return t ? tabItems(t) : null;
  };
  const noDrag = (e: React.DragEvent) => e.preventDefault();
  return <div ref={row} data-panel={api.id} data-testid="terminal-tabs" hidden={!list.length}
    style={{ display: list.length ? 'flex' : 'none', alignItems: 'center', gap: 4, height: '100%', minWidth: 0, padding: '0 4px' }}>
    <RightClickMenu items={tabMenu}>
      <nav ref={strip} aria-label="Terminals" onDragStart={noDrag} style={{ minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <TabList size="small" reserveSelectedTabSpace={false} selectedValue={front === null ? undefined : String(front)}
          onTabSelect={(_, d) => void act('terminal:show', { id: Number(d.value) })}>
          {list.map((t) => {
            const Mark = agentMark(t.agent?.cli ?? 'shell');
            return <Tab key={t.id} value={String(t.id)} data-id={t.id} aria-label={t.name} title={tabTitle(t)} style={{ flex: 'none', maxWidth: 220 }}
              icon={t.agent
                ? <span role="button" aria-label={`${t.agent.name}: change agent…`}
                  title="Change agent: hand the task to another agent, or this one afresh; it goes on with this conversation"
                  onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); handOver(t); }}><Mark /></span>
                : <Mark style={{ color: tokens.colorNeutralForeground3 }} />}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <State state={t.state} />
                {/* Not a press on the tab: it is not chosen first. */}
                <span title={t.agent ? "Close: the agent stops (asked first); its conversation stays in the task's history" : 'Close: what runs there stops'}
                  style={{ display: 'inline-flex', color: tokens.colorNeutralForeground3 }}
                  onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); void act('terminal:close', { id: t.id }); }}><XIcon /></span>
              </span>
            </Tab>;
          })}
        </TabList>
      </nav>
    </RightClickMenu>
    <ButtonMenu items={newTerminalItems}><Button appearance="subtle" size="small" icon={<PlusIcon />} aria-label="New terminal"
      title={withKeys(NEW_TITLE, 'terminal.new')} onDragStart={noDrag} /></ButtonMenu>
    <Dictation task={task} keyName={keyText('voice.hold')} language={lang ? language.of(lang) ?? '' : ''} onDone={() => shownTerm()?.focus()}><MicIcon /></Dictation>
  </div>;
}
