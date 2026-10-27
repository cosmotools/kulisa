// What a menu holds, as the window's parts build their menus (docs/ui.md, Menus).
import type { ComponentType } from 'react';
import { createStore, useStore } from 'zustand';

export interface MenuRow {
  label: string; sub?: string; keys?: string;
  title?: string; // its tooltip
  icon?: ComponentType; // at the row's start (Lucide's, an agent's mark)
  color?: string; // a project's dot
  avatar?: string; // a profile's picture
  project?: { favicon?: string; color: string }; // a project's icon, in its color shown (components/ProjectIcon.tsx; projectColor)
  inset?: boolean; // set in under the row above, as its own (a project's closed task under it)
  enabled?: boolean;
  run?: () => unknown; // none: shown only
  remove?: { label: string; run: () => unknown }; // a 🗑 at its end, on hover or Delete (a closed task)
}
export type MenuItem = '-' | MenuRow
  // a row opening a menu of its own at its side (hover); run: a click on the row itself acts and closes the menu
  | { submenu: string; items: MenuItem[]; project?: { favicon?: string; color: string }; run?: () => unknown }
  | { heading: string; icon?: ComponentType }
  | { component: ComponentType<{ close: () => void }> }; // a row of its own (☰'s zoom, theme …)

// A menu at a point with no button or area of its own: a link in the terminal (Ctrl+click). components/PointMenu.tsx shows it.
type AtPoint = { x: number; y: number; items: MenuItem[] } | null;
const pointMenu = createStore<AtPoint>()(() => null);
export const usePointMenu = () => useStore(pointMenu);
export const closePointMenu = () => pointMenu.setState(null, true);
export const menuAt = (e: MouseEvent, items: MenuItem[]) => pointMenu.setState({ x: e.clientX, y: e.clientY, items }, true);
// The same at a point the main process names (a screenshot's thumbnail, a native view of its own): done once it closes.
export const menuAtPoint = (x: number, y: number, items: MenuItem[]) => new Promise<void>((closed) => {
  pointMenu.setState({ x, y, items }, true);
  const stop = pointMenu.subscribe((m) => { if (m?.items !== items) { stop(); closed(); } });
});
