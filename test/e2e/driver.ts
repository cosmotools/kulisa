// What the e2e tests reach in Kulisa's main process (fixtures.ts, core): the running app, the uncaught errors it had,
// and the actions a test takes there as the human's hand would (keys as input events). Loaded by app.ts; the tests
// import only its type.
import electron from 'electron';
import fs from 'fs';
import type { WebContents } from 'electron';
import type { Shell } from '../../src/main/shell.ts';

type Modifier = 'control' | 'shift' | 'alt' | 'meta';
// Kulisa's keys that are ⌘ on macOS and Ctrl elsewhere (CommandOrControl in keys.ts); Ctrl+` and Ctrl+Tab are Ctrl's
// everywhere, and in the terminal Ctrl is the agent's.
const CMD: Modifier = process.platform === 'darwin' ? 'meta' : 'control';

// A key pressed where the human's keyboard would put it: an input event into that page, which Kulisa's own keys see
// first (keys.ts, before-input-event). Into a profile's page too, which the tests never drive through Playwright
// (docs/testing.md, End to end on Playwright Test).
const press = (wc: WebContents, keyCode: string, ...modifiers: Modifier[]) => {
  for (const type of ['keyDown', 'keyUp'] as const) wc.sendInputEvent({ type, keyCode, modifiers });
};

export function driver(shell: Shell) {
  // An open profile by its name, as the tests name them.
  const profile = (name: string) => {
    const found = [...shell.profiles.values()].find((p) => p.name === name);
    if (!found) throw new Error(`no open profile named ${name}`);
    return found;
  };
  return {
    shell, CMD, press, profile,
    // Kulisa's uncaught errors (app.ts): fixtures.ts fails the test they came in.
    errors: [] as string[],
    // A profile of the task shown, made if it is not there yet, its pane laid out in the grid and its tab in front on
    // url once loaded: what a test that needs a profile starts from, through the core (making profiles is tested in
    // Settings' tests). A page not laid out yet takes no focus.
    async ensureProfile(name: string, url: string) {
      if (![...shell.profiles.values()].some((p) => p.name === name)) await shell.task.createProfile(name);
      const p = profile(name);
      if (!p.visible() || !p.bounds.width) await new Promise<void>((r) => p.once('laid-out', () => r()));
      const tab = p.get();
      if (tab.wc.getURL() !== url) { p.navigate(tab.id, url); await new Promise<void>((r) => tab.wc.once('did-finish-load', () => r())); }
      return p;
    },
    // The whole window as the screen shows it, its profiles' views included (window.ts, screenshot): on macOS only with
    // the screen recording permission (docs/testing.md, On macOS), else its page alone.
    async shot(file: string) {
      const w = shell.windows[0];
      if (process.platform !== 'darwin' || electron.systemPreferences.getMediaAccessStatus('screen') === 'granted') return w.screenshot(file);
      const image = await w.win.webContents.capturePage();
      fs.writeFileSync(file, image.toPNG());
      return file;
    },
  };
}

export type Kulisa = ReturnType<typeof driver>;
