// Testing environments in an independent Dockview instance (docs/window.md, The grid).
import { useEffect, useRef, useState } from 'react';
import { DockviewReact, type DockviewApi } from 'dockview-react';
import { LayoutDashboardIcon, PanelsTopLeftIcon, PlusIcon, Rows3Icon, Columns3Icon } from 'lucide-react';
import { Button, DropdownMenuCheckboxItem } from '@ui';
import { ApplicationPane, ApplicationHeader } from './ApplicationPane';
import { ProfilePane, ProfileHeader } from './ProfilePane';
import { ButtonMenu, RightClickMenu } from '../Menus';
import { stageMounted, stageUnmounted, scheduleLayout } from '../../lib/grid';
import { environmentItems } from '../../lib/environments';
import { act, useWindow } from '../../lib/store';
import type { MenuItem } from '../../lib/menu';
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
const arrangements = (): MenuItem[] => [
  { label: 'Horizontal stack', icon: Columns3Icon, run: () => act('stage:arrange', { layout: 'horizontal' }) },
  { label: 'Vertical stack', icon: Rows3Icon, run: () => act('stage:arrange', { layout: 'vertical' }) },
  { label: 'Tabs', icon: PanelsTopLeftIcon, run: () => act('stage:arrange', { layout: 'tabs' }) },
  { component: Overflow },
];
function Overflow() {
  const mode = useWindow((s) => s.stageLayout), checked = useWindow((s) => s.stageOverflow);
  return mode === 'tabs' ? null : <DropdownMenuCheckboxItem checked={checked} onCheckedChange={(value) => void act('stage:arrange', { overflow: value })}
    onSelect={(e) => e.preventDefault()}>Allow overflow</DropdownMenuCheckboxItem>;
}
export function StageHeader() {
  return <RightClickMenu items={() => [{ heading: 'Arrange stage' }, ...arrangements(), '-', { submenu: 'Open an environment', items: environmentItems() }]} className="h-full">
  <div data-panel="stage" className="flex h-full min-w-0 items-center gap-1 px-2">
    <span className="flex-1 text-sm font-medium">Stage</span>
    <ButtonMenu items={arrangements} end><Button variant="ghost" size="icon-xs" aria-label="Arrange stage" title="Arrange stage"><LayoutDashboardIcon /></Button></ButtonMenu>
    <ButtonMenu items={environmentItems} end><Button variant="ghost" size="icon-xs" aria-label="Open an environment" title="Open an environment"><PlusIcon /></Button></ButtonMenu>
  </div>
  </RightClickMenu>;
}
