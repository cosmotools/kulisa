// The task workspace: development terminals, Resources and a nested testing stage (docs/window.md, The grid).
import { useEffect, useRef } from 'react';
import { DockviewReact, GridviewReact, Orientation } from 'dockview-react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { TerminalSquareIcon, PlusIcon } from 'lucide-react';
import { Avatar, AvatarImage, Button } from '@ui';
import { Stage } from './grid/Stage';
import { dockTheme } from '../lib/dock-theme';
import { DevelopmentTerminals } from './grid/DevelopmentTerminals';
import { Resources } from './grid/Resources';
import { gridMounted, gridUnmounted, workspaceMounted } from '../lib/grid';
import { useWindow } from '../lib/store';
import { profileLaunchers } from '../lib/profiles';
import { useStrip } from '../lib/strip';
import { avatarSrc } from '../lib/common';
import { newStageTerminal } from '../lib/environments';
import './Grid.css';

const components = { terminal: DevelopmentTerminals, resources: Resources };
const tabComponents = { terminal: DevelopmentPanelHeader, resources: DevelopmentPanelHeader };

function DevelopmentPanelHeader({ api }: IDockviewPanelHeaderProps) {
  return <div data-panel={api.id} className="flex h-full min-w-0 items-center px-2"><span className="min-w-0 truncate">{api.title}</span></div>;
}

function Development() {
  return <div id="grid" className="h-full min-h-0 min-w-0">
    <DockviewReact theme={dockTheme} disableFloatingGroups singleTabMode="fullwidth" components={components}
      tabComponents={tabComponents} onReady={(e) => gridMounted(e.api)} />
  </div>;
}
const areas = { development: Development, stage: Stage };

// Closed profiles stay reachable while a running terminal occupies the empty workspace.
function ClosedProfiles() {
  const closed = useWindow((s) => s.closedProfiles), row = useRef<HTMLElement>(null);
  useStrip(row, null); // no button is the active one
  return <nav ref={row} id="closedprofiles" data-testid="closed-profiles" aria-label="Open an environment" className="flex flex-none gap-1 border-b bg-card px-2 py-1">
    <Button variant="ghost" size="sm" onClick={() => void newStageTerminal()} aria-label="Stage Terminal"><TerminalSquareIcon />Stage Terminal</Button>
    {profileLaunchers(closed).map((p) => <Button key={p.id} variant="ghost" size="sm" data-profile={p.id} aria-label={p.name} title={p.title}
      className="max-w-72 flex-none" onClick={() => void p.run()}>
      {p.avatar && <Avatar className="size-5"><AvatarImage src={avatarSrc(p.avatar)} alt="" /></Avatar>}<span className="min-w-0 truncate">{p.name}</span><PlusIcon />
    </Button>)}
  </nav>;
}

export function Grid() {
  useEffect(() => gridUnmounted, []);
  const loading = useWindow((s) => s.loading);
  const folded = useWindow((s) => !!s.current && !s.profiles.length && !s.stageTerminals.length && s.developmentTerminals.list.length > 0);
  // min-w-0: a row wider than the window (many closed profiles) would stretch the window's column, the terminal and the
  // tasks' bar past its edge. Not shown until it is laid out (lib/grid.ts, reveal).
  return <main id="dock" className="isolate flex min-h-0 min-w-0 flex-col aria-busy:opacity-0" aria-busy={loading || undefined}>
    {folded && <ClosedProfiles />}
    <div id="workspace" className="min-h-0 flex-1">
      <GridviewReact components={areas} orientation={Orientation.VERTICAL} proportionalLayout
        onReady={(e) => workspaceMounted(e.api)} />
    </div>
  </main>;
}
