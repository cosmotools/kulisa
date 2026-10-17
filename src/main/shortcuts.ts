// Kulisa's keyboard shortcuts as they are typed (docs/window.md, Keys; the table: keys.ts): every key in a window or
// a profile's page comes here first; the hold keys the human changes.
import { app } from 'electron';
import { stepZoom } from './profiles.ts';
import type { AppWindow } from './window.ts';
import { held, holdable, keymap, list as keyList, match } from './keys.ts';
import { handle, on } from './ipc.ts';
import { log } from './log.ts';
import type { IpcMainEvent, WebContents } from 'electron';
import type { Shell } from './shell.ts';
import type * as Sent from '../shared/types.ts'; // what the window gets: its one definition
import type { Result } from '../shared/result.ts';

export function installShortcuts(shell: Shell, { appDevTools }: { appDevTools: boolean }) {
  const store = shell.store;
  const at = (e: IpcMainEvent) => shell.windowOf(e.sender);
  // ---------- keyboard shortcuts (keys.ts) ----------
  // Every key typed in the window or in a profile's page comes here first (before-input-event), before the page
  // gets it: one of Kulisa's is taken (the page never sees it) and done, here or by the window; any other goes on
  // to the page, the terminal's agent or the site.
  let table = keymap(undefined, store.settings().keys);
  shell.keys = () => keyList(undefined, store.settings().keys);
  const ZOOM: Record<string, number> = { 'zoom.in': 1, 'zoom.out': -1, 'zoom.reset': 0, 'site.zoomIn': 1, 'site.zoomOut': -1, 'site.zoomReset': 0 };
  // A profile's tab by its webContents, of a task shown in a window.
  const tabOf = (wc: WebContents) => {
    for (const w of shell.windows) for (const profile of w.profiles.values()) {
      const tab = profile.tabs.find((t) => t.wc === wc);
      if (tab) return { w, profile, tab };
    }
    return null;
  };
  function onKey(wc: WebContents, e: Electron.Event, input: Electron.Input) {
    const w = shell.windowOf(wc), t = !w && tabOf(wc);
    if (!w && !t) return; // DevTools, a tab of a task not on screen
    const zone = w ? w.keyZone : 'page';
    // A key held alone (the dictation's): its press and its release, wherever the keyboard is but a dialog (the
    // shortcuts' dialog takes a key there to make it the one). Left to the page too (no preventDefault: a press
    // taken had its release withheld by Chromium, and the key types nothing).
    const h = held(table, input);
    if (h) {
      if (zone !== 'dialog' && h.id === 'voice.hold') (w || (t as { w: AppWindow }).w).task?.holdKey(h.down);
      return;
    }
    if (input.type !== 'keyDown') return;
    const pane = zone.startsWith('pane:') ? zone.slice('pane:'.length) : null;
    // The nearest group first: in a page, the page's keys (its zoom, its DevTools); in the window, Kulisa's.
    const hit = match(table, input, zone === 'page' ? ['page', 'global'] : pane ? ['global', 'page'] : ['global'], { always: zone === 'dialog' });
    if (!hit || (hit.id === 'devtools.app' && !appDevTools)) return;
    e.preventDefault();
    log.info(`[key] ${hit.id} zone=${zone} wc=${wc.id}`);
    const win = w || (t as { w: AppWindow }).w;
    const step = ZOOM[hit.id];
    if (step !== undefined) return hit.id.startsWith('zoom.') ? shell.setUiZoom(stepZoom(shell.uiZoom, step)) : t && t.profile.zoomSite(t.tab.id, step);
    if (hit.id === 'devtools.app') return win.toggleDevTools();
    if (hit.id === 'devtools.tab') return t && t.profile.toggleDevTools(t.tab.id);
    if (hit.window) win.win.webContents.focus();
    win.send('command', { id: hit.id, n: hit.n, profile: t ? t.profile.id : pane, tab: t ? t.tab.id : null, task: win.task?.key ?? null, page: !!t });
  }
  app.on('web-contents-created', (_e, wc) => wc.on('before-input-event', (e, input) => onKey(wc, e, input)));
  on('keys:zone', (e, zone) => { const w = at(e); if (w) w.keyZone = String(zone); });
  // A hold key changed by the human (Keyboard Shortcuts): kept in settings.json, every window told.
  handle('keys:set', (_e, { id, code }): Result<{ keys: Sent.Shortcut[] }> => {
    if (!table.some((b) => b.hold && b.id === id)) return { error: `not a key to change: ${id}` };
    const why = holdable(table, code);
    if (why) return { error: why };
    const keys = { ...store.settings().keys, [id]: code };
    store.saveSettings({ ...store.settings(), keys });
    table = keymap(undefined, keys);
    for (const w of shell.windows) w.send('keys', shell.keys());
    return { keys: shell.keys() };
  });

}
