// A live screen per visited task, retained until its tab closes (docs/window.md, The grid).
import { memo, Suspense, useEffect, useLayoutEffect, useState, useRef } from 'react';
import { useStore } from 'zustand';
import { DockviewReact, GridviewReact, Orientation, type IDockviewPanelProps, type IGridviewPanelProps } from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { TerminalSquareIcon, PlusIcon, CheckIcon } from 'lucide-react';
import { Avatar, AvatarImage, Button, Empty, EmptyHeader, EmptyTitle } from '@ui';
import { Pill } from '../../dictation/renderer';
import { activityItems } from './development';
import { DevelopmentTerminals } from './DevelopmentTerminals';
import { TaskDiff } from './Diff';
import { Artifacts } from './Artifacts';
import { CodeEditor } from '../../editor/renderer';
import { StageTerminalPane, StageTerminalHeader } from './StageTerminalPane';
import { ProfilePane, ProfileHeader } from './ProfilePane';
import { Resources, ResourceIcon, ResourceActions } from './Resources';
import { developmentTheme, dockTheme } from './dock-theme';
import { registerTaskGrid } from './controller';
import { TaskGrid } from './grid';
import { TaskBoundary } from './TaskBoundary';
import { useWindow } from '../lib/store';
import { TaskContext, tasks, useTask, useTaskActive, useTaskGrid, type TaskStore } from './state';
import { profileLaunchers } from './profiles';
import { useStrip } from '../lib/strip';
import { avatarSrc } from '../lib/common';
import { newStageTerminal } from './environments';
import { panelView } from './terminals';
import { termStyle, uiTextSize, useShade } from '../lib/theme';
import './Grid.css';
export { StageMenu } from './StageMenu';

