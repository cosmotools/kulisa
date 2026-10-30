// A visible application under test, separate from development terminals (docs/window.md, Application terminals).
import { useEffect, useRef, useState } from 'react';
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import { ArrowDownIcon, ArrowUpIcon, CircleAlertIcon, EllipsisIcon, PlayIcon, RotateCwIcon, TerminalSquareIcon, XIcon } from 'lucide-react';
import { Alert, AlertDescription, Button, Input } from '@ui';
import { ButtonMenu, RightClickMenu } from '../Menus';
import { act, store, useWindow } from '../../lib/store';
import { dialog } from '../../lib/dialogs';
import { focusApplication } from '../../lib/environments';
import { EnvironmentFocus, environmentFocusItem } from './EnvironmentFocus';
import { termStyle, useShade } from '../../lib/theme';
import { View, termCopy, termPaste, termFocus } from '../../../terminal/renderer';
import type { MenuItem } from '../../lib/menu';
import type { ApplicationTerminal } from '../../../shared/application-terminal';

const idOf = (id: string) => Number(id.slice('application:'.length));
const useApplication = (id: number) => useWindow((s) => s.applications.find((a) => a.id === id));
const status = (app: ApplicationTerminal) => app.status === 'exited' ? `Exited (${app.exitCode})` : app.status === 'stopped' ? 'Stopped' : app.status === 'starting' ? 'Starting…' : app.session === 'shell' ? 'Shell' : 'Running';
const runAction = (app: ApplicationTerminal) => ({
  label: app.status === 'exited' ? 'Run again'
    : app.status === 'stopped' ? 'Start'
      : app.session === 'shell' ? app.command.trim() ? 'Run app' : 'Restart shell' : 'Restart app',
  enabled: app.status !== 'starting',
  run: () => focusApplication(() => act('application:run', { id: app.id })),
});
const actions = (app: ApplicationTerminal): MenuItem[] => [
  runAction(app),
  { label: 'Stop', enabled: app.status === 'running' || app.status === 'starting', run: () => act('application:stop', { id: app.id }) },
  '-',
  { label: 'Settings…', run: async () => (await dialog('applicationsettings')).open(app) },
  { label: 'Fit to pane', run: () => act('application:configure', { id: app.id, size: null }) },
  { label: 'Close application terminal', run: () => act('application:close', { id: app.id }) },
];
export function ApplicationPane({ api }: IDockviewPanelProps) {
  const id = idOf(api.id), app = useApplication(id), shade = useShade(), host = useRef<HTMLDivElement>(null);
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
  }, [query, searching, app?.key, app?.status]);
  const focus = useWindow((s) => s.applicationFocus);
  const hasAgent = useWindow((s) => s.terminals.list.some((t) => !!t.agent && !t.starting));
  useEffect(() => {
    const v = view.current = new View(termStyle());
    v.onSearchResult = setFound;
    host.current!.append(v.el);
    return () => { view.current = null; v.dispose(); };
  }, []);
  useEffect(() => { view.current?.show(app?.key ?? null); }, [app?.key, app?.status]);
  useEffect(() => { view.current?.setSize(app?.size ?? null); }, [app?.size]);
  useEffect(() => { view.current?.restyle(termStyle()); }, [shade]);
  useEffect(() => {
    if (!focus?.key || focus.key !== app?.key) return;
    let cancelled = false;
    void termFocus(focus.key, () => !cancelled && store.getState().applicationFocus === focus
      && store.getState().current === focus.task && api.isVisible && document.hasFocus()).then(() => {
      if (store.getState().applicationFocus === focus) store.setState({ applicationFocus: null });
    });
    return () => { cancelled = true; };
  }, [focus, app?.key, api]);
  if (!app) return null;
  const menu = (): MenuItem[] => {
    const selection = view.current?.term.getSelection() ?? '', task = store.getState().current;
    return [
      { label: 'Send selection to agent', enabled: !!selection.trim() && hasAgent, run: () => kulisa.invoke('selection:send', { task, source: { kind: 'application', id }, text: selection }) },
      { label: 'Copy', enabled: view.current?.term.hasSelection() ?? false, run: () => { if (view.current) termCopy(view.current.term); } },
      { label: 'Paste', enabled: app.status === 'running', run: () => { if (view.current) termPaste(view.current.term); } },
      { label: 'Select all', run: () => view.current?.term.selectAll() },
      { label: 'Find…', run: () => setSearching(true) }, '-', environmentFocusItem(api), ...actions(app),
    ];
  };
  return <section role="region" aria-label={app.name} data-application={id} data-state={app.status} className="flex h-full min-w-0 flex-col bg-card" onKeyDownCapture={(e) => {
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
    {app.launchError && <div className="flex-none p-2">
      <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{app.launchError}</span></AlertDescription></Alert>
    </div>}
    <RightClickMenu items={menu} className="min-h-0 flex-1 overflow-auto">
      <div ref={host} data-zone="terminal" className="h-full min-h-20 px-1" />
    </RightClickMenu>
  </section>;
}
export function ApplicationHeader({ api, containerApi }: IDockviewPanelHeaderProps) {
  const activity = useWindow((s) => s.stageActivity === api.id);
  const id = idOf(api.id), app = useApplication(id);
  const launch = app && runAction(app);
  return <RightClickMenu items={() => app ? [environmentFocusItem(api), ...actions(app)] : null} className="h-full min-w-0">
    <div data-panel={api.id} data-agent-active={activity || undefined} className="flex h-full min-w-0 items-center gap-1 px-2 data-[agent-active=true]:bg-accent">
      <TerminalSquareIcon className="size-4" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{app?.name}</span>
      {app && <span role="status" className="truncate text-xs text-muted-foreground" title={status(app)}>{status(app)}</span>}
      {launch && <Button variant="ghost" size="icon-xs" aria-label={launch.label} title={launch.label} disabled={!launch.enabled} onClick={() => void launch.run()}>
        {launch.label.startsWith('Restart') ? <RotateCwIcon /> : <PlayIcon />}
      </Button>}
      <EnvironmentFocus api={api} containerApi={containerApi} />
      <ButtonMenu items={() => app ? [environmentFocusItem(api), ...actions(app)] : []} end>
        <Button variant="ghost" size="icon-xs" aria-label="Terminal menu" title="Terminal menu"><EllipsisIcon /></Button>
      </ButtonMenu>
      <Button variant="ghost" size="icon-xs" aria-label="Close application terminal" title="Close application terminal" onClick={() => void act('application:close', { id })}><XIcon /></Button>
    </div>
  </RightClickMenu>;
}
