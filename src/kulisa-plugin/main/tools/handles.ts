// The agent's handles on the core, shared by every group of tools: profiles and tabs found as the window finds them
// (tasks.ts), and the arguments the tools take alike. How a tool is designed: ../../README.md, Tool design.
import { z } from 'zod';
import vm from 'vm';
import { refused, type Result } from '../../../shared/result.ts';
import type { Locator, Page } from 'playwright-core';
import type { TaskAccess as Task, TerminalAccess as TaskTerminal } from '../core.ts';
import type { TabAccess as Tab } from '../core.ts';

type Element = { ref?: string; locator?: string };

// task: the task (tasks.ts) whose profiles the tools act on; t: the agent's terminal, when it came by its own URL.
function handles(task: Task, t: TaskTerminal | null) {
  // Profiles can be created while the agent runs, so this is a string checked at call time, not an enum.
  const closed = [...task.closed.values()].map(({ cfg }) => `${cfg.name} (closed)`);
  const profileArg = z.string().describe(`The profile's name. Current: ${[...[...task.profiles.values()].map((p) => p.name), ...closed].join(', ') || 'none yet'}; call profile_list for the live list`);
  const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
  const done = <T extends object>(r: Result<T>) => { if (refused(r)) throw new Error(r.error); return r; };
  // What only automation keeps to: no agent while the human signs in. The agent names a profile; the core takes its id.
  const idOf = (name: string) => done(task.named(name)).id;
  const profileOf = (name: string) => {
    const r = task.find(idOf(name));
    if (refused(r)) throw new Error(r.closed ? `${r.error} With profile_open, if the task needs it.` : r.error);
    if (r.profile.signinMode) throw new Error(`Profile "${r.profile.name}" is in sign-in mode: the human is signing in. Wait and try again later.`);
    return r.profile;
  };
  const tabOf = (name: string, tabId?: string) => done(task.findTab(profileOf(name).id, tabId));
  // A page showing a dialog is still until it is answered (Profile._dialog): acting on it would wait for nothing.
  const pageOf = (name: string, tabId?: string) => {
    const { profile, tab } = tabOf(name, tabId);
    if (tab.dialog) throw new Error(`Tab ${tab.id} of ${profile.name} shows a ${tab.dialog.type} ("${tab.dialog.message}") for the human to answer; until then its page does nothing. Ask the human, or wait and try again.`);
    return profile.page(tab.id);
  };
  // The element for a ref or a locator. Waits a second for it to appear, then fails with what to do instead:
  // a guessed name ("New chat" for "New message") would otherwise cost the agent the action's full timeout.
  const locate = (page: Page, { ref, locator }: Element): Locator => {
    if (ref) return page.locator(`aria-ref=${ref}`);
    if (!locator) throw new Error('pass ref (from browser_snapshot) or locator');
    // A Playwright locator expression as the picker prints it, e.g. getByRole('button', { name: 'Pay now' }).
    if (!/^(getBy\w+|locator)\(/.test(locator)) throw new Error("Pass a full Playwright locator expression, e.g. locator('button') or getByRole('button', { name: 'Save' }). Copy the expression from Pick unchanged; do not extract the CSS selector.");
    return vm.runInNewContext(`page.${locator}`, { page }, { timeout: 100 });
  };
  const target = async (page: Page, { ref, locator }: Element) => {
    const loc = locate(page, { ref, locator });
    try { await loc.first().waitFor({ state: 'attached', timeout: 1000 }); } catch {
      throw new Error(`No element matches ${locator || `ref ${ref}`} on ${page.url()}. Call browser_snapshot and use a ref from it.`);
    }
    return loc;
  };
  const element = { ref: z.string().optional(), locator: z.string().optional().describe("Full Playwright locator expression, e.g. locator('button') or getByRole('button', { name: 'Save' }). Copy the expression from Pick unchanged; do not extract the CSS selector.") };
  // Dialogs (alert, confirm; Electron shows no prompt()) an action of the agent opens are answered as it asks, else
  // dismissed, which is safe: the agent reads what was asked and can repeat the action with accept. The tab answers
  // them (Profile._dialog); others stay for the human, in the pane.
  const dialogArg = z.enum(['accept', 'dismiss']).optional().describe('How to answer a dialog (confirm, alert) this opens; default dismiss');
  const answering = async (tab: Tab, dialog: 'accept' | 'dismiss' = 'dismiss', act: () => Promise<unknown>) => {
    const asked: string[] = [];
    tab.agentDialogs = { accept: dialog === 'accept', asked };
    try { await act(); } finally { tab.agentDialogs = undefined; }
    return asked.length ? ` The page asked: ${asked.join(', ')}; ${dialog}ed.` : '';
  };
  // Other tools act on the profile's active tab, or on the tab they are given.
  const tabArg = z.string().describe('Tab id from profile_list');
  const onTab = z.string().optional().describe('Tab id (from profile_list or a [kulisa pick: …] reference); default: the active tab');
  return { task, t, profileArg, text, done, idOf, profileOf, tabOf, pageOf, locate, target, element, dialogArg, answering, tabArg, onTab };
}

type Handles = ReturnType<typeof handles>;

export { handles };
export type { Handles };
