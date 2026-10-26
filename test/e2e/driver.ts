// What the e2e tests reach in Kulisa's main process (fixtures.ts, core): the running app, the uncaught errors it had,
// its questions answered in their dialog, what its terminals printed, and the actions a test takes there as the human's
// hand would (keys as input events). Loaded by app.ts; the tests import only its type.
import electron from 'electron';
import fs from 'fs';
import type { WebContents } from 'electron';
import type { IPty } from 'node-pty';
import type { Shell } from '../../src/main/shell.ts';
import type { AppWindow } from '../../src/main/window.ts';
import type { SettingsWindow } from '../../src/main/settings-window.ts';
import type { Question } from '../../src/shared/types.ts';
// The app's own instances (app.ts loads the same files): what a test reaches beyond the shell, imported here so that
// core's functions, which are eval'd and cannot import, get them by k.
import * as pageMenu from '../../src/main/page-menu.ts';
import * as agentHooks from '../../src/main/kulisa-plugin/agent-hooks.ts';
import * as browserTools from '../../src/main/kulisa-plugin/tools/browser.ts';
import { removeTree } from '../../src/main/remove.ts';
import { worktreesOf } from '../../src/main/store.ts';
import { log } from '../../src/main/log.ts';
import { GRACE } from '../../src/main/page-focus.ts';

type Modifier = 'control' | 'shift' | 'alt' | 'meta';
// Kulisa's keys that are ⌘ on macOS and Ctrl elsewhere (CommandOrControl in keys.ts); Ctrl+` and Ctrl+Tab are Ctrl's
// everywhere, and in the terminal Ctrl is the agent's.
const CMD: Modifier = process.platform === 'darwin' ? 'meta' : 'control';

// A key pressed where the human's keyboard would put it: an input event into that page, which Kulisa's own keys see
// first (keys.ts, before-input-event). Into a profile's page too, which the tests never drive through Playwright
// (docs/testing.md, End to end).
const press = (wc: WebContents, keyCode: string, ...modifiers: Modifier[]) => {
  for (const type of ['keyDown', 'keyUp'] as const) wc.sendInputEvent({ type, keyCode, modifiers });
};

// A clock the test moves for the main process's timers of at least `from` ms: held instead of run, until advance()
// says that much time went by, then run in their order; at release the ones left run at their real time. Node's timers
// are one global (a part's own cannot be faked alone), so only the long ones are held: the rest of Kulisa (Electron's,
// Playwright's, node-pty's short waits) keeps the real time meanwhile.
type Held = { at: number; ms: number; fn: () => void; cleared: boolean };
function clock() {
  const real = { set: globalThis.setTimeout, clear: globalThis.clearTimeout };
  let held: Held[] | null = null, now = 0;
  const handle = (t: Held) => Object.assign(t, { ref: () => t, unref: () => t, hasRef: () => true, refresh: () => { t.at = now + t.ms; return t; } });
  const c = {
    hold(from: number) {
      c.release();
      held = []; now = 0;
      globalThis.setTimeout = ((fn: (...a: unknown[]) => void, ms = 0, ...args: unknown[]) => {
        if (!held || typeof fn !== 'function' || ms < from) return real.set(fn, ms, ...args);
        const t = handle({ at: now + ms, ms, fn: () => fn(...args), cleared: false });
        held.push(t);
        return t;
      }) as typeof setTimeout;
      globalThis.clearTimeout = ((t: unknown) => { if (held?.includes(t as Held)) (t as Held).cleared = true; else real.clear(t as NodeJS.Timeout); });
    },
    // The held timers due within ms run, each as its time comes (one may set another).
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = held?.filter((t) => !t.cleared && t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        due.cleared = true; now = due.at;
        due.fn();
      }
      now = end;
    },
    release() {
      if (!held) return;
      Object.assign(globalThis, { setTimeout: real.set, clearTimeout: real.clear });
      for (const t of held) if (!t.cleared) real.set(t.fn, t.at - now);
      held = null;
    },
  };
  return c;
}

