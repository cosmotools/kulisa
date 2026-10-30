// What covers the profiles' pages, which are native views drawn above the window's HTML (docs/ui.md, Layers;
// views.ts plugs them in: under). Seen in the document as Radix draws its layers, so no component knows of the pages:
// - a layer with an overlay (a dialog, a question, the sidebar over the grid) hides them while it is open, and the
//   keys are its (keys.ts);
// - a popper's layer (a menu, a popover, a list) opens over pictures of them: it is drawn once they are pictures,
//   then marked data-ready (the tests' handle);
// - Settings, no Radix layer, says so itself (coverPage).
// closeLayers closes them as Esc does (the grid taken down, the window left).
import { createStore } from 'zustand';
import './cover.css';

const HIDE = '[data-slot$="-overlay"][data-state="open"]';
// cover.css cuts away the same layers until they are marked data-ready.
const PICTURES = '[data-radix-popper-content-wrapper] > [data-state="open"]:not([data-slot="tooltip-content"])';

// What a page has under its menus and dialogs: hidden while a dialog is open; still while a menu is (frozen).
interface Under { hide(hidden: boolean): Promise<unknown>; freeze(): Promise<void>; unfreeze(): Promise<void> }
let under: Under | null = null;
export const coverUnder = (u: Under) => { under = u; };

// The dialogs open now (Settings counted): the keys are theirs then (keys.ts).
const dialogs = createStore(() => 0);
let pages = 0;
export const dialogsShown = () => dialogs.getState();
export const onDialogs = (l: () => void) => dialogs.subscribe(() => l());

let menus = false, pictures = false; // a menu is open; the pages under it are pictures
function seen() {
  const d = document.querySelectorAll(HIDE).length + pages, was = dialogs.getState();
  if (d !== was) {
    dialogs.setState(d, true);
    if (!was !== !d) void under?.hide(d > 0);
  }
  const open = document.querySelectorAll<HTMLElement>(PICTURES);
  if (open.length && !menus) {
    menus = true;
    void (under?.freeze() ?? Promise.resolve()).then(() => { if (menus) { pictures = true; seen(); } });
  } else if (!open.length && menus) {
    menus = pictures = false;
    void under?.unfreeze();
  }
  if (pictures) for (const m of open) m.setAttribute('data-ready', '');
}
new MutationObserver(seen).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });

// Settings shown or put away. Covering once it is drawn, the panes go from the pages straight to it.
export function coverPage(open: boolean) {
  pages += open ? 1 : -1;
  seen();
}

// The layer on top: the last open one Radix drew (its portals go to the body's end in the order they open).
const top = () => [...document.querySelectorAll<HTMLElement>(`${HIDE}, ${PICTURES}`)].at(-1);
// Every layer closed (only: menus alone) as Esc closes the top one, until none is left or one keeps its place (a
// question waiting for an answer takes no Esc). One a frame: Radix knows its new top layer once React has drawn.
export async function closeLayers(only?: 'menus') {
  for (let layer = top(), last: HTMLElement | undefined; layer && layer !== last && !(only && !layer.matches(PICTURES)); last = layer, layer = top()) {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await new Promise(requestAnimationFrame);
  }
}
// Leaving the window closes a menu, as the OS's own menus close. The main process says so, not the page's own blur: a
// blur comes also when a profile's page in it takes the keyboard as it loads (macOS), which would close a menu under
// the human's hand; nothing else takes it while a menu is open (the pages under it are pictures). Its message comes
// after the blur: a window that has the keyboard again by then (a menu just opened in it) keeps it. The page's
// document.hasFocus() can still be true after the OS window has lost focus, so ask the native window.
kulisa.on('window:blur', async () => { if (!await kulisa.invoke('window:focused')) void closeLayers('menus'); });
