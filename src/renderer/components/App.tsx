// A tasks' window (docs/window.md): the title bar, the shown task's grid or the empty window, the tasks' bar, Settings
// over them, and the dialogs. Its theme: lib/theme.ts.
import { useEffect, useState } from 'react';
import { TooltipProvider } from '@ui';
import { useWindow } from '../lib/store';
import { TopBar } from './TopBar';
import { Grid } from './Grid';
import { Empty } from './Empty';
import { Sidebar } from './Sidebar';
import { TaskBar } from './TaskBar';
import { Ask } from './Ask';
import { NewProject } from './NewProject';
import { AgentPicker } from './AgentPicker';
import { StageTerminalSettings } from './StageTerminalSettings';
import { TaskRename } from './TaskRename';
import { Shortcuts } from './Shortcuts';
import { PointMenu } from './Menus';
import { HandOver } from './HandOver';
import { Thumbnail, thumbnailMenu } from '../../screenshots/renderer';
import { menuAtPoint } from '../lib/menu';
import { useSettings } from '../lib/settings';

// Its own chunk, read as it is first asked for: a window that never shows it never parses it (a module stays once
// loaded). Not lazy(): React holds a Suspense fallback at least 300 ms, the chunk takes a few.
type SettingsView = typeof import('./settings').default;

thumbnailMenu(menuAtPoint);

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
    <div className="grid h-screen grid-rows-[auto_minmax(0,1fr)_auto] bg-background text-sm text-foreground
      [&:has(>#settings)>:is(#dock,#empty,#taskbar)]:invisible [&:has(>#settings)>:is(#dock,#empty,#taskbar)_*]:invisible! [&:has(>#settings)>:is(#dock,#empty,#taskbar)_*]:transition-none! [&>:is(#dock,#empty)]:[grid-area:2/1] [&>#taskbar]:[grid-area:3/1]">
      {/* The tasks' bar in the title bar, as a browser's tabs, or under the grid (☰ → Tasks bar); none with no task open */}
      <TopBar>{bar === 'top' && open && <TaskBar />}</TopBar>
      {open ? <Grid /> : <Empty />}
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
      <Thumbnail />
      <PointMenu />
    </div>
  </TooltipProvider>;
}
