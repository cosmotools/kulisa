// A live screen per visited task, retained until its tab closes (docs/window.md, The grid).
import { memo, useLayoutEffect, useState, useRef } from 'react';
import { DockviewReact, GridviewReact, Orientation, type IDockviewPanelHeaderProps, type IGridviewPanelProps } from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { TerminalSquareIcon, PlusIcon } from 'lucide-react';
import { Avatar, AvatarImage, Button } from '@ui';
import { Stage } from './grid/Stage';
import { DevelopmentContent } from './grid/DevelopmentContent';
import { Resources } from './grid/Resources';
import { dockTheme } from '../lib/dock-theme';
import { createTaskGrid, registerTaskGrid, disposeTaskGrid } from '../lib/grid';
import { GridContext, useTaskGrid } from './grid/context';
import { TaskContext, useTask, useWindow, type TaskStore } from '../lib/store';
import { profileLaunchers } from '../lib/profiles';
import { useStrip } from '../lib/strip';
import { avatarSrc } from '../lib/common';
import { newStageTerminal } from '../lib/environments';
import './Grid.css';

const components = { terminal: DevelopmentContent, resources: Resources };
const tabComponents = { terminal: DevelopmentPanelHeader, resources: DevelopmentPanelHeader };
function DevelopmentPanelHeader({ api }: IDockviewPanelHeaderProps) {
  return <div data-panel={api.id} className="flex h-full min-w-0 items-center px-2"><span className="min-w-0 truncate">{api.title}</span></div>;
}
function Development({ api }: IGridviewPanelProps) {
  const grid = useTaskGrid();
  return <div data-development-grid className="h-full min-h-0 min-w-0">
    <DockviewReact theme={dockTheme} disableAutoResizing disableFloatingGroups singleTabMode="fullwidth" components={components}
      tabComponents={tabComponents} onReady={(e) => grid.mountDevelopment(e.api, api)} />
  </div>;
}
const areas = { development: Development, stage: Stage };
function ClosedProfiles() {
  const closed = useTask((s) => s.closedProfiles), row = useRef<HTMLElement>(null);
  useStrip(row, null);
  return <nav ref={row} data-testid="closed-profiles" aria-label="Open an environment" className="flex flex-none gap-1 border-b bg-card px-2 py-1">
    <Button variant="ghost" size="sm" onClick={() => void newStageTerminal()} aria-label="Stage Terminal"><TerminalSquareIcon />Stage Terminal</Button>
    {profileLaunchers(closed).map((p) => <Button key={p.id} variant="ghost" size="sm" data-profile={p.id} aria-label={p.name} title={p.title}
      className="max-w-72 flex-none" onClick={() => void p.run()}>
      {p.avatar && <Avatar className="size-5"><AvatarImage src={avatarSrc(p.avatar)} alt="" /></Avatar>}<span className="min-w-0 truncate">{p.name}</span><PlusIcon />
    </Button>)}
  </nav>;
}
function Screen() {
  const grid = useTaskGrid(), workspace = useRef<HTMLDivElement>(null);
  const loading = useTask((s) => s.loading);
  const folded = useTask((s) => !s.profiles.length && !s.stageTerminals.length && s.developmentTerminals.list.length > 0);
  return <section data-task-screen className="absolute inset-0 flex min-h-0 min-w-0 flex-col aria-busy:opacity-0"
    aria-busy={loading || undefined} inert={loading || undefined}>
    {folded && <ClosedProfiles />}
    <div ref={workspace} data-workspace className="min-h-0 flex-1">
      <GridviewReact components={areas} orientation={Orientation.VERTICAL} proportionalLayout
        onReady={(e) => grid.mount(e.api, workspace.current!)} />
    </div>
  </section>;
}
const TaskView = memo(function TaskView({ state, active }: { state: TaskStore; active: boolean }) {
  const [grid] = useState(() => createTaskGrid(state));
  useLayoutEffect(() => { registerTaskGrid(grid); return () => disposeTaskGrid(grid); }, [grid]);
  useLayoutEffect(() => { if (active) grid.activate(); else grid.deactivate(); }, [grid, active]);
  return <section data-task-view={grid.key} data-active={active || undefined} aria-hidden={!active || undefined}
    className="absolute inset-0" inert={!active || undefined}>
    <TaskContext value={state}><GridContext value={grid}>
      <Screen />
    </GridContext></TaskContext>
  </section>;
});
export function TaskViews() {
  const tasks = useWindow((s) => s.tasks), current = useWindow((s) => s.current), loading = useTask((s) => s.loading);
  return <main id="dock" className="relative isolate min-h-0 min-w-0" aria-busy={loading || undefined}>
    {Object.entries(tasks).map(([key, state]) => <TaskView key={key} state={state} active={key === current} />)}
  </main>;
}
