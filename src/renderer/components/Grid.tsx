// The grid of the shown task (lib/grid.ts; docs/window.md, The grid): dockview's panels, flat, split by hairlines. A
// profile's page is a native view over its pane's content, square as the pane is. While no profile is open and a
// terminal is, the closed profiles' buttons over it.
import { useContext, useEffect, useRef, type CSSProperties } from 'react';
import { DockviewReact, type DockviewTheme } from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { Avatar, Button, makeStaticStyles, makeStyles, tokens } from '@fluentui/react-components';
import { PlusIcon } from 'lucide-react';
import { ProfilePane, ProfileHeader } from './grid/ProfilePane';
import { Terminals, TerminalsHeader } from './grid/Terminals';
import { Resources, ResourcesHeader } from './grid/Resources';
import { gridMounted, gridUnmounted } from '../lib/grid';
import { useWindow } from '../lib/store';
import { profileLaunchers } from '../lib/profiles';
import { useStrip } from '../lib/strip';
import { avatarSrc } from './avatar';
import { ThemeShown } from './theme';

const components = { profile: ProfilePane, terminal: Terminals, resources: Resources };
const tabComponents = { profile: ProfileHeader, terminal: TerminalsHeader, resources: ResourcesHeader };
const kulisaTheme: DockviewTheme = { name: 'kulisa', className: 'dockview-theme-kulisa', gap: 0, dndOverlayMounting: 'absolute' };

// Switching tasks (lib/grid.ts, grid:closing): the grid slides towards the next task's tab, as macOS desktops do (types
// next and previous say which way). Pictures, so the compositor moves them. Longhands: Vite's CSS minifier (Lightning
// CSS) makes the shorthand with no name `animation: none`, and nothing slides. Material's standard easing: an ease-out
// creeps over its last few percent, the grid going out lingering at the window's edge. Until the grid is laid out
// (aria-busy: lib/grid.ts, reveal) it is not shown; then it fades in, unless it comes sliding.
const useSlide = makeStaticStyles(`
#dock { view-transition-name: grid; transition: opacity .15s; }
#dock[aria-busy] { opacity: 0; transition: none; }
:active-view-transition #dock { transition: none; }
::view-transition-old(grid), ::view-transition-new(grid) {
  animation-duration: .3s; animation-timing-function: cubic-bezier(.4, 0, .2, 1); animation-fill-mode: both; mix-blend-mode: normal; }
:active-view-transition-type(next)::view-transition-old(grid) { animation-name: grid-to-left; }
:active-view-transition-type(next)::view-transition-new(grid) { animation-name: grid-from-right; }
:active-view-transition-type(previous)::view-transition-old(grid) { animation-name: grid-to-right; }
:active-view-transition-type(previous)::view-transition-new(grid) { animation-name: grid-from-left; }
@keyframes grid-to-left { to { translate: -100% 0; } }
@keyframes grid-from-right { from { translate: 100% 0; } }
@keyframes grid-to-right { to { translate: 100% 0; } }
@keyframes grid-from-left { from { translate: -100% 0; } }
`);

const useStyles = makeStyles({
  // min-width: a row wider than the window (many closed profiles) would stretch the window's column, the terminal and
  // the tasks' bar past its edge.
  dock: { minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column',
    // A pane narrower than its header: dockview's tab shrinks with it (else it runs past the pane, its × out of sight
    // and dockview's list of hidden tabs shown for it).
    '& .dv-tab': { minWidth: 0, flexShrink: 1 } },
  grid: { flex: 1, minHeight: 0 },
  closed: { display: 'flex', gap: '4px', flex: 'none', padding: '4px 8px', background: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  opener: { flex: 'none', maxWidth: '18em' },
  name: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
});

// The profiles' room folded to a row of buttons that open them, where the first one opens (above the terminal). With
// no terminal either, they are the launchers' second row (grid/Terminals.tsx). More than fit scroll, as a strip of tabs.
function ClosedProfiles() {
  const closed = useWindow((s) => s.closedProfiles), styles = useStyles(), row = useRef<HTMLElement>(null);
  const stripClass = useStrip(row, null); // no button is the active one
  return <nav ref={row} id="closedprofiles" data-testid="closed-profiles" className={`${styles.closed} ${stripClass}`} aria-label="Open a profile">
    {profileLaunchers(closed).map((p) => <Button key={p.id} className={styles.opener} appearance="subtle" data-profile={p.id} aria-label={p.name}
      title={p.title} icon={p.avatar ? <Avatar size={20} image={{ src: avatarSrc(p.avatar) }} /> : undefined} onClick={() => void p.run()}>
      <span className={styles.name}>{p.name}</span><PlusIcon style={{ marginInlineStart: 4 }} />
    </Button>)}
  </nav>;
}

export function Grid() {
  useSlide();
  useEffect(() => gridUnmounted, []);
  const t = useContext(ThemeShown), styles = useStyles(), loading = useWindow((s) => s.loading);
  const folded = useWindow((s) => !!s.current && !s.profiles.length && s.terminals.list.length > 0);
  const vars = {
    '--dv-group-view-background-color': t.colorNeutralBackground1, '--dv-tabs-and-actions-container-background-color': t.colorNeutralBackground1,
    '--dv-tabs-and-actions-container-height': '36px', '--dv-tab-font-size': t.fontSizeBase300,
    '--dv-activegroup-visiblepanel-tab-background-color': 'transparent', '--dv-inactivegroup-visiblepanel-tab-background-color': 'transparent',
    '--dv-activegroup-hiddenpanel-tab-background-color': 'transparent', '--dv-inactivegroup-hiddenpanel-tab-background-color': 'transparent',
    '--dv-activegroup-visiblepanel-tab-color': t.colorNeutralForeground1, '--dv-inactivegroup-visiblepanel-tab-color': t.colorNeutralForeground2,
    '--dv-activegroup-hiddenpanel-tab-color': t.colorNeutralForeground3, '--dv-inactivegroup-hiddenpanel-tab-color': t.colorNeutralForeground3,
    '--dv-separator-border': t.colorNeutralStroke2, '--dv-paneview-header-border-color': t.colorNeutralStroke2,
    '--dv-tab-divider-color': 'transparent', '--dv-active-sash-color': t.colorNeutralStroke1,
    '--dv-drag-over-background-color': t.colorSubtleBackgroundHover, '--dv-drag-over-border-color': t.colorNeutralStroke1,
  } as CSSProperties;
  // #grid: dockview's room (lib/grid.ts, room), under the closed profiles' row
  return <main id="dock" className={styles.dock} aria-busy={loading || undefined} style={vars}>
    {folded && <ClosedProfiles />}
    <div id="grid" className={styles.grid}>
      <DockviewReact theme={kulisaTheme} disableFloatingGroups singleTabMode="fullwidth" components={components}
        tabComponents={tabComponents} onReady={(e) => gridMounted(e.api)} />
    </div>
  </main>;
}