export function driver(shell: Shell, openedExternally: string[]) {
  // An open profile by its name, as the tests name them (any case, as the agent does).
  const profile = (name: string) => {
    const found = [...shell.profiles.values()].find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!found) throw new Error(`no open profile named ${name}`);
    return found;
  };
  // What the terminals watched printed (the pty's output) since the test began: the first window's agent from its start
  // (fixtures.ts), another (a task's, a project's) once a test watches it.
  let pty = '';
  const watched = new WeakSet<IPty>();
  const watchPty = (p: IPty) => { if (!watched.has(p)) { watched.add(p); p.onData((d) => (pty += d)); } };
  // Kulisa's log lines since the test began, as the file has them (log.ts): every action of the core leaves one, so a
  // line that is not there says what was not done.
  const logged: string[] = [];
  log.hooks.push((m, _t, name) => { if (name === 'file') logged.push(m.data.map(String).join(' ')); return m; });
  const k = {
    // Electron's module, for what a test does in the main process beyond Kulisa's own (its menus, the theme, the app).
    electron, shell, CMD, press, profile, watchPty, openedExternally, pageMenu, agentHooks, browserTools, removeTree, worktreesOf,
    logged, clock: clock(),
    ptyOutput: () => pty,
    // Every give-back of the keyboard that the focus guard has waiting is done (page-focus.ts): its timers are all of one
    // length, and Node runs those in the order they were set. A timer set after theirs, not a pause.
    // eslint-disable-next-line no-restricted-syntax
    focusGrace: () => new Promise((r) => setTimeout(r, GRACE)),
    // Kulisa's uncaught errors (app.ts): fixtures.ts fails the test they came in.
    errors: [] as string[],
    // Questions (deleting a profile, a task…) answered in the window's dialog as the human would: true clicks the button
    // that does it, false Cancel, 'other' the other one; null leaves the dialog to the test. asked: what was asked.
    answer: true as boolean | 'other' | null,
    asked: [] as Question[],
    // What a test keeps in the main process between its core() calls (a stubbed function's original, an object it
    // watches): only data crosses back, so it stays here, by name. Empty as each test begins.
    stash: {} as Record<string, any>,
    // A test begins with Kulisa's questions answered yes, none asked yet, no output or log read, nothing stashed, the
    // real clock (fixtures.ts).
    reset() { k.errors.length = 0; k.asked.length = 0; k.answer = true; pty = ''; logged.length = 0; k.stash = {}; k.clock.release(); },
    // A window done showing its task: loaded, not switching (and its agent's terminal started, with pty).
    settled(pty = false, w = shell.windows[0]) { return !!w?.task?.loaded && !w.switching && (!pty || !!shell.pty); },
    // A profile of the task shown, opened again when it is closed, made when it is not there yet (with who it is and its
    // picture).
    async openProfile(name: string, made: { description?: string; avatar?: string } = {}) {
      const named = (n: string) => n.toLowerCase() === name.toLowerCase(), task = shell.task;
      const closed = [...task.closed.values()].find((c) => named(c.cfg.name));
      if (closed) await task.openProfile(closed.cfg.id);
      else if (![...shell.profiles.values()].some((p) => named(p.name))) await task.createProfile(name, made.description, made.avatar);
      return profile(name);
    },
    // That profile, its pane laid out in the grid and its tab in front on url once loaded: what a test that needs a
    // profile starts from, through the core (making profiles is tested in Settings' tests). A page not laid out yet takes
    // no focus.
    async ensureProfile(name: string, url: string, made: { description?: string; avatar?: string } = {}) {
      const p = await k.openProfile(name, made);
      if (!p.visible() || !p.bounds.width) await new Promise<void>((r) => p.once('laid-out', () => r()));
      const tab = p.get();
      if (tab.wc.getURL() !== url) { p.navigate(tab.id, url); await new Promise<void>((r) => tab.wc.once('did-finish-load', () => r())); }
      return p;
    },
    // How many webContents there are (a page's process gone with its own).
    webContents: () => electron.webContents.getAllWebContents().length,
    // A window given the keyboard, as the human's click gives it (helpers.ts, focusWindow waits until its page has it).
    // On macOS a click also brings the app to the front, and only the front app's windows take the keyboard.
    focus(w: electron.BrowserWindow = shell.win) {
      if (process.platform === 'darwin') electron.app.focus({ steal: true });
      w.focus(); w.webContents.focus();
    },
    // A sandboxed page: its preload's world (999, contextIsolation's) has no Node's process (Electron's tutorial/sandbox.md).
    noNode: async (wc: WebContents) => await wc.executeJavaScriptInIsolatedWorld(999, [{ code: 'typeof process' }]) === 'undefined',
    // Where an agent's hooks report (tasks.ts, env): the agent's terminal of the task, the one picks go to.
    hooksOf: (task = shell.task) => `${task.env(task.promptTarget()).KULISA_URL}/hooks`,
    // Whether a profile's page lies on its pane's box (CSS pixels of the window's page, from helpers.ts' pageBox):
    // the view is placed in window pixels, times the Kulisa zoom.
    viewOn(name: string, box: { x: number; y: number; width: number; height: number } | null) {
      const t = profile(name).get(), z = shell.win.webContents.getZoomFactor();
      const scaled = box && Object.fromEntries(Object.entries(box).map(([key, v]) => [key, Math.round(v * z)]));
      return !!box && t.view.getVisible() && JSON.stringify(t.view.getBounds()) === JSON.stringify(scaled);
    },
    // The whole window as the screen shows it, its profiles' views included (window.ts, screenshot): on macOS only with
    // the screen recording permission (docs/testing.md, On macOS), else its page alone.
    canShoot: () => process.platform !== 'darwin' || electron.systemPreferences.getMediaAccessStatus('screen') === 'granted',
    async shot(file: string, w: { win: electron.BrowserWindow; screenshot(file: string): Promise<unknown> } = shell.windows[0]) {
      if (k.canShoot()) return w.screenshot(file);
      const image = await w.win.webContents.capturePage();
      fs.writeFileSync(file, image.toPNG());
      return file;
    },
  };
  // Asked where w is (a tasks' window, Settings': app.ts, askWhich), the first window when none is named; shell.ask asks
  // through it. Answered once its dialog shows this question.
  const ask = shell.askWhich;
  shell.askWhich = (q: Question, w: AppWindow | SettingsWindow | null = shell.windows[0]) => {
    k.asked.push(q);
    const answer = ask(q, w), yes = k.answer, page = w.win.webContents;
    if (yes === null) return answer;
    const there = (js: string) => page.executeJavaScript(js);
    const shown = `document.getElementById('ask')?.dataset.state === 'open' && document.querySelector('#ask h2').textContent === ${JSON.stringify(q.message)}`;
    const until = Date.now() + 5000;
    const click = async () => {
      if (page.isDestroyed()) return;
      if (await there(shown)) return there(`[...document.querySelectorAll('#ask footer button')].find((b) => b.textContent === ${JSON.stringify(yes === 'other' ? q.other : yes ? q.ok || 'OK' : q.cancel || 'Cancel')}).click()`);
      if (Date.now() < until) setTimeout(() => void click(), 50);
    };
    void click();
    return answer;
  };
  return k;
}

export type Kulisa = ReturnType<typeof driver>;
