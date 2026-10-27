// Menus and dialogs over a page: one menu at a time, as the OS's; every layer closed at once (a grid taken down, the
// window left). What lies under them is the page's own: in a tasks' window the profiles' native views, which draw
// above its HTML (views.ts plugs them in: under); Settings' window has none (docs/ui.md, Menus, Dialogs).
//   useCovered('hide')       a dialog's open state: [open, setOpen]
//   useCovered('pictures')   a menu's; ready once what is under it allows it to show (pictures of the pages)
import { useCallback, useEffect, useRef, useState } from 'react';

// The dialogs open now (the keys are theirs then: keys.ts).
let dialogsOpen = 0;
const dialogListeners = new Set<() => void>();
export const dialogsShown = () => dialogsOpen;
export const onDialogs = (l: () => void) => { dialogListeners.add(l); return () => { dialogListeners.delete(l); }; };
const dialogs = new Set<() => void>(), menus = new Set<() => void>();

// What a page has under its menus and dialogs: hidden while a dialog is open; still while a menu is (frozen).
interface Under { hide(hidden: boolean): void; freeze(): Promise<void>; unfreeze(): Promise<void> }
let under: Under | null = null;
export const coverUnder = (u: Under) => { under = u; };

// A layer opened or closed: what is under it follows. close: what closes it from outside (another menu, the window).
// ready: a menu's, once what is under it allows it to show.
export function layer(how: 'hide' | 'pictures', open: boolean, close: () => void, ready: () => void) {
  const set = how === 'hide' ? dialogs : menus;
  if (open === set.has(close)) return;
  if (open) set.add(close); else set.delete(close);
  if (open && how === 'pictures') for (const other of [...menus]) if (other !== close) other(); // one menu at a time, as the OS's
  if (how === 'hide') {
    dialogsOpen += open ? 1 : -1;
    for (const l of dialogListeners) l();
    under?.hide(open);
  } else if (open) {
    if (under) void under.freeze().then(ready); else ready();
  } else if (!menus.size) void under?.unfreeze(); // not when another menu has opened already
}

// Opened at once, as Fluent expects (a right-click menu takes the pointer's place in the same turn); what is under it
// follows. However it closes (Esc, a click outside, a choice, the window), that comes back.
export function useCovered(how: 'hide' | 'pictures') {
  const [open, setOpenState] = useState(false), [ready, setReady] = useState(how === 'hide');
  const openRef = useRef(false), latest = useRef<(v: boolean) => void>(() => {});
  const [close] = useState(() => () => latest.current(false)); // one for the layer's whole life
  const setOpen = useCallback((v: boolean) => {
    if (v === openRef.current) return;
    openRef.current = v;
    setOpenState(v);
    if (how === 'pictures') setReady(false);
    layer(how, v, close, () => { if (openRef.current) setReady(true); });
  }, [how, close]);
  useEffect(() => { latest.current = setOpen; });
  useEffect(() => () => { if (openRef.current) { openRef.current = false; layer(how, false, close, () => {}); } }, [how, close]);
  return { open, setOpen, ready };
}

const closeMenus = () => { for (const close of [...menus]) close(); };
export const closeLayers = () => { closeMenus(); for (const close of [...dialogs]) close(); };
// Leaving the window closes a menu, as the OS's own menus close. A tasks' window (with what is under: views.ts) says so
// from the main process: its page's own blur came also when a profile's page in it took the keyboard as it loaded
// (macOS), a menu gone under the human's hand; nothing else takes it while a menu is open (the pages under it are
// pictures). Settings' window has nothing under it: its page's blur is the window's.
addEventListener('blur', () => { if (!under) closeMenus(); });
// Its message comes after the blur: a window that has the keyboard again by then (a menu just opened in it) keeps it.
kulisa.on('window:blur', () => { if (!document.hasFocus()) closeMenus(); });
