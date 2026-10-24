// The right-click menu in a profile's page, as Chrome's (docs/window.md, Menus): Electron's native menu
// (tutorial/context-menu.md), its rows from what is under the pointer.
import { app, clipboard, Menu } from 'electron';
import { log } from './log.ts';
import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron';
import type { Shell } from './shell.ts';
import type { Command } from './cdp-proxy.ts';

// A row: an action of Kulisa's (id), a field's own (Electron's role), or a line between groups.
type Row = { id: string; label: string; enabled?: boolean } | { role: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'; enabled: boolean } | { type: 'separator' };

// The rows for a right-click: the link, the image, the field or the selection under it, else the page's own.
function rowsFor(p: ContextMenuParams, nav: { canBack: boolean; canFwd: boolean }): Row[] {
  const rows: Row[] = [];
  const line = () => { if (rows.length) rows.push({ type: 'separator' }); };
  if (p.linkURL) rows.push({ id: 'link.open', label: 'Open Link in New Tab' }, { id: 'link.copy', label: 'Copy Link Address' });
  if (p.mediaType === 'image' && p.srcURL) { line(); rows.push({ id: 'image.open', label: 'Open Image in New Tab' }, { id: 'image.copy', label: 'Copy Image' }); }
  const f = p.editFlags;
  if (p.isEditable) {
    line();
    rows.push({ role: 'undo', enabled: f.canUndo }, { role: 'redo', enabled: f.canRedo }, { type: 'separator' },
      { role: 'cut', enabled: f.canCut }, { role: 'copy', enabled: f.canCopy }, { role: 'paste', enabled: f.canPaste }, { role: 'selectAll', enabled: f.canSelectAll });
  } else if (p.selectionText) { line(); rows.push({ role: 'copy', enabled: f.canCopy }); }
  if (!rows.length) rows.push({ id: 'tab.back', label: 'Back', enabled: nav.canBack }, { id: 'tab.forward', label: 'Forward', enabled: nav.canFwd }, { id: 'tab.reload', label: 'Reload' });
  line();
  rows.push({ id: 'pick', label: 'Pick an Element for the Agent' }, { id: 'screenshot', label: 'Screenshot of an Element' }, { type: 'separator' }, { id: 'inspect', label: 'Inspect' });
  return rows;
}

// The menu shown last, while it is open (the tests read and choose its rows).
let shown: { menu: Menu; rows: Row[] } | null = null;

function installPageMenu(shell: Shell) {
  // Not for the agent's right-click: through Playwright it is a page's event too, and a menu it opened would hold the
  // human's pointer. Electron reports the agent's input as the human's (before-mouse-event; the test checks it), so it is
  // told by the CDP proxy every command of the agent passes (a profile of a task: its key): a menu within this long of
  // its right press is the agent's. Bounded, as a site with its own menu asks for none after the agent's press.
  const agentPressed = new Map<string, number>();
  const SINCE = 2000;
  shell.proxy.on('command', (c: Command) => {
    const p = c.params as { type?: string; button?: string; key?: string };
    if ((c.method === 'Input.dispatchMouseEvent' && p.type === 'mousePressed' && p.button === 'right') || (c.method === 'Input.dispatchKeyEvent' && p.key === 'ContextMenu')) agentPressed.set(`${c.task} ${c.profile}`, Date.now());
  });
  app.on('web-contents-created', (_e, wc) => {
    wc.on('context-menu', (_ev, p) => {
      const t = shell.tabOf(wc);
      if (!t) return;
      const { w, profile, tab } = t, now = Date.now();
      if (now - (agentPressed.get(`${profile.task} ${profile.id}`) ?? 0) < SINCE) return;
      const rows = rowsFor(p, { canBack: !!tab.canBack, canFwd: !!tab.canFwd });
      const run = (id: string) => {
        log.info(`[page-menu] ${id} ${profile.id} ${tab.id}`);
        if (id === 'link.open') { profile.newTab(p.linkURL, { activate: false }); return; }
        if (id === 'link.copy') return clipboard.writeText(p.linkURL);
        if (id === 'image.open') { profile.newTab(p.srcURL, { activate: false }); return; }
        if (id === 'image.copy') return wc.copyImageAt(p.x, p.y);
        if (id === 'inspect') return profile.inspect(tab.id, p.x, p.y);
        // The rest as their keys do them (keys.ts): back, forward, reload, Pick, a screenshot of an element.
        w.send('command', { id, profile: profile.id, tab: tab.id, task: w.task?.key ?? null, page: true });
      };
      const items = rows.map((r): MenuItemConstructorOptions => ('id' in r ? { label: r.label, enabled: r.enabled ?? true, click: () => run(r.id) } : r));
      const menu = Menu.buildFromTemplate(items);
      // Once it is open: on macOS popup() opens it a moment later, and closePopup() before then closed nothing.
      menu.on('menu-will-show', () => { shown = { menu, rows }; });
      menu.popup({ window: w.win, frame: p.frame ?? undefined, sourceType: p.menuSourceType, callback: () => { if (shown?.menu === menu) shown = null; } });
    });
  });
}

const shownMenu = () => shown;

export { installPageMenu, shownMenu };
