// Point and tell (feature 3): Playwright's page.pickLocator() is the inspector. A short reference to the element (the
// profile, the tab, a Playwright locator) is typed into the agent's prompt without Enter: the human writes the rest of
// the message around it and sends it. Nothing is saved: the agent looks at the element on the live page with its
// tools (snapshot, screenshot, console, requests of that tab), so Kulisa writes nothing into the project.
const { ipcMain } = require('electron');
const { typeIntoPrompt } = require('./terminal');

function installPicker(shell) {
  // Profiles in pick mode (of the workspace on screen, by id) -> { profile, page, cancel }. Pick mode ends with a
  // click on an element, or is cancelled by Esc in the page or by the Pick button again (pick:cancel). The reference
  // goes to the agent of the profile's workspace.
  shell.picking = new Map();
  ipcMain.handle('pick:cancel', (_e, { profile }) => shell.picking.get(profile)?.cancel());
  ipcMain.handle('pick:start', async (_e, { profile: pid }) => {
    try {
      const profile = shell.profiles.get(pid);
      const ws = shell.ws;
      const tab = profile.get();
      const page = await profile.page(tab.id);
      const wc = tab.wc;
      let cancelled = false;
      const cancel = () => { cancelled = true; return page.cancelPickLocator().catch(() => {}); };
      const onKey = (e, input) => { if (input.type === 'keyDown' && input.key === 'Escape') { e.preventDefault(); cancel(); } };
      shell.picking.set(pid, { profile, page, cancel });
      wc.on('before-input-event', onKey);
      wc.focus();
      let picked;
      try { picked = await page.pickLocator(); } catch (e) { if (!cancelled) throw e; } finally {
        shell.picking.delete(pid);
        if (!wc.isDestroyed()) wc.off('before-input-event', onKey);
      }
      if (cancelled || !picked) return { cancelled: true };
      let locator = picked;
      try { locator = await picked.normalize(); } catch {}
      locator = locator.toString();
      // One line, short, so the agent CLI shows it in its prompt as typed text (not a collapsed paste). The tab: the
      // human may switch tabs before sending, and the agent's tools act on the active one unless told.
      const reference = `[kulisa pick: ${profile.id} tab ${tab.id} ${locator}] `;
      if (ws.pty) typeIntoPrompt(ws.pty, reference);
      // The human goes on typing in the terminal: move the focus there from the page.
      shell.win.webContents.focus();
      shell.win.webContents.send('terminal:focus');
      return { tab: tab.id, locator, reference };
    } catch (e) { return { error: e.message }; }
  });
}

module.exports = { installPicker };
