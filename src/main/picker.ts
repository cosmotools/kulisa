// Point and tell (feature 3): Playwright's page.pickLocator() is the inspector. A short reference to the element (the
// profile, the tab, a Playwright locator) is typed into the agent's prompt without Enter: the human writes the rest of
// the message around it and sends it. Nothing is saved: the agent looks at the element on the live page with its
// tools (snapshot, screenshot, console, requests of that tab), so Kulisa writes nothing into the project.
import { handle } from './ipc.ts';
import { typeIntoPrompt } from '../terminal/main/index.ts';
import { refused } from '../shared/result.ts';
import type { Shell } from './shell.ts';

function installPicker(shell: Shell) {
  // Profiles in pick mode, each window's (window.ts: picking, of the task on screen, by id) -> { profile, page,
  // cancel }. Pick mode ends with a click on an element, or is cancelled by Esc in the page or by the Pick button again
  // (pick:cancel). The reference goes to the agent shown in the profile's task, else the one shown last (tasks.ts).
  handle('pick:cancel', (e, { profile }) => shell.windowOf(e.sender)?.picking.get(profile)?.cancel());
  handle('pick:start', async (e, { profile: pid }) => {
    try {
      const w = shell.windowOf(e.sender), task = w?.task;
      if (!task) return { error: 'no task is open' };
      const found = task.findTab(pid); // its active tab (tasks.ts, the agent's checks too)
      if (refused(found)) return found;
      const { profile, tab } = found;
      const page = await profile.page(tab.id);
      const wc = tab.wc;
      let cancelled = false;
      const cancel = () => { cancelled = true; return page.cancelPickLocator().catch(() => {}); };
      const onKey = (e: Electron.Event, input: Electron.Input) => { if (input.type === 'keyDown' && input.key === 'Escape') { e.preventDefault(); void cancel(); } };
      w.picking.set(pid, { profile, page, cancel });
      wc.on('before-input-event', onKey);
      profile.focusTab(tab);
      let picked: import('playwright-core').Locator | undefined;
      try { picked = await page.pickLocator(); } catch (e) { if (!cancelled) throw e; } finally {
        w.picking.delete(pid);
        if (!wc.isDestroyed()) wc.off('before-input-event', onKey);
      }
      if (cancelled || !picked) return { cancelled: true };
      let normal = picked;
      try { normal = await picked.normalize(); } catch {}
      const locator = normal.toString();
      // One line, short, so the agent CLI shows it in its prompt as typed text (not a collapsed paste). The tab: the
      // human may switch tabs before sending, and the agent's tools act on the active one unless told.
      const reference = `[kulisa pick: ${profile.id} tab ${tab.id} ${locator}] `;
      const to = task.promptTarget();
      if (to?.pty) typeIntoPrompt(to.pty, reference);
      if (to && to.id !== task.front) task.show(to.id); // where the human goes on typing
      // The human goes on typing in the terminal: move the focus there from the page.
      if (!w.win.isDestroyed()) w.win.webContents.focus();
      w.send('terminal:focus');
      return { tab: tab.id, locator, reference };
    } catch (e) { return { error: (e as Error).message }; }
  });
}

export { installPicker };
