// A tasks' window (docs/window.md): the title bar, the shown task's grid or the empty window, the tasks' bar, Settings
// over them, and the dialogs, in Fluent UI's theme as the main process says (☰ → Theme; System: the OS's).
import { lazy, Suspense, useSyncExternalStore } from 'react';
import { AriaLiveAnnouncer, FluentProvider, makeStyles, tokens } from '@fluentui/react-components';
import { dark, light, shade, ThemeShown } from './theme';
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

// The layout in a div of its own, not FluentProvider's className: Fluent copies that to every portal's node (a menu's,
// a tooltip's), which would then cover the window.
const useStyles = makeStyles({
  root: { height: '100vh', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', background: tokens.colorNeutralBackground2,
    // Under Settings the grid stays laid out (dockview's sizes, the terminals) and its agents work on, the tasks' bar
    // keeping its place: a row resized as Settings closes moved the terminal. In its row (Settings' row too:
    // auto-placed, it would go below it).
    '& > :is(#dock, #empty)': { gridArea: '2 / 1' }, '& > #taskbar': { gridArea: '3 / 1' },
    '&[data-settings] :is(#dock, #empty, #taskbar)': { visibility: 'hidden' } },
  settings: { gridArea: '2 / 1 / -1' },
});

export function App() {
  const styles = useStyles();
  useOsDark(); // System follows the OS
  const chosen = useWindow((s) => s.theme), theme = shade(chosen) === 'dark' ? dark : light;
  const bar = useWindow((s) => s.bar), open = useWindow((s) => s.current !== null), settings = useSettings();
  return <FluentProvider theme={theme} style={{ colorScheme: chosen === 'system' ? 'light dark' : shade(chosen) }}>
    <AriaLiveAnnouncer><ThemeShown.Provider value={theme}><div className={styles.root} data-settings={settings ? '' : undefined}>
      {/* The tasks' bar in the title bar, as a browser's tabs, or under the grid (☰ → Tasks bar); none with no task open */}
      <TopBar>{bar === 'top' && open && <TaskBar />}</TopBar>
      {open ? <Grid /> : <Empty />}
      {open && <Sidebar />}
      {bar !== 'top' && open ? <TaskBar /> : !settings && <div />}
      {settings && <Suspense><Settings at={settings} className={styles.settings} /></Suspense>}
      <NewProject />
      <TaskRename />
      <AgentPicker />
      <HandOver />
      <Shortcuts />
      <Ask />
      <Thumbnail />
      <PointMenu />
    </div></ThemeShown.Provider></AriaLiveAnnouncer>
  </FluentProvider>;
}
