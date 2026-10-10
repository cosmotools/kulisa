// Kulisa's menus, drawn in HTML as Chrome draws its own (Menu.vue: a popover with rows that may hold buttons, colored
// dots or profiles' pictures and a second line). Esc, a click outside, a chosen item, the same button again or leaving
// the window closes it.
//   openMenu(items, at)   at: the button to open it under, or the mouse event to open it at. A button with
//                         data-menu-end (⋮, ☰: at the end of a bar) gets the menu under it toward the start, its end
//                         edge at the button's, as Chrome's ⋮.
import { markRaw, nextTick, shallowRef, type Component } from 'vue';
import { freeze, unfreeze } from './views';

export interface MenuRow {
  label: string; sub?: string; keys?: string;
  icon?: string; // the sprite's id, at the row's start
  color?: string; // a project's dot
  avatar?: string; // a profile's picture
  enabled?: boolean;
  run?: () => unknown; // none: shown only
  remove?: { title: string; run: () => unknown }; // a × at the row's end, shown on hover (as JetBrains' recent projects)
}
export type MenuItem = '-' | MenuRow
  | { heading: string; icon?: string }
  | { note: string } // small dim words under the rows, not a row (☰'s version)
  | { component: Component; props?: Record<string, unknown> }; // a row of its own (☰'s zoom, theme …)

export const menuItems = shallowRef<MenuItem[]>([]);
export const menuEnd = shallowRef(false);
let el: HTMLElement | null = null, point: HTMLElement | null = null;
let source: Element | MouseEvent | null = null;
export const isOpen = () => !!el?.matches(':popover-open');
export const closeMenu = () => { if (isOpen()) el!.hidePopover(); };
export const isSource = (target: Node) => source instanceof Element && source.contains(target);
// Menu.vue, mounted: its popover and the point it opens at.
export function menuMounted(menu: HTMLElement, at: HTMLElement) { el = menu; point = at; }
// The popover hidden (a hide and a show in one go may come as one toggle event, or the hide's after the show).
export function menuClosed() { source = null; unfreeze(); }

export async function openMenu(list: MenuItem[], at: Element | MouseEvent) {
  const again = isOpen() && source === at;
  closeMenu();
  if (again) return;
  menuItems.value = list.map((it) => (typeof it === 'object' && 'component' in it ? { ...it, component: markRaw(it.component) } : it));
  source = at;
  menuEnd.value = at instanceof Element && 'menuEnd' in (at as HTMLElement).dataset;
  // At the pointer: a point the popover is anchored to, as to a button (components.css keeps it in the window).
  if (at instanceof MouseEvent) point!.style.translate = `${at.clientX}px ${at.clientY}px`;
  await nextTick();
  // The pages are native views above the window's HTML and would hide the menu: pictures of them meanwhile.
  await freeze();
  el!.showPopover({ source: at instanceof MouseEvent ? point! : at as HTMLElement } as ShowPopoverOptions);
  el!.focus();
}
