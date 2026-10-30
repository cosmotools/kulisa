// A visible application under test, separate from development terminals (docs/window.md, Application terminals).
import { useEffect, useRef, useState } from 'react';
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import { PlayIcon, RotateCwIcon, SquareIcon, TerminalSquareIcon, XIcon } from 'lucide-react';
import { Button, Input } from '@ui';
import { RightClickMenu } from '../Menus';
import { act, useWindow } from '../../lib/store';
import { termStyle, useShade } from '../../lib/theme';
import { View, termCopy, termPaste } from '../../../terminal/renderer';
import type { MenuItem } from '../../lib/menu';
import type { ApplicationTerminal } from '../../../shared/application-terminal';

function useDraft(source: string): [string, (value: string) => void] {
  const [draft, setDraft] = useState<{ source: string; value: string } | null>(null);
  return [draft?.source === source ? draft.value : source, (value) => setDraft({ source, value })];
}
const idOf = (id: string) => Number(id.slice('application:'.length));
const useApplication = (id: number) => useWindow((s) => s.applications.find((a) => a.id === id));
const actions = (app: ApplicationTerminal): MenuItem[] => [
  { label: 'Start', enabled: app.status !== 'running' && app.status !== 'starting', run: () => act('application:start', { id: app.id }) },
  { label: 'Stop', enabled: app.status === 'running' || app.status === 'starting', run: () => act('application:stop', { id: app.id }) },
  { label: 'Restart', run: () => act('application:restart', { id: app.id }) },
  '-',
  { label: 'Fit to pane', run: () => act('application:configure', { id: app.id, size: null }) },
  { label: 'Close application terminal', run: () => act('application:close', { id: app.id }) },
];
export function ApplicationPane({ api }: IDockviewPanelProps) {
  const id = idOf(api.id), app = useApplication(id), shade = useShade(), host = useRef<HTMLDivElement>(null);
  const view = useRef<View | null>(null);
  useEffect(() => {
    // Several application panes can be visible together; DOM rendering avoids a WebGL atlas per environment.
    const v = view.current = new View({ ...termStyle(), webgl: false });
    host.current!.append(v.el);
    return () => { view.current = null; v.dispose(); };
  }, []);
  useEffect(() => { view.current?.show(app?.key ?? null); }, [app?.key, app?.status]);
  useEffect(() => { view.current?.setSize(app?.size ?? null); }, [app?.size]);
  useEffect(() => { view.current?.restyle(termStyle()); }, [shade]);
  const [command, setCommand] = useDraft(app?.command ?? '');
  const [name, setName] = useDraft(app?.name ?? '');
  const [cols, setCols] = useDraft(String(app?.size?.cols ?? 80)), [rows, setRows] = useDraft(String(app?.size?.rows ?? 24));
  const configuration = JSON.stringify([app?.name, app?.command, app?.size]);
  const [failure, setFailure] = useState<{ configuration: string; message: string } | null>(null);
  const error = failure?.configuration === configuration ? failure.message : '';
  const perform = async (request: Promise<{ error?: string }>) => { const r = await request; setFailure(r.error ? { configuration, message: r.error } : null); return !r.error; };
  if (!app) return null;
  const running = app.status === 'running' || app.status === 'starting';
  const saveCommand = () => command !== app.command && perform(act('application:configure', { id, command }));
  const start = () => void perform(act(running ? 'application:restart' : 'application:start', { id, command })).then((ok) => { if (ok) view.current?.term.focus(); });
  const menu = (): MenuItem[] => [
    { label: 'Copy', enabled: view.current?.term.hasSelection() ?? false, run: () => { if (view.current) termCopy(view.current.term); } },
    { label: 'Paste', enabled: app.status === 'running', run: () => { if (view.current) termPaste(view.current.term); } },
    { label: 'Select all', run: () => view.current?.term.selectAll() }, '-', ...actions(app),
  ];
  return <section role="region" aria-label={app.name} data-application={id} data-state={app.status} className="flex h-full min-w-0 flex-col bg-card">
    <div className="flex flex-none flex-wrap items-center gap-1 p-1">
      <Input aria-label="Application name" value={name} className="h-7 w-36" onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name !== app.name) void perform(act('application:configure', { id, name })); }} />
      <Input aria-label="Launch command" spellCheck={false} value={command} className="h-7 min-w-24 flex-1" onChange={(e) => setCommand(e.target.value)}
        onBlur={() => void saveCommand()} onKeyDown={(e) => { if (e.key === 'Enter') start(); }} placeholder="Command to run" />
      <Button variant="ghost" size="icon-sm" aria-label={running ? 'Restart application' : 'Start application'} title={running ? 'Restart application' : 'Start application'} disabled={!command.trim()} onClick={start}>
        {running ? <RotateCwIcon /> : <PlayIcon />}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Stop application" title="Stop application" disabled={!running} onClick={() => void perform(act('application:stop', { id }))}><SquareIcon /></Button>
    </div>
    <div className="flex flex-none flex-wrap items-center gap-1 px-2 pb-1 text-xs text-muted-foreground">
      <span role="status" className="flex-1">{app.status === 'exited' ? `Exited (${app.exitCode})` : app.status === 'stopped' ? 'Stopped' : app.status === 'starting' ? 'Starting…' : 'Running'}</span>
      <Input aria-label="Terminal columns" type="number" min={2} max={500} value={cols} className="h-6 w-16" onChange={(e) => setCols(e.target.value)} />
      <span aria-hidden>×</span>
      <Input aria-label="Terminal rows" type="number" min={2} max={200} value={rows} className="h-6 w-16" onChange={(e) => setRows(e.target.value)} />
      <Button variant="ghost" size="xs" onClick={() => void perform(act('application:configure', { id, size: { cols: Number(cols), rows: Number(rows) } }))}>Resize</Button>
      <Button variant="ghost" size="xs" disabled={!app.size} onClick={() => void perform(act('application:configure', { id, size: null }))}>Auto</Button>
    </div>
    {error && <p role="alert" data-selectable className="flex-none px-2 pb-1 text-sm text-destructive">{error}</p>}
    <RightClickMenu items={menu} className="min-h-0 flex-1 overflow-auto">
      <div ref={host} data-zone="terminal" className="h-full min-h-20 px-1" />
    </RightClickMenu>
  </section>;
}
export function ApplicationHeader({ api }: IDockviewPanelHeaderProps) {
  const id = idOf(api.id), app = useApplication(id);
  return <RightClickMenu items={() => app ? actions(app) : null} className="h-full min-w-0">
    <div data-panel={api.id} className="flex h-full min-w-0 items-center gap-1 px-2">
      <TerminalSquareIcon className="size-4" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{app?.name}</span>
      <Button variant="ghost" size="icon-xs" aria-label="Close application terminal" title="Close application terminal" onClick={() => void act('application:close', { id })}><XIcon /></Button>
    </div>
  </RightClickMenu>;
}