const components = { terminal: DevelopmentContent, resources: Resources };
const tabComponents = { resources: ResourceIcon };
function DevelopmentContent(props: IDockviewPanelProps) {
  const grid = useTaskGrid(), active = useTaskActive(), shade = useShade();
  const [editorShown, setEditorShown] = useState(false), [fontSize] = useState(uiTextSize);
  const item = useTask((s) => s.workbenchItem), diff = useTask((s) => s.developmentDiff);
  const task = useTask((s) => s.key), hasTerminals = useTask((s) => s.developmentTerminals.list.length > 0);
  useEffect(() => { props.api.setTitle(`Main pane: ${activityItems[item]}`); }, [props.api, item]);
  if (item === 'project' && !editorShown) setEditorShown(true);
  return <section aria-label="Main pane" data-workbench-item={item} className="relative h-full min-w-0">
    <DevelopmentTerminals visible={item === 'terminals'} />
    {item === 'diff' && diff && <TaskDiff selection={diff} />}
    {editorShown && <div hidden={item !== 'project'} className="h-full min-h-0"><Suspense fallback={<p role="status">Loading editor…</p>}>
      <CodeEditor session={grid.development.editor} active={active && item === 'project'} shade={shade} fontSize={fontSize} />
    </Suspense></div>}
    {active && item === 'artifacts' && <Artifacts />}
    {item === 'diff' && !diff &&
      <Empty className="h-full"><EmptyHeader><EmptyTitle>
        choose file
      </EmptyTitle></EmptyHeader></Empty>}
    {hasTerminals && <Pill task={task}><CheckIcon className="size-3.5 text-success" /></Pill>}
  </section>;
}
function Development({ api }: IGridviewPanelProps) {
  const grid = useTaskGrid();
  return <div data-development-grid className="h-full">
    <DockviewReact theme={developmentTheme} disableAutoResizing disableFloatingGroups disableDnd components={components}
      tabComponents={tabComponents} rightHeaderActionsComponent={ResourceActions}
      onReady={(e) => grid.mountDevelopment(e.api, api)} />
  </div>;
}
const stageComponents = { profile: ProfilePane, 'stage-terminal': StageTerminalPane };
const stageTabComponents = { profile: ProfileHeader, 'stage-terminal': StageTerminalHeader };
function Stage({ api }: IGridviewPanelProps) {
  const grid = useTaskGrid(), viewport = useRef<HTMLElement>(null);
  return <section ref={viewport} aria-label="Stage" data-testid="stage" data-stage-viewport className="h-full overflow-hidden"
    onPointerDownCapture={grid.stage.pauseStageFollowing} onKeyDownCapture={grid.stage.pauseStageFollowing} onScroll={grid.reportPages}>
    <div className="h-full">
      <DockviewReact theme={dockTheme} disableAutoResizing disableFloatingGroups singleTabMode="fullwidth" components={stageComponents} tabComponents={stageTabComponents}
        onReady={(e) => grid.mountStage(e.api, api, viewport.current!)} />
    </div>
  </section>;
}
const areas = { development: Development, stage: Stage };
function ClosedProfiles() {
  const task = useTask((s) => s.key), closed = useTask((s) => s.closedProfiles), row = useRef<HTMLElement>(null);
  useStrip(row, null);
  return <nav ref={row} data-testid="closed-profiles" aria-label="Open an environment" className="flex flex-none gap-1 border-b bg-card px-2 py-1">
    <Button variant="ghost" size="sm" onClick={() => void newStageTerminal(task)} aria-label="Stage Terminal"><TerminalSquareIcon />Stage Terminal</Button>
    {profileLaunchers(task, closed).map((p) => <Button key={p.id} variant="ghost" size="sm" data-profile={p.id} aria-label={p.name} title={p.title}
      className="max-w-72 flex-none" onClick={() => void p.run()}>
      {p.avatar && <Avatar className="size-5"><AvatarImage src={avatarSrc(p.avatar)} alt="" /></Avatar>}<span className="min-w-0 truncate">{p.name}</span><PlusIcon />
    </Button>)}
  </nav>;
}
const Screen = memo(function Screen() {
  const grid = useTaskGrid(), workspace = useRef<HTMLDivElement>(null);
  const loading = useTask((s) => s.loading);
  const showClosedProfiles = useTask((s) => !s.profiles.length && !s.stageTerminals.length && s.developmentTerminals.list.length > 0);
  useLayoutEffect(() => grid.resize(), [grid, showClosedProfiles]);
  return <section data-task-screen className="absolute inset-0 flex flex-col aria-busy:opacity-0"
    aria-busy={loading || undefined} inert={loading || undefined}>
    {showClosedProfiles && <ClosedProfiles />}
    <div ref={workspace} data-workspace className="min-h-0 flex-1">
      <GridviewReact components={areas} orientation={Orientation.VERTICAL} proportionalLayout
        onReady={(e) => grid.mount(e.api, workspace.current!)} />
    </div>
  </section>;
});
const TaskView = memo(function TaskView({ state, active }: { state: TaskStore; active: boolean }) {
  const [grid] = useState(() => new TaskGrid(state));
  const [loaded, setLoaded] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let mounted = true;
    void grid.load().then((ready) => { if (mounted && ready) setLoaded(true); }, (error: unknown) => { if (mounted) setFailure({ error }); });
    return () => { mounted = false; };
  }, [grid]);
  useLayoutEffect(() => {
    const unregister = registerTaskGrid(grid);
    // The host remains observable while content-visibility skips the grids inside it.
    const resized = new ResizeObserver(grid.resize);
    resized.observe(host.current!.closest('[data-task-view]')!);
    return () => { resized.disconnect(); unregister(); };
  }, [grid]);
  useLayoutEffect(() => { if (active) grid.activate(); }, [grid, active]);
  if (failure) throw failure.error;
  return <div ref={host} className="absolute inset-0">
    <TaskContext value={grid}>{loaded && <Screen />}</TaskContext>
  </div>;
});
export function TaskViews() {
  const retained = useStore(tasks), current = useWindow((s) => s.current), loading = useTask((s) => s.loading);
  const tabs = useWindow((s) => s.projects.tabs);
  const shade = useShade();
  useEffect(() => panelView.restyle(termStyle()), [shade]);
  return <main id="dock" className="relative isolate min-h-0 min-w-0" aria-busy={loading || undefined}>
    {Object.entries(retained).map(([key, state]) => <section key={key} data-task-view={key} data-active={key === current || undefined}
      aria-hidden={key !== current || undefined} inert={key !== current || undefined} className="absolute inset-0">
      <TaskBoundary task={state} failed={!!tabs.find((t) => t.key === key)?.viewFailed}>
        <TaskView state={state} active={key === current} />
      </TaskBoundary>
    </section>)}
  </main>;
}
