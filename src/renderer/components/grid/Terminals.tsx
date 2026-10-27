// The shown task's terminals, a panel of the grid (docs/window.md, The terminal): the terminal in front, its tabs in the
// panel's header (TerminalsHeader). The xterms live as long as their terminals (lib/terminals.ts); the panel holds the
// shown task's. With none, the panel folds to its + (by its height with a panel over or under it, by its width when it
// is as tall as the grid), and unfolds to the size it had when one opens. With no profile open it is the grid's room for
// them: the +'s rows are big buttons in its middle instead, the closed profiles' under them.
import { useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { Avatar, Button, CompoundButton, Spinner, Tab, TabList, Text, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { AddRegular, CheckmarkRegular, DismissRegular } from '@fluentui/react-icons';
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import { ButtonMenu, RightClickMenu } from '../Menus';
import { agentMark } from '../AgentMark';
import { AgentState, STATES } from '../AgentState';
import { ThemeShown, termStyle, useCommonStyles } from '../theme';
import { act, store, useWindow } from '../../lib/store';
import { profileLaunchers } from '../../lib/profiles';
import { panelView, launchers, newTerminalItems, shownTerm, tabItems, terminalMenu } from '../../lib/terminals';
import { dialog } from '../../lib/dialogs';
import { avatarSrc, useShortcuts, withKeys } from '../../lib/common';
import { Grow, useStrip } from '../../lib/strip';
import { dialogsShown } from '../../lib/cover';
import { termFocus } from '../../../terminal/renderer';
import { Dictation, Pill } from '../../../dictation/renderer';
import type { Terminal } from '../../../shared/types';


const NEW_TITLE = 'New conversation of an agent, or a terminal';
// The header's height (Grid.tsx): the folded panel is one button of it.
const STRIP = 36;

const useStyles = makeStyles({
  panel: { height: '100%', position: 'relative', display: 'grid', gridTemplateRows: 'minmax(0, 1fr)', gridTemplateColumns: 'minmax(0, 1fr)',
    background: tokens.colorNeutralBackground1 },
  unfold: { display: 'grid', placeItems: 'center' },
  host: { height: '100%', padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXS} ${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`, boxSizing: 'border-box' },
  starting: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tokens.colorNeutralBackground1 },
  launchers: { alignSelf: 'center', justifySelf: 'center', display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalM, maxWidth: '100%', boxSizing: 'border-box' },
  row: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: tokens.spacingHorizontalL },
  // A tile, not a row: the compound button's icon over its name and line, centred.
  tile: { flexDirection: 'column', justifyContent: 'center', width: '140px', height: '116px', gap: tokens.spacingVerticalXS, padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}` },
  tileIcon: { marginRight: 0 },
  tileContent: { alignItems: 'center', maxWidth: '100%', minWidth: 0 },
  tileLine: { maxWidth: '100%' },
  // hidden: no terminal (the attribute, over the display)
  header: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, height: '100%', minWidth: 0, padding: `0 ${tokens.spacingHorizontalXS}`, '&[hidden]': { display: 'none' } },
  tabsArea: { display: 'flex', flex: '0 1 auto', minWidth: 0 },
  tabs: { display: 'flex', minWidth: 0 },
  strip: { flexShrink: 1 },
  tab: { flex: 'none', maxWidth: '220px' },
  label: { display: 'inline-flex', alignItems: 'center', gap: tokens.spacingHorizontalSNudge },
  close: { minWidth: 0 },
  spacer: { flex: 1 },
});

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
  const host = useRef<HTMLDivElement>(null), launch = useRef<HTMLDivElement>(null), theme = useContext(ThemeShown), styles = useStyles();
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
  useEffect(() => panelView.restyle(termStyle(theme, 'colorNeutralBackground1')), [theme]);
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

  return <div data-testid="terminals" data-folded={folded || undefined} className={styles.panel}>
    {big ? <Launchers ref={launch} />
      : folded ? <div className={styles.unfold}>
        <ButtonMenu items={newTerminalItems}><Button data-unfold appearance="subtle" size="small" icon={<AddRegular />}
          aria-label="New terminal" title={withKeys(NEW_TITLE, 'terminal.new')} /></ButtonMenu>
      </div> : null}
    <RightClickMenu items={menu}>
      <div ref={host} data-testid="terminal" data-zone="terminal" hidden={folded} className={styles.host} />
    </RightClickMenu>
    {!folded && <Pill task={task}><CheckmarkRegular /></Pill>}
    {starting && <div role="status" className={styles.starting}>
      <Spinner size="extra-tiny" label={`Starting ${starting}…`} labelPosition="after" /></div>}
  </div>;
}

