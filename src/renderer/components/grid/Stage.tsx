// Testing environments in an independent Dockview instance (docs/window.md, The grid).
import { useEffect, useRef } from 'react';
import { DockviewReact, type DockviewApi, type IGridviewPanelProps } from 'dockview-react';
import { StageTerminalPane, StageTerminalHeader } from './StageTerminalPane';
import { ProfilePane, ProfileHeader } from './ProfilePane';
import { stageMounted, stageUnmounted, scheduleLayout, pauseStageFollowing } from '../../lib/grid';
import { dockTheme } from '../../lib/dock-theme';

const components = { profile: ProfilePane, 'stage-terminal': StageTerminalPane };
const tabComponents = { profile: ProfileHeader, 'stage-terminal': StageTerminalHeader };
export function Stage({ api }: IGridviewPanelProps) {
  const viewport = useRef<HTMLDivElement>(null), mounted = useRef<DockviewApi | null>(null);
  useEffect(() => () => stageUnmounted(mounted.current), []);
  return <section aria-label="Stage" className="h-full min-h-0 min-w-0" data-testid="stage" onPointerDownCapture={pauseStageFollowing} onKeyDownCapture={pauseStageFollowing}>
    <div ref={viewport} data-stage-viewport className="h-full overflow-hidden" onScroll={scheduleLayout}>
      <div className="h-full">
        <DockviewReact theme={dockTheme} disableAutoResizing disableFloatingGroups singleTabMode="fullwidth" components={components} tabComponents={tabComponents}
          onReady={(e) => { mounted.current = e.api; stageMounted(e.api, api, viewport.current!); }} />
      </div>
    </div>
  </section>;
}
