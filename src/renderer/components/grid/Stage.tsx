// Testing environments in an independent Dockview instance (docs/window.md, The grid).
import { useEffect, useRef, useState } from 'react';
import { DockviewReact, type DockviewApi } from 'dockview-react';
import { ApplicationPane, ApplicationHeader } from './ApplicationPane';
import { ProfilePane, ProfileHeader } from './ProfilePane';
import { stageMounted, stageUnmounted, scheduleLayout } from '../../lib/grid';
import { useWindow } from '../../lib/store';
import { environmentMinimum } from '../../lib/stage-layout';
import { dockTheme } from '../../lib/dock-theme';

const components = { profile: ProfilePane, application: ApplicationPane };
const tabComponents = { profile: ProfileHeader, application: ApplicationHeader };
export function Stage() {
  const mode = useWindow((s) => s.stageLayout), overflow = useWindow((s) => s.stageOverflow), count = useWindow((s) => s.profiles.length + s.applications.length);
  const viewport = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = viewport.current!;
    const resize = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    resize.observe(el); return () => resize.disconnect();
  }, []);
  const mounted = useRef<DockviewApi | null>(null);
  useEffect(() => () => stageUnmounted(mounted.current), []);
  return <section aria-label="Stage" className="h-full min-h-0 min-w-0" data-testid="stage">
    <div ref={viewport} data-stage-viewport className={`h-full ${overflow && mode !== 'tabs' ? mode === 'vertical' ? 'overflow-x-hidden overflow-y-auto' : 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden'}`} onScroll={scheduleLayout}>
      <div className="h-full" style={{ width: overflow && mode !== 'tabs' && mode !== 'vertical' ? Math.max(size.width, count * environmentMinimum.width + Math.max(0, count - 1) * (dockTheme.gap ?? 0)) : '100%',
        height: overflow && mode === 'vertical' ? Math.max(size.height, count * environmentMinimum.height + Math.max(0, count - 1) * (dockTheme.gap ?? 0)) : '100%' }}>
        <DockviewReact theme={dockTheme} disableFloatingGroups singleTabMode="fullwidth" components={components} tabComponents={tabComponents}
          onReady={({ api }) => { mounted.current = api; stageMounted(api); }} />
      </div>
    </div>
  </section>;
}
