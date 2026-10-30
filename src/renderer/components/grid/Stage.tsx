// Testing environments in an independent Dockview instance (docs/window.md, The grid).
import { useEffect, useRef } from 'react';
import { DockviewReact, type DockviewApi } from 'dockview-react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@ui';
import { ProfilePane, ProfileHeader } from './ProfilePane';
import { ApplicationPane, ApplicationHeader } from './ApplicationPane';
import { ButtonMenu } from '../Menus';
import { stageMounted, stageUnmounted } from '../../lib/grid';
import { environmentItems } from '../../lib/environments';
import { dockTheme } from '../../lib/dock-theme';

const components = { profile: ProfilePane, application: ApplicationPane };
const tabComponents = { profile: ProfileHeader, application: ApplicationHeader };
export function Stage() {
  const mounted = useRef<DockviewApi | null>(null);
  useEffect(() => () => stageUnmounted(mounted.current), []);
  return <section aria-label="Stage" className="h-full min-h-0 min-w-0" data-testid="stage">
    <DockviewReact theme={dockTheme} disableFloatingGroups singleTabMode="fullwidth" components={components} tabComponents={tabComponents}
      onReady={({ api }) => { mounted.current = api; stageMounted(api); }} />
  </section>;
}
export function StageHeader() {
  return <div data-panel="stage" className="flex h-full min-w-0 items-center gap-1 px-2">
    <span className="flex-1 text-sm font-medium">Stage</span>
    <ButtonMenu items={environmentItems} end><Button variant="ghost" size="icon-xs" aria-label="Open an environment" title="Open an environment"><PlusIcon /></Button></ButtonMenu>
  </div>;
}
