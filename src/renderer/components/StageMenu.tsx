// Task-wide Stage settings in the title bar (docs/window.md, The grid).
import { LayoutDashboardIcon, Columns3Icon, Rows3Icon, PanelsTopLeftIcon, PanelLeftIcon, PanelRightIcon, PanelTopIcon } from 'lucide-react';
import { Button, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@ui';
import { ButtonMenu } from './Menus';
import { act, useWindow } from '../lib/store';
import { environmentItems } from '../lib/environments';
import type { MenuItem } from '../lib/menu';
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
  const value = useWindow((s) => s.stagePosition);
  return <DropdownMenuRadioGroup value={value} onValueChange={(position) => void act('stage:arrange', { position: position as StagePosition })}>
    {positions.map(({ value, label, icon: Icon }) => <DropdownMenuRadioItem key={value} value={value}><Icon />{label}</DropdownMenuRadioItem>)}
  </DropdownMenuRadioGroup>;
}
function View() {
  const value = useWindow((s) => s.stageLayout ?? 'horizontal');
  return <DropdownMenuRadioGroup value={value} onValueChange={(layout) => void act('stage:arrange', { layout: layout as StageLayout })}>
    {views.map(({ value, label, icon: Icon }) => <DropdownMenuRadioItem key={value} value={value}><Icon />{label}</DropdownMenuRadioItem>)}
  </DropdownMenuRadioGroup>;
}
function Overflow() {
  const mode = useWindow((s) => s.stageLayout), checked = useWindow((s) => s.stageOverflow);
  return mode === 'tabs' ? null : <DropdownMenuCheckboxItem checked={checked} onCheckedChange={(overflow) => void act('stage:arrange', { overflow })}
    onSelect={(e) => e.preventDefault()}>Allow overflow</DropdownMenuCheckboxItem>;
}
const items = (): MenuItem[] => [
  { heading: 'Position' }, { component: Position }, '-', { heading: 'View' }, { component: View }, { component: Overflow },
  '-', { submenu: 'Open an environment', items: environmentItems() },
];
export function StageMenu() {
  return <ButtonMenu items={items} end><Button variant="ghost" size="icon" aria-label="Stage" title="Stage: position, view and environments"><LayoutDashboardIcon /></Button></ButtonMenu>;
}
