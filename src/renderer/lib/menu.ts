// What a menu holds, as the window's parts build their menus (docs/ui.md, Menus).
import { shallowRef, type Component } from 'vue';

export interface MenuRow {
  label: string; sub?: string; keys?: string;
  icon?: string; // the sprite's id, at the row's start
  color?: string; // a project's dot
  avatar?: string; // a profile's picture
  project?: { icon?: string; favicon?: string; color: string }; // a project's icon, in its color (ProjectIcon.vue)
  inset?: boolean; // set in under the row above, as its own (a project's closed task under it)
  enabled?: boolean;
  run?: () => unknown; // none: shown only
  remove?: { title: string; run: () => unknown }; // a × after the row, shown on hover (as JetBrains' recent projects)
}
export type MenuItem = '-' | MenuRow
  | { heading: string; icon?: string }
  | { note: string } // small dim words under the rows, not a row (☰'s version)
  | { choose: (value: string) => unknown; chosen: string; rows: (MenuRow & { value: string })[] } // one of them, checked
  | { component: Component; props?: Record<string, unknown> }; // a row of its own (☰'s zoom, theme …)

// A menu at a point with no button or area of its own: a link in the terminal (Ctrl+click). PointMenu.vue shows it.
export const pointMenu = shallowRef<{ x: number; y: number; items: MenuItem[] } | null>(null);
export const menuAt = (e: MouseEvent, items: MenuItem[]) => { pointMenu.value = { x: e.clientX, y: e.clientY, items }; };
// A row whose action opens a field for the keyboard (New Profile…): the menu, closing, gives it there instead (forgotten
// soon after, when the menu had closed before the field came).
let given: HTMLElement | null = null;
export function focusAfterMenu(el: HTMLElement | null | undefined) {
  given = el ?? null;
  el?.focus();
  setTimeout(() => { if (given === el) given = null; }, 500);
}
// A menu closed: the keyboard back where it was before it opened (the terminal, a field, its button), unless another
// menu has opened meanwhile (the focus leaving that one would close it).
export function focusBack(e: Event, el: Element | null) {
  e.preventDefault();
  if (given?.isConnected) { given.focus(); given = null; return; }
  given = null;
  if (!document.querySelector('.menu[data-state="open"]') && el instanceof HTMLElement && el.isConnected) el.focus();
}
// The bar's + menu (NewTask.vue) opened or closed as a click on it does: Ctrl+Shift+A, the empty window's New Task.
export const toggleNewTask = () => document.getElementById('newTask')?.click();
