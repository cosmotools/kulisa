// The grid of the shown task (lib/grid.ts; docs/window.md, The grid): dockview's panels, flat, split by hairlines. A
// profile's page is a native view over its pane's content.
import { useContext, type CSSProperties } from 'react';
import { DockviewReact, type DockviewTheme } from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { ProfilePane, ProfileHeader } from './grid/ProfilePane';
import { Terminals, TerminalsHeader } from './grid/Terminals';
import { Resources, ResourcesHeader } from './grid/Resources';
import { gridMounted } from '../lib/grid';
import { useWindow } from '../lib/store';
import { ThemeShown } from './theme';

const components = { profile: ProfilePane, terminal: Terminals, resources: Resources };
const tabComponents = { profile: ProfileHeader, terminal: TerminalsHeader, resources: ResourcesHeader };
const kulisaTheme: DockviewTheme = { name: 'kulisa', className: 'dockview-theme-kulisa', gap: 0, dndOverlayMounting: 'absolute' };

export function Grid() {
  const t = useContext(ThemeShown), loading = useWindow((s) => s.loading);
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
  // #grid: dockview's room (lib/grid.ts, room), under what a task shows over it
  return <main id="dock" aria-busy={loading || undefined} style={{ minWidth: 0, minHeight: 0, opacity: loading ? 0 : 1, display: 'flex', flexDirection: 'column', ...vars }}>
    <div id="grid" style={{ flex: 1, minHeight: 0 }}>
      <DockviewReact theme={kulisaTheme} disableFloatingGroups singleTabMode="fullwidth" components={components}
        tabComponents={tabComponents} onReady={(e) => gridMounted(e.api)} />
    </div>
  </main>;
}