// The +'s rows as big buttons in the grid's middle, the agent's mark over its name, an account's email under it; the
// task's closed profiles under them (lib/profiles.ts, profileLaunchers).
function Launchers({ ref }: { ref: React.Ref<HTMLDivElement> }) {
  const closed = useWindow((s) => s.closedProfiles);
  useWindow((s) => s.projects); // the project's agents
  const styles = useStyles();
  const contentContainer = { className: styles.tileContent };
  return <div ref={ref} data-testid="launchers" className={styles.launchers}>
    <nav aria-label="New terminal" className={styles.row}>
      {launchers().map((l) => <CompoundButton key={l.id} data-launcher appearance="secondary" className={styles.tile} aria-label={l.name} title={l.title}
        icon={{ className: styles.tileIcon, children: <l.icon /> }} contentContainer={contentContainer} onClick={() => void l.run()}
        secondaryContent={l.sub ? { className: styles.tileLine, children: <Text truncate wrap={false} block size={200}>{l.sub}</Text> } : undefined}>
        <Text truncate wrap={false} block weight="semibold">{l.name}</Text>
      </CompoundButton>)}
    </nav>
    <nav aria-label="Open a profile" className={styles.row}>
      {profileLaunchers(closed).map((p) => <CompoundButton key={p.id} data-launcher data-profile={p.id} appearance="secondary" className={styles.tile} aria-label={p.name}
        title={p.title} icon={{ className: styles.tileIcon, children: p.avatar ? <Avatar size={40} image={{ src: avatarSrc(p.avatar) }} aria-hidden /> : <AddRegular /> }}
        contentContainer={contentContainer} onClick={() => void p.run()}><Text truncate wrap={false} block weight="semibold">{p.name}</Text></CompoundButton>)}
    </nav>
  </div>;
}


const tabTitle = (t: Terminal) => (t.agent ? `${t.agent.name}${t.state ? `: it ${STATES[t.state]}` : ''}` : t.command || "Your shell in the task's folder");
const handOver = (t: Terminal) => void dialog('handover').then((d) => d.open(t));
const language = new Intl.DisplayNames(['en'], { type: 'language' });

// The panel's header: each terminal's tab, then +; at its end the dictation's microphone (src/dictation). The panel is
// dragged by the row's empty end, not by its tabs and buttons. Fluent's Tab is a button, and a button holds no other:
// the agent's mark (Change Agent) and × in it are Buttons as links, each taking its own click.
export function TerminalsHeader({ api }: IDockviewPanelHeaderProps) {
  const list = useWindow((s) => s.terminals.list), front = useWindow((s) => s.terminals.front);
  const task = useWindow((s) => s.current), lang = useWindow((s) => s.language?.language);
  const hold = useShortcuts().find((s) => s.id === 'voice.hold')?.keys[0] || '';
  const strip = useRef<HTMLDivElement>(null), styles = useStyles(), common = useCommonStyles();
  const stripClass = useStrip(strip, front);
  const tabMenu = (e: MouseEvent) => {
    const id = (e.target as Element).closest<HTMLElement>('[data-id]')?.dataset.id, t = list.find((x) => String(x.id) === id);
    return t ? tabItems(t) : null;
  };
  const noDrag = (e: React.DragEvent) => e.preventDefault();
  return <div data-panel={api.id} data-testid="terminal-tabs" hidden={!list.length} className={styles.header}>
    <RightClickMenu items={tabMenu} className={styles.tabsArea}>
      <nav aria-label="Terminals" className={styles.tabs} onDragStart={noDrag}>
        <TabList ref={strip} className={mergeClasses(stripClass, styles.strip)} appearance="filled-circular" size="small" reserveSelectedTabSpace={false} selectedValue={front === null ? undefined : String(front)}
          onTabSelect={(_, d) => void act('terminal:show', { id: Number(d.value) })}>
          {list.map((t) => {
            const Mark = agentMark(t.agent?.cli ?? 'shell');
            return <Grow key={t.id}><Tab value={String(t.id)} data-id={t.id} aria-label={t.name} title={tabTitle(t)} className={styles.tab}
              icon={t.agent
                ? <Button as="a" appearance="transparent" size="small" icon={<Mark />} tabIndex={-1} aria-label={`${t.agent.name}: change agent…`}
                  title="Change agent: hand the task to another agent, or this one afresh; it goes on with this conversation"
                  onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); handOver(t); }} />
                : <Mark className={common.muted} />}>
              <span className={styles.label}>
                {/* Text sets a weight of its own: the chosen tab's, as Fluent's Tab sets its label's */}
                <Text truncate wrap={false} weight={String(t.id) === String(front) ? 'semibold' : 'regular'}>{t.name}</Text>
                <AgentState state={t.state} />
                {/* Not a press on the tab: it is not chosen first. */}
                <Button as="a" appearance="subtle" size="small" icon={<DismissRegular />} aria-label="Close" tabIndex={-1} className={styles.close}
                  title={t.agent ? "Close: the agent stops (asked first); its conversation stays in the task's history" : 'Close: what runs there stops'}
                  onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); void act('terminal:close', { id: t.id }); }} />
              </span>
            </Tab></Grow>;
          })}
        </TabList>
      </nav>
    </RightClickMenu>
    <ButtonMenu items={newTerminalItems}><Button appearance="subtle" size="small" icon={<AddRegular />} aria-label="New terminal"
      title={withKeys(NEW_TITLE, 'terminal.new')} onDragStart={noDrag} /></ButtonMenu>
    <span className={styles.spacer} />
    <Dictation task={task} keyName={hold} language={lang ? language.of(lang) ?? '' : ''} onDone={() => shownTerm()?.focus()} />
  </div>;
}
