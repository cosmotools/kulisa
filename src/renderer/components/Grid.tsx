// The grid of the shown task (lib/grid.ts; docs/window.md, The grid): dockview's panels, flat, split by a gap. A
// profile's page is a native view over its pane's content, square as the pane is. While no profile is open and a
// terminal is, the closed profiles' buttons over it.
import { useEffect, useRef } from 'react';
import { DockviewReact, type DockviewTheme } from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { PlusIcon } from 'lucide-react';
import { Button } from '@ui';
import { ProfilePane, ProfileHeader } from './grid/ProfilePane';
import { Terminals, TerminalsHeader } from './grid/Terminals';
import { Resources, ResourcesHeader } from './grid/Resources';
import { gridMounted, gridUnmounted } from '../lib/grid';
import { useWindow } from '../lib/store';
import { profileLaunchers } from '../lib/profiles';
import { useStrip } from '../lib/strip';
import { avatarSrc } from '../lib/common';
import './Grid.css';

const components = { profile: ProfilePane, terminal: Terminals, resources: Resources };
const tabComponents = { profile: ProfileHeader, terminal: TerminalsHeader, resources: ResourcesHeader };
const kulisaTheme: DockviewTheme = { name: 'kulisa', className: 'dockview-theme-kulisa', gap: 6, dndOverlayMounting: 'absolute' };

// The profiles' room folded to a row of buttons that open them, where the first one opens (above the terminal). With
// no terminal either, they are the launchers' second row (grid/Terminals.tsx). More than fit scroll, as a strip of tabs.
function ClosedProfiles() {
  const closed = useWindow((s) => s.closedProfiles), row = useRef<HTMLElement>(null);
  useStrip(row, null); // no button is the active one
  return <nav ref={row} id="closedprofiles" data-testid="closed-profiles" aria-label="Open a profile" className="flex flex-none gap-1 border-b bg-card px-2 py-1">
    {profileLaunchers(closed).map((p) => <Button key={p.id} variant="ghost" size="sm" data-profile={p.id} aria-label={p.name} title={p.title}
      className="max-w-72 flex-none" onClick={() => void p.run()}>
      {p.avatar && <img src={avatarSrc(p.avatar)} alt="" className="size-5" />}<span className="min-w-0 truncate">{p.name}</span><PlusIcon />
    </Button>)}
  </nav>;
}

export function Grid() {
  useEffect(() => gridUnmounted, []);
  const loading = useWindow((s) => s.loading);
  const folded = useWindow((s) => !!s.current && !s.profiles.length && s.terminals.list.length > 0);
  // #grid: dockview's room (lib/grid.ts, room), under the closed profiles' row
  // min-w-0: a row wider than the window (many closed profiles) would stretch the window's column, the terminal and the
  // tasks' bar past its edge.
  return <main id="dock" className="flex min-h-0 min-w-0 flex-col" aria-busy={loading || undefined}>
    {folded && <ClosedProfiles />}
    <div id="grid" className="min-h-0 flex-1">
      <DockviewReact theme={kulisaTheme} disableFloatingGroups singleTabMode="fullwidth" components={components}
        tabComponents={tabComponents} onReady={(e) => gridMounted(e.api)} />
    </div>
  </main>;
}
