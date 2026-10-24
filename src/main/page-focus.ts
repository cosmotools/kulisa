// Where the keyboard is in a window stays where the human put it (docs/window.md, Keys): a
// profile's page takes it from a click or a key of the human's in it, or when Kulisa gives it there for the human
// (allow: a tab chosen by a key, a dialog answered, Pick, an address from its pane's bar); a page taking it by itself
// (loading, a tab the agent opened: on macOS every one did) gives it back to where it was in its window.
import type { BrowserWindow, WebContents } from 'electron';

// A real click's order on macOS: the page's focus, then its mouseDown
// 2 ms later (input sent to a page, as the tests do, comes before). So the human's input in that page within this
// long of its focus, before or after, makes the focus theirs; else it is given back after it. On a loaded machine the
// gap can be longer.
const GRACE = 150;
const allowed = new WeakSet<WebContents>();
// Per window (its page's webContents), where the human left the keyboard: its page, or a profile's page.
const held = new WeakMap<WebContents, WebContents>();
const watched = new WeakSet<WebContents>();

// Kulisa gives a page the keyboard for the human: its next focus is theirs.
export function allowFocus(wc: WebContents) { allowed.add(wc); }

// Kulisa gives the window's own page the keyboard for the human (the address of a tab they open, ProfilePane.vue): a
// page taking it next gives it back there, not to the page the human was in (Ctrl+T from it, Linux).
export function focusWindow(page: WebContents) { watchWindow(page); held.set(page, page); page.focus(); }

// A profile's page, in the window win() is (a profile moves between windows).
export function guardFocus(wc: WebContents, win: () => BrowserWindow) {
  const own = () => { const w = win(); if (!w.isDestroyed()) watchWindow(w.webContents); return w.isDestroyed() ? null : w.webContents; };
  let input = 0;
  const human = () => { input = Date.now(); const page = own(); if (page) held.set(page, wc); };
  wc.on('before-mouse-event', (_e, i) => { if (i.type === 'mouseDown') human(); });
  wc.on('before-input-event', (_e, i) => { if (i.type === 'keyDown') human(); });
  wc.on('focus', () => {
    const page = own();
    if (!page) return;
    if (allowed.delete(wc)) { held.set(page, wc); return; }
    const at = Date.now();
    setTimeout(() => {
      if (wc.isDestroyed() || page.isDestroyed() || input >= at - GRACE || !wc.isFocused()) return; // the human's, or gone on
      const back = held.get(page);
      const to = back && !back.isDestroyed() && back !== wc ? back : page;
      if (to !== page) allowed.add(to);
      to.focus();
    }, GRACE);
  });
}

// The window's own page: the human (or Kulisa) put the keyboard there whenever it has it, or the human's input goes
// there (a click into the terminal or a menu: input sent to the page, as the tests do, moves no OS focus).
function watchWindow(page: WebContents) {
  if (watched.has(page)) return;
  watched.add(page);
  const mine = () => held.set(page, page);
  page.on('focus', mine);
  page.on('before-mouse-event', (_e, i) => { if (i.type === 'mouseDown') mine(); });
  page.on('before-input-event', (_e, i) => { if (i.type === 'keyDown') mine(); });
}
