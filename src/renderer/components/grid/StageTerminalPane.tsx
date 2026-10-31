// A Stage terminal for CLI testing (docs/window.md, Stage terminals).
import { useEffect, useRef, useState } from 'react';
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import { ArrowDownIcon, ArrowUpIcon, CircleAlertIcon, EllipsisIcon, PlayIcon, RotateCwIcon, TerminalSquareIcon, XIcon } from 'lucide-react';
import { Alert, AlertDescription, Button, Input } from '@ui';
import { ButtonMenu, RightClickMenu } from '../Menus';
import { act, store, useWindow } from '../../lib/store';
import { dialog } from '../../lib/dialogs';
import { focusStageTerminal } from '../../lib/environments';
import { EnvironmentFocus, environmentFocusItem } from './EnvironmentFocus';
import { termStyle, useShade } from '../../lib/theme';
import { View, termCopy, termPaste, termFocus } from '../../../terminal/renderer';
import type { MenuItem } from '../../lib/menu';
import type { StageTerminal } from '../../../shared/stage-terminal';

const idOf = (id: string) => Number(id.slice('stage-terminal:'.length));
const useStageTerminal = (id: number) => useWindow((s) => s.stageTerminals.find((a) => a.id === id));
const status = (terminal: StageTerminal) => terminal.status === 'exited' ? `Exited (${terminal.exitCode})` : terminal.status === 'stopped' ? 'Stopped' : terminal.status === 'starting' ? 'Starting…' : terminal.session === 'shell' ? 'Shell' : 'Running';
const runAction = (terminal: StageTerminal) => ({
  label: terminal.status === 'exited' ? 'Run again'
    : terminal.status === 'stopped' ? 'Start'
      : terminal.session === 'shell' ? terminal.command.trim() ? 'Run app' : 'Restart shell' : 'Restart app',
  enabled: terminal.status !== 'starting',
  run: () => focusStageTerminal(() => act('stage-terminal:run', { id: terminal.id })),
});
const actions = (terminal: StageTerminal): MenuItem[] => [
  runAction(terminal),
  { label: 'Stop', enabled: terminal.status === 'running' || terminal.status === 'starting', run: () => act('stage-terminal:stop', { id: terminal.id }) },
  '-',
  { label: 'Settings…', run: async () => (await dialog('stageTerminalSettings')).open(terminal) },
  { label: 'Fit to pane', run: () => act('stage-terminal:configure', { id: terminal.id, size: null }) },
  { label: 'Close Stage terminal', run: () => act('stage-terminal:close', { id: terminal.id }) },
];
export function StageTerminalPane({ api }: IDockviewPanelProps) {
  const id = idOf(api.id), terminal = useStageTerminal(id), shade = useShade(), host = useRef<HTMLDivElement>(null);
  const view = useRef<View | null>(null);
  const [searching, setSearching] = useState(false), [query, setQuery] = useState(''), [found, setFound] = useState(true);
  const searchInput = useRef<HTMLInputElement>(null);
  const find = (previous = false) => setFound(view.current?.find(query, previous) ?? false);
  const closeSearch = () => { setSearching(false); view.current?.clearSearch(); view.current?.term.focus(); };
  useEffect(() => {
    if (!searching) return;
    searchInput.current?.focus();
    searchInput.current?.select();
  }, [searching]);
  useEffect(() => {
    if (searching) setFound(view.current?.find(query, false, true) ?? false);
  }, [query, searching, terminal?.key, terminal?.status]);
  const focus = useWindow((s) => s.stageTerminalFocus);
  const hasAgent = useWindow((s) => s.developmentTerminals.list.some((t) => !!t.agent && !t.starting));
  useEffect(() => {
    const v = view.current = new View(termStyle());
    v.onSearchResult = setFound;
    host.current!.append(v.el);
    return () => { view.current = null; v.dispose(); };
  }, []);
  useEffect(() => { view.current?.show(terminal?.key ?? null); }, [terminal?.key, terminal?.status]);
  useEffect(() => { view.current?.setSize(terminal?.size ?? null); }, [terminal?.size]);
  useEffect(() => { view.current?.restyle(termStyle()); }, [shade]);
  useEffect(() => {
    if (!focus?.key || focus.key !== terminal?.key) return;
    let cancelled = false;
    const attempt = () => {
      void termFocus(focus.key!, () => !cancelled && store.getState().stageTerminalFocus === focus
        && store.getState().current === focus.task && api.isVisible && document.hasFocus()).then(() => {
        if (!cancelled && store.getState().stageTerminalFocus === focus && view.current?.el.contains(document.activeElement)) store.setState({ stageTerminalFocus: null });
      });
    };
    const visible = api.onDidVisibilityChange(attempt);
    const frame = requestAnimationFrame(attempt);
    attempt();
    return () => { cancelled = true; cancelAnimationFrame(frame); visible.dispose(); };
  }, [focus, terminal?.key, api]);
  if (!terminal) return null;
  const menu = (): MenuItem[] => {
    const selection = view.current?.term.getSelection() ?? '', task = store.getState().current;
    return [
      { label: 'Send selection to agent', enabled: !!selection.trim() && hasAgent, run: () => kulisa.invoke('selection:send', { task, source: { kind: 'stage-terminal', id }, text: selection }) },
      { label: 'Copy', enabled: view.current?.term.hasSelection() ?? false, run: () => { if (view.current) termCopy(view.current.term); } },
      { label: 'Paste', enabled: terminal.status === 'running', run: () => { if (view.current) termPaste(view.current.term); } },
      { label: 'Select all', run: () => view.current?.term.selectAll() },
      { label: 'Find…', run: () => setSearching(true) }, '-', environmentFocusItem(api), ...actions(terminal),
    ];
  };
  return <section role="region" aria-label={terminal.name} data-stage-terminal={id} data-state={terminal.status} className="flex h-full min-w-0 flex-col bg-card" onKeyDownCapture={(e) => {
    if ((e.ctrlKey || kulisa.platform === 'darwin' && e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault(); e.stopPropagation(); setSearching(true); searchInput.current?.focus(); searchInput.current?.select();
    } else if (searching && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSearch(); }
  }}>
    {searching && <div role="search" aria-label="Terminal search" className="flex flex-none items-center gap-1 border-b p-1">
      <Input ref={searchInput} aria-label="Find in terminal" placeholder="Find in terminal" value={query} className="h-7 min-w-0 flex-1" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); find(e.shiftKey); }
      }} />
      {query && !found && <span role="status" className="text-xs text-muted-foreground">No matches</span>}
      <Button variant="ghost" size="icon-xs" aria-label="Previous match" title="Previous match (Shift+Enter)" disabled={!query} onClick={() => find(true)}><ArrowUpIcon /></Button>
      <Button variant="ghost" size="icon-xs" aria-label="Next match" title="Next match (Enter)" disabled={!query} onClick={() => find()}><ArrowDownIcon /></Button>
      <Button variant="ghost" size="icon-xs" aria-label="Close search" title="Close search (Esc)" onClick={closeSearch}><XIcon /></Button>
    </div>}
    {terminal.launchError && <div className="flex-none p-2">
      <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{terminal.launchError}</span></AlertDescription></Alert>
    </div>}
    <RightClickMenu items={menu} className="min-h-0 flex-1 overflow-auto">
      <div ref={host} data-zone="terminal" className="h-full min-h-20 px-1" />
    </RightClickMenu>
  </section>;
}
export function StageTerminalHeader({ api, containerApi }: IDockviewPanelHeaderProps) {
  const activity = useWindow((s) => s.stageActivity === api.id);
  const id = idOf(api.id), terminal = useStageTerminal(id);
  const launch = terminal && runAction(terminal);
  return <RightClickMenu items={() => terminal ? [environmentFocusItem(api), ...actions(terminal)] : null} className="h-full min-w-0">
    <div data-panel={api.id} data-agent-active={activity || undefined} className="flex h-full min-w-0 items-center gap-1 px-2 data-[agent-active=true]:bg-accent">
      <TerminalSquareIcon className="size-4" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{terminal?.name}</span>
      {terminal && <span role="status" className="truncate text-xs text-muted-foreground" title={status(terminal)}>{status(terminal)}</span>}
      {launch && <Button variant="ghost" size="icon-xs" aria-label={launch.label} title={launch.label} disabled={!launch.enabled} onClick={() => void launch.run()}>
        {launch.label.startsWith('Restart') ? <RotateCwIcon /> : <PlayIcon />}
      </Button>}
      <EnvironmentFocus api={api} containerApi={containerApi} />
      <ButtonMenu items={() => terminal ? [environmentFocusItem(api), ...actions(terminal)] : []} end>
        <Button variant="ghost" size="icon-xs" aria-label="Terminal menu" title="Terminal menu"><EllipsisIcon /></Button>
      </ButtonMenu>
      <Button variant="ghost" size="icon-xs" aria-label="Close Stage terminal" title="Close Stage terminal" onClick={() => void act('stage-terminal:close', { id })}><XIcon /></Button>
    </div>
  </RightClickMenu>;
}
