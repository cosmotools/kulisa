// A tasks' window (docs/window.md): the title bar, the shown task's grid or the empty window, the tasks' bar, Settings
// over them, and the dialogs. Its theme: lib/theme.ts.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TooltipProvider } from '@ui';
import { useWindow } from '../lib/store';
import { TopBar } from './TopBar';
import { Button, Empty as EmptyState, EmptyDescription, EmptyHeader, EmptyTitle } from '@ui';
import { Empty } from './Empty';
import { Sidebar } from './Sidebar';
import { TaskBar } from './TaskBar';
import { Ask } from './Ask';
import { NewProject } from './new-project';
import { AgentPicker } from './AgentPicker';
import { StageTerminalSettings } from './StageTerminalSettings';
import { TaskRename } from './TaskRename';
import { Shortcuts } from './Shortcuts';
import { PointMenu } from './Menus';
import { HandOver } from './HandOver';
import { useSettings } from '../lib/settings';

// Its own chunk, read as it is first asked for: a window that never shows it never parses it (a module stays once
// loaded). Not lazy(): React holds a Suspense fallback at least 300 ms, the chunk takes a few.
type SettingsView = typeof import('./settings').default;


function Workspace() {
  const host = useRef<HTMLElement>(null), summary = useWindow((s) => s.summary);
  const current = useWindow((s) => s.current), bar = useWindow((s) => s.bar), zoom = useWindow((s) => s.zoom);
  useLayoutEffect(() => {
    const report = () => { const r = host.current!.getBoundingClientRect(); kulisa.send('shell:workspace', { task: current, x: r.x, y: r.y, width: r.width, height: r.height, viewport: { width: innerWidth, height: innerHeight } }); };
    const observer = new ResizeObserver(report); observer.observe(host.current!); report();
    return () => observer.disconnect();
  }, [current, bar, zoom]);
  return <main ref={host} id="workspace" className="relative min-h-0 min-w-0">
    {summary?.failure && <div className="h-full bg-background"><EmptyState role="alert" className="h-full"><EmptyHeader>
      <EmptyTitle>This task’s screen could not be displayed</EmptyTitle>
      <EmptyDescription>The task stays open. Terminal replies may be unavailable until its screen recovers. Reloading preserves received edits and running processes; terminal screens start with new output.</EmptyDescription>
    </EmptyHeader><Button onClick={() => kulisa.invoke('task:reload', summary.key)}>Reload task screen</Button></EmptyState></div>}
  </main>;
}
export function App() {
  const bar = useWindow((s) => s.bar), open = useWindow((s) => s.current !== null), settings = useSettings();
  const [Settings, setSettings] = useState<SettingsView | null>(null);
  useEffect(() => { if (settings && !Settings) void import('./settings').then((m) => setSettings(() => m.default)); }, [settings, Settings]);
  // Rows: the title bar, the grid (or the empty window), the tasks' bar. Under Settings the grid stays laid out
  // (dockview's sizes, the terminals) and its agents work on, the tasks' bar keeping its place: a row resized as
  // Settings closes moved the terminal. Hidden once Settings is drawn (it draws nothing until filled), not as it is
  // asked for. Hidden to the last element (dockview makes parts of its own visible again inside a hidden box), at
  // once (a transition of all of a button's properties would keep it visible meanwhile).
  return <TooltipProvider>
    <div className="grid h-screen grid-rows-[auto_minmax(0,1fr)_auto] text-sm text-foreground
      [&:has(>#settings)>:is(#workspace,#empty,#taskbar)]:invisible [&:has(>#settings)>:is(#workspace,#empty,#taskbar)_*]:invisible! [&:has(>#settings)>:is(#workspace,#empty,#taskbar)_*]:transition-none! [&>:is(#workspace,#empty)]:[grid-area:2/1] [&>#taskbar]:[grid-area:3/1]">
      {/* The tasks' bar in the title bar, as a browser's tabs, or under the grid (☰ → Tasks bar); none with no task open */}
      <TopBar>{bar === 'top' && open && <TaskBar />}</TopBar>
      {open ? <Workspace /> : <Empty />}
      {open && <Sidebar />}
      {bar !== 'top' && open && <TaskBar />}
      {settings && Settings && <Settings at={settings} className="[grid-area:2/1/-1]" />}
      <NewProject />
      <TaskRename />
      <StageTerminalSettings />
      <AgentPicker />
      <HandOver />
      <Shortcuts />
      <Ask />
      <PointMenu />
    </div>
  </TooltipProvider>;
}
