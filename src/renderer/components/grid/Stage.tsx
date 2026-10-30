// Testing environments in an independent Dockview instance (docs/window.md, The grid).
import { useEffect, useRef, useState } from 'react';
import { DockviewReact, type DockviewApi } from 'dockview-react';
import { LayoutDashboardIcon, PanelsTopLeftIcon, PlusIcon, Rows3Icon, Columns3Icon } from 'lucide-react';
import { Button } from '@ui';
import { ApplicationPane, ApplicationHeader } from './ApplicationPane';
import { ProfilePane, ProfileHeader } from './ProfilePane';
import { ButtonMenu, RightClickMenu } from '../Menus';
import { stageMounted, stageUnmounted, scheduleLayout } from '../../lib/grid';
import { environmentItems } from '../../lib/environments';
import { act, useWindow } from '../../lib/store';
import type { MenuItem } from '../../lib/menu';
import { dockTheme } from '../../lib/dock-theme';

const components = { profile: ProfilePane, application: ApplicationPane };

const tabComponents = { profile: ProfileHeader, application: ApplicationHeader };
export function Stage() {
  const mode = useWindow((s) => s.stageLayout), count = useWindow((s) => s.profiles.length + s.applications.length);
  const viewport = useRef<HTMLDivElement>(null), [width, setWidth] = useState(0);
  useEffect(() => {
    const el = viewport.current!;
    const resize = new ResizeObserver(() => setWidth(el.clientWidth));
    resize.observe(el); return () => resize.disconnect();
  }, []);
  const mounted = useRef<DockviewApi | null>(null);
  useEffect(() => () => stageUnmounted(mounted.current), []);
  return <section aria-label="Stage" className="h-full min-h-0 min-w-0" data-testid="stage">
    <div ref={viewport} data-stage-viewport className="h-full overflow-x-auto overflow-y-hidden" onScroll={scheduleLayout}>
      <div className="h-full" style={{ width: mode === 'row' ? Math.max(width, count * 600 + Math.max(0, count - 1) * (dockTheme.gap ?? 0)) : '100%' }}>
        <DockviewReact theme={dockTheme} disableFloatingGroups singleTabMode="fullwidth" components={components} tabComponents={tabComponents}
          onReady={({ api }) => { mounted.current = api; stageMounted(api); }} />
      </div>
    </div>
  </section>;
}
const arrangements = (): MenuItem[] => [
  { label: 'Column', icon: Rows3Icon, run: () => act('stage:arrange', { layout: 'column' }) },
  { label: 'Tabs', icon: PanelsTopLeftIcon, run: () => act('stage:arrange', { layout: 'tabs' }) },
  { label: 'Row', icon: Columns3Icon, run: () => act('stage:arrange', { layout: 'row' }) },
];
export function StageHeader() {
  return <RightClickMenu items={() => [{ heading: 'Arrange stage' }, ...arrangements(), '-', { submenu: 'Open an environment', items: environmentItems() }]} className="h-full">
  <div data-panel="stage" className="flex h-full min-w-0 items-center gap-1 px-2">
    <span className="flex-1 text-sm font-medium">Stage</span>
    <ButtonMenu items={arrangements} end><Button variant="ghost" size="icon-xs" aria-label="Arrange stage" title="Arrange stage"><LayoutDashboardIcon /></Button></ButtonMenu>
    <ButtonMenu items={environmentItems} end><Button variant="ghost" size="icon-xs" aria-label="Open an environment" title="Open an environment"><PlusIcon /></Button></ButtonMenu>
  </div>
  </RightClickMenu>;
}
