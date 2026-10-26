// The sidebar's switch (fluent/Sidebar.tsx; docs/tasks.md, The sidebar), for the title bar's button and Ctrl+Shift+A
// (keys.ts, task.menu): over the grid, opened or closed; docked in the empty window, the keyboard given to it.
import { store } from './store';
import { dialogsShown } from './cover';

let overlay: { open: boolean; setOpen: (open: boolean) => void } | null = null;
let docked: HTMLElement | null = null;
export const sidebarOverlay = (o: typeof overlay) => { overlay = o; };
export const sidebarDocked = (el: HTMLElement | null) => { docked = el; };

export function toggleSidebar() {
  if (store.getState().current === null) { docked?.querySelector<HTMLElement>('[role="treeitem"]')?.focus(); return; }
  if (!overlay || dialogsShown() > (overlay.open ? 1 : 0)) return; // another dialog has the window
  overlay.setOpen(!overlay.open);
}
