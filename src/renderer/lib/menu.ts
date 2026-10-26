// What a menu holds, as the window's parts build their menus (docs/ui.md, Menus).
import { shallowRef, watch, type Component } from 'vue';

export interface MenuRow {
  label: string; sub?: string; keys?: string;
  title?: string; // its tooltip
  icon?: Component; // at the row's start
  avatar?: string; // a profile's picture
  enabled?: boolean;
  run?: () => unknown; // none: shown only
}
export type MenuItem = '-' | MenuRow
  // a row opening a menu of its own at its side (hover)
  | { submenu: string; items: MenuItem[]; project?: { favicon?: string; color: string } }
  | { heading: string; icon?: Component }
  | { component: Component; props?: Record<string, unknown> }; // a row of its own (☰'s zoom, theme …)

// A menu at a point with no button or area of its own: a link in the terminal (Ctrl+click). PointMenu.vue shows it.
export const pointMenu = shallowRef<{ x: number; y: number; items: MenuItem[] } | null>(null);
export const menuAt = (e: MouseEvent, items: MenuItem[]) => { pointMenu.value = { x: e.clientX, y: e.clientY, items }; };
// The same at a point the main process names (a screenshot's thumbnail, a native view of its own): done once it closes.
export const menuAtPoint = (x: number, y: number, items: MenuItem[]) => new Promise<void>((closed) => {
  pointMenu.value = { x, y, items };
  const stop = watch(pointMenu, (m) => { if (m?.items !== items) { stop(); closed(); } });
});
// A row whose action opens a field for the keyboard (New Profile…): the menu, closing, gives it there instead (forgotten
// soon after, when the menu had closed before the field came).
let given: HTMLElement | null = null;
export function focusAfterMenu(el: HTMLElement | null | undefined) {
  given = el ?? null;
  el?.focus();
  setTimeout(() => { if (given === el) given = null; }, 500);
}
// A menu closed: the keyboard back where it was before it opened (the terminal, a field, its button), unless it went
// somewhere meanwhile (a key gave it to the launcher as the menu closed) or another menu has opened (the focus leaving
// that one would close it). The closed menu's own focus falls to the body as it goes. A menu here is any of Reka's
// popups (a popover too): its wrapper.
const POPUP = '[data-reka-popper-content-wrapper]';
export function focusBack(e: Event, el: Element | null) {
  e.preventDefault();
  if (given?.isConnected) { given.focus(); given = null; return; }
  given = null;
  const at = document.activeElement;
  if (at && at !== document.body && !at.closest(POPUP)) return;
  if (!document.querySelector(`${POPUP} > [data-state="open"]`) && el instanceof HTMLElement && el.isConnected) el.focus();
}
// A menu fading out as it closes (shadcn-vue's animation) gives the keyboard nowhere: Reka's row the pointer leaves
// (the menu shrinking under it) gives it to its menu, taking it from what had it since (the welcome's Next). Its
// content's pointerleave on the capture, kept from the row (not cancelable).
export const leaveClosing = (e: PointerEvent) => { if ((e.target as Element).closest('[role="menu"]')?.matches('[data-state="closed"]')) e.stopPropagation(); };
