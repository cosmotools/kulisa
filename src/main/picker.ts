// Point and tell (feature 3): Playwright's page.pickLocator() is the inspector. A short reference to the element (the
// profile, the tab, a Playwright locator) is typed into the agent's prompt without Enter: the human writes the rest of
// the message around it and sends it. Nothing is saved: the agent looks at the element on the live page with its
// tools (snapshot, screenshot, console, requests of that tab), so Kulisa writes nothing into the project.
import { handle } from './ipc.ts';
import { refused } from '../shared/result.ts';
import type { Locator } from 'playwright-core';
import type { Profile, Tab } from './profiles.ts';
import type { Shell } from './shell.ts';
import type { AppWindow } from './window.ts';

// Choosing an element in a tab with Playwright's picker: Pick, and Screenshot → Element (src/screenshots). Profiles
// choosing, each window's (window.ts: picking, of the task on screen, by id) -> { profile, page, cancel }: one at a
// time in a profile. It ends with a click on an element, or is cancelled by Esc in the page or pick:cancel (the Pick
// button again); null then.
async function chooseElement(w: AppWindow, profile: Profile, tab: Tab): Promise<Locator | null> {
  const page = await profile.page(tab.id);
  const wc = tab.wc;
  let cancelled = false;
  const cancel = () => { cancelled = true; return page.cancelPickLocator().catch(() => {}); };
  const onKey = (e: Electron.Event, input: Electron.Input) => { if (input.type === 'keyDown' && input.key === 'Escape') { e.preventDefault(); void cancel(); } };
  w.picking.get(profile.id)?.cancel();
  w.picking.set(profile.id, { profile, page, cancel });
  wc.on('before-input-event', onKey);
  profile.focusTab(tab);
  try { return await page.pickLocator(); } catch (e) { if (!cancelled) throw e; return null; } finally {
    w.picking.delete(profile.id);
    if (!wc.isDestroyed()) wc.off('before-input-event', onKey);
  }
}

function installPicker(shell: Shell) {
  // The reference goes to the agent shown in the profile's task, else the one shown last (tasks.ts).
  handle('pick:cancel', (e, { profile }) => shell.windowOf(e.sender)?.picking.get(profile)?.cancel());
  handle('pick:start', async (e, { profile: pid }) => {
    try {
      const w = shell.windowOf(e.sender), task = w?.task;
      if (!task) return { error: 'no task is open' };
      const found = task.findTab(pid); // its active tab (tasks.ts, the agent's checks too)
      if (refused(found)) return found;
      const { profile, tab } = found;
      const picked = await chooseElement(w, profile, tab);
      if (!picked) return { cancelled: true };
      let normal = picked;
      try { normal = await picked.normalize(); } catch {}
      const locator = normal.toString();
      // One line, short, so the agent CLI shows it in its prompt as typed text (not a collapsed paste). The tab: the
      // human may switch tabs before sending, and the agent's tools act on the active one unless told.
      const reference = `[kulisa pick: ${profile.id} tab ${tab.id} ${locator}] `;
      task.typeForAgent(reference);
      return { tab: tab.id, locator, reference };
    } catch (e) { return { error: (e as Error).message }; }
  });
}

export { chooseElement, installPicker };
