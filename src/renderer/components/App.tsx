// A tasks' window (docs/window.md): the title bar, the shown task's grid or the empty window, the tasks' bar, Settings
// over them, and the dialogs, in Fluent UI's theme as the main process says (☰ → Theme; System: the OS's).
import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import { AriaLiveAnnouncer, FluentProvider } from '@fluentui/react-components';
import { dark, light } from './theme';
import { shade } from '../lib/theme';
import { useWindow } from '../lib/store';
import { TopBar } from './TopBar';
import { Grid } from './Grid';
import { Empty } from './Empty';
import { Sidebar } from './Sidebar';
import { TaskBar } from './TaskBar';
import { Ask } from './Ask';
import { NewProject } from './NewProject';
import { AgentPicker } from './AgentPicker';
import { TaskRename } from './TaskRename';
import { Shortcuts } from './Shortcuts';
import { PointMenu } from './PointMenu';
import { HandOver } from './HandOver';
import { Thumbnail, thumbnailMenu } from '../../screenshots/renderer';
import { menuAtPoint } from '../lib/menu';
import { useSettings } from '../lib/settings';
import css from './App.module.css';

// Its own chunk, read as it is first shown: a window that never shows it never parses it (a module stays once loaded).
const Settings = lazy(() => import('./settings'));

thumbnailMenu(menuAtPoint);

const osDark = matchMedia('(prefers-color-scheme: dark)');
const useOsDark = () => useSyncExternalStore((l) => { osDark.addEventListener('change', l); return () => osDark.removeEventListener('change', l); }, () => osDark.matches);

// The window never scrolls, also not from a script (scrollIntoView): the page clips what reaches past it, such as a
// panel kept behind another (dockview keeps it laid out below the grid). As a desktop app, labels and buttons are not
// text to select; fields are; the arrow over buttons, tabs and menus' rows, as in Chrome, not a web page's hand
// (Fluent's own: !important over its classes).
document.head.insertAdjacentHTML('beforeend', `<style>html, body, #app { height: 100%; margin: 0; overflow: clip; }
body { user-select: none; cursor: default; } input, textarea { user-select: text; }
button, [role="tab"], [role^="menuitem"] { cursor: default !important; }</style>`);

export function App() {
  useOsDark(); // System follows the OS
  const chosen = useWindow((s) => s.theme), theme = shade(chosen) === 'dark' ? dark : light;
  // The page's own color scheme (scrollbars, the native controls), on the root: Fluent's portals are outside the provider.
  useEffect(() => { document.documentElement.style.colorScheme = chosen === 'system' ? 'light dark' : shade(chosen); }, [chosen]);
  const bar = useWindow((s) => s.bar), open = useWindow((s) => s.current !== null), settings = useSettings();
  return <FluentProvider theme={theme}>
    <AriaLiveAnnouncer><div className={css.root}>
      {/* The tasks' bar in the title bar, as a browser's tabs, or under the grid (☰ → Tasks bar); none with no task open */}
      <TopBar>{bar === 'top' && open && <TaskBar />}</TopBar>
      {open ? <Grid /> : <Empty />}
      {open && <Sidebar />}
      {bar !== 'top' && open ? <TaskBar /> : !settings && <div />}
      {settings && <Suspense><Settings at={settings} className={css.settings} /></Suspense>}
      <NewProject />
      <TaskRename />
      <AgentPicker />
      <HandOver />
      <Shortcuts />
      <Ask />
      <Thumbnail />
      <PointMenu />
    </div></AriaLiveAnnouncer>
  </FluentProvider>;
}
