// Testing environments in the task's retained Stage grid (docs/window.md, The grid).
import { useRef } from 'react';
import { DockviewReact, type IGridviewPanelProps } from 'dockview-react';
import { StageTerminalPane, StageTerminalHeader } from './StageTerminalPane';
import { ProfilePane, ProfileHeader } from './ProfilePane';
import { useTaskGrid } from './context';
import { dockTheme } from '../../lib/dock-theme';
const components = { profile: ProfilePane, 'stage-terminal': StageTerminalPane };
const tabComponents = { profile: ProfileHeader, 'stage-terminal': StageTerminalHeader };
export function Stage({ api }: IGridviewPanelProps) {
  const grid = useTaskGrid(), viewport = useRef<HTMLDivElement>(null);
  return <section aria-label="Stage" className="h-full min-h-0 min-w-0" data-testid="stage"
    onPointerDownCapture={grid.stage.pauseStageFollowing} onKeyDownCapture={grid.stage.pauseStageFollowing}>
    <div ref={viewport} data-stage-viewport className="h-full overflow-hidden" onScroll={grid.scheduleLayout}>
      <div className="h-full">
        <DockviewReact theme={dockTheme} disableAutoResizing disableFloatingGroups singleTabMode="fullwidth" components={components} tabComponents={tabComponents}
          onReady={(e) => grid.mountStage(e.api, api, viewport.current!)} />
      </div>
    </div>
  </section>;
}
