// The grid of the shown task (lib/grid.ts; docs/window.md, The grid): dockview's panels, flat, split by hairlines. A
// profile's page is a native view over its pane's content, square as the pane is. While no profile is open and a
// terminal is, the closed profiles' buttons over it.
import { useEffect, useRef } from 'react';
import { DockviewReact, type DockviewTheme } from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { Avatar, Button, Divider, Text } from '@fluentui/react-components';
import { AddRegular } from '@fluentui/react-icons';
import { ProfilePane, ProfileHeader } from './grid/ProfilePane';
import { Terminals, TerminalsHeader } from './grid/Terminals';
import { Resources, ResourcesHeader } from './grid/Resources';
import { gridMounted, gridUnmounted } from '../lib/grid';
import { useWindow } from '../lib/store';
import { profileLaunchers } from '../lib/profiles';
import { useStrip } from '../lib/strip';
import { avatarSrc } from '../lib/common';
import './Grid.css';
import css from './Grid.module.css';

const components = { profile: ProfilePane, terminal: Terminals, resources: Resources };
const tabComponents = { profile: ProfileHeader, terminal: TerminalsHeader, resources: ResourcesHeader };
const kulisaTheme: DockviewTheme = { name: 'kulisa', className: 'dockview-theme-kulisa', gap: 6, dndOverlayMounting: 'absolute' };

// The profiles' room folded to a row of buttons that open them, where the first one opens (above the terminal). With
// no terminal either, they are the launchers' second row (grid/Terminals.tsx). More than fit scroll, as a strip of tabs.
function ClosedProfiles() {
  const closed = useWindow((s) => s.closedProfiles), row = useRef<HTMLElement>(null);
  useStrip(row, null); // no button is the active one
  return <><nav ref={row} id="closedprofiles" data-testid="closed-profiles" className={css.closed} aria-label="Open a profile">
    {profileLaunchers(closed).map((p) => <Button key={p.id} appearance="subtle" data-profile={p.id} aria-label={p.name}
      title={p.title} icon={p.avatar ? <Avatar size={20} image={{ src: avatarSrc(p.avatar) }} /> : undefined} onClick={() => void p.run()}>
      <span className={css.name}><Text truncate wrap={false} block>{p.name}</Text></span><AddRegular className={css.open} />
    </Button>)}
  </nav><div className={css.line}><Divider /></div></>;
}

export function Grid() {
  useEffect(() => gridUnmounted, []);
  const loading = useWindow((s) => s.loading);
  const folded = useWindow((s) => !!s.current && !s.profiles.length && s.terminals.list.length > 0);
  // #grid: dockview's room (lib/grid.ts, room), under the closed profiles' row
  return <main id="dock" className={css.dock} aria-busy={loading || undefined}>
    {folded && <ClosedProfiles />}
    <div id="grid" className={css.grid}>
      <DockviewReact theme={kulisaTheme} disableFloatingGroups singleTabMode="fullwidth" components={components}
        tabComponents={tabComponents} onReady={(e) => gridMounted(e.api)} />
    </div>
  </main>;
}
