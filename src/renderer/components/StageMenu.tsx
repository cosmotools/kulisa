// Task-wide Stage settings in the title bar (docs/window.md, The grid).
import { usePreferences, actionsFor } from '../../window-client/renderer';
import { LayoutDashboardIcon, Columns3Icon, Rows3Icon, PanelsTopLeftIcon, PanelLeftIcon, PanelRightIcon, PanelTopIcon } from 'lucide-react';
import { Button, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@ui';
import { ButtonMenu } from '../../menus/renderer';
import { useWindow } from '../lib/store';
import { store } from '../lib/store';
import { stagePaneItems } from '../lib/task-summary';
const act: ReturnType<typeof actionsFor> = (channel, ...args) => actionsFor(store.getState().current)(channel, ...args);
const useTask = <T,>(select: (s: import('../../shared/ipc').TaskPresentation) => T) => useWindow((s) => select(s.summary?.presentation ?? { workbenchItem: 'terminals', selectedArtifact: null, stagePosition: 'above', stageLayout: null, stageOverflow: false, stageFollowPaused: false }));
const setStageFollowing = (follow: boolean) => kulisa.invoke('stage:follow:set', follow);
import type { MenuItem } from '../../menus/renderer';
import type { StageLayout, StagePosition } from '../../shared/ipc';

const positions = [
  { value: 'left', label: 'Left', icon: PanelLeftIcon },
  { value: 'right', label: 'Right', icon: PanelRightIcon },
  { value: 'above', label: 'Above', icon: PanelTopIcon },
] as const;
const views = [
  { value: 'horizontal', label: 'Horizontal stack', icon: Columns3Icon },
  { value: 'vertical', label: 'Vertical stack', icon: Rows3Icon },
  { value: 'tabs', label: 'Tabs', icon: PanelsTopLeftIcon },
] as const;
function Position() {
  const value = useTask((s) => s.stagePosition);
  return <DropdownMenuRadioGroup value={value} onValueChange={(position) => void act('stage:arrange', { position: position as StagePosition })}>
    {positions.map(({ value, label, icon: Icon }) => <DropdownMenuRadioItem key={value} value={value}><Icon />{label}</DropdownMenuRadioItem>)}
  </DropdownMenuRadioGroup>;
}
function View() {
  const value = useTask((s) => s.stageLayout ?? 'horizontal');
  return <DropdownMenuRadioGroup value={value} onValueChange={(layout) => void act('stage:arrange', { layout: layout as StageLayout })}>
    {views.map(({ value, label, icon: Icon }) => <DropdownMenuRadioItem key={value} value={value}><Icon />{label}</DropdownMenuRadioItem>)}
  </DropdownMenuRadioGroup>;
}
function Overflow() {
  const mode = useTask((s) => s.stageLayout), checked = useTask((s) => s.stageOverflow);
  return mode === 'tabs' ? null : <DropdownMenuCheckboxItem checked={checked} onCheckedChange={(overflow) => void act('stage:arrange', { overflow })}
    onSelect={(e) => e.preventDefault()}>Allow overflow</DropdownMenuCheckboxItem>;
}
function Follow() {
  const enabled = usePreferences((s) => s.stageFollow), paused = useTask((s) => s.stageFollowPaused);
  return <DropdownMenuCheckboxItem checked={enabled && !paused} onCheckedChange={setStageFollowing}
    onSelect={(e) => e.preventDefault()}>{enabled && paused ? 'Follow agent (paused)' : 'Follow agent'}</DropdownMenuCheckboxItem>;
}
const items = (): MenuItem[] => [
  { heading: 'Position' }, { component: Position }, '-', { heading: 'View' }, { component: View }, { component: Overflow },
  '-', { component: Follow }, '-', { submenu: 'Open a pane', items: stagePaneItems() },
];
export function StageMenu() {
  return <ButtonMenu items={items} end><Button variant="ghost" size="icon" aria-label="Stage" title="Stage: position, view and panes"><LayoutDashboardIcon /></Button></ButtonMenu>;
}
