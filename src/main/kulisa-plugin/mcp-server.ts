// Kulisa's MCP server for the agent. Every tool takes `profile`; implemented with playwright-core through the
// CDP proxy, so every action also reaches the pane's caption and action annotations (ghost.ts).
// Streamable HTTP, one URL per task: http://127.0.0.1:<port>/task/<project>/<n>/mcp (the parts
// percent-encoded); its agents see that task's profiles only. Each agent's terminal has its own under it
// (/task/<project>/<n>/t/<id>/mcp), the same tools and its own tab to name. Stateless (a new server per request).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import http from 'http';
import path from 'path';
import vm from 'vm';
import { handleHookRequest, taskContext, unnamed, ONLY_BROWSER } from './agent-hooks.ts';
import { historyPart } from './history.ts';
import { fromLocalTool } from '../local-only.ts';
import { toUrl } from '../profiles.ts';
import { MARK } from './ghost.ts';
import pkg from '../../../package.json' with { type: 'json' };
import { refused } from '../../shared/result.ts';
import type { AddressInfo } from 'net';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Locator, Page } from 'playwright-core';
import type { Shell } from '../shell.ts';
import type { Task, TaskTerminal } from '../tasks.ts';
import { bare, log, summary } from '../log.ts';
import type { Tab } from '../profiles.ts';

type Element = { ref?: string; locator?: string };

// What an agent can read back of a shell (terminal_read; terminalTail in terminal.ts): its last lines as the screen shows them, kept
// by a terminal without a window (xterm's own parser), so lines a program redraws in place (a progress, a container's
// state) are what they became; the output with its codes left out had every frame. Its scrollback is what the agent
// may ask for at most: the memory is lines × columns × 12 bytes (about 1 MB at 200 columns). Its buffer is a proposed
// API in the headless build (allowProposedApi), the one xterm's serialize addon reads too.
const READ_MAX = 500;

// The agent's highlights per profile (by '<task>/<profile id>'): { disposables, tab, onInput }; kept across MCP
// requests (a server is built per request). They go when replaced, cleared, or on the first click or key press in
// that tab.
const highlights = new Map<string, { disposables: AsyncDisposable[]; tab: Tab; onInput: (e: Electron.Event, input: Electron.InputEvent) => void }>();
async function clearHighlights(profile: string) {
  const h = highlights.get(profile); if (!h) return;
  highlights.delete(profile);
  if (!h.tab.wc.isDestroyed()) h.tab.wc.off('input-event', h.onInput);
  for (const d of h.disposables) await Promise.resolve(d[Symbol.asyncDispose]()).catch(() => {});
}

// profile_ask_signin's requests per profile ('<task>/<profile id>'): { at, page, wentIn }, kept across calls.
const signinAsks = new Map<string, { at: number; page: string; wentIn: boolean }>();
const pageKey = (u: string) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return u; } };

// For every agent, those without the profiles skill too (one run by hand): what it must know before the first call.
// browser_type: a text longer than this is filled at once, not typed key by key.
const TYPED_MAX = 300;
const INSTRUCTIONS = 'Kulisa profiles are the users of the app under test, each a browser profile the human signed in to by hand. ' +
  ONLY_BROWSER + ' ' +
  'Choose a profile by its description (profile_list), not by guessing from its name: when no description tells ' +
  'which profile a task means, or several do, ask the human once and save their answer with profile_describe. ' +
  'Never sign in to a real account, type its password or a one-time code, or read cookies or tokens: ask the human ' +
  'with profile_ask_signin. A test user of the app under test on this computer with a saved pair (testLogin in ' +
  'profile_list) you sign in to yourself, with browser_type_login (you never see its password). ' +
  'Run what keeps running (the app\'s dev server, docker compose up, a watcher) with terminal_run, not in your own ' +
  'shell or its background: the human sees it in a terminal next to yours, and you read its output with terminal_read. ' +
  'What was said and done in this task, by you or other agents (each conversation an agent had in it), is in ' +
  'task_history: read the one the human points you to ("go on with what Claude did") before anything else, and read ' +
  'yours when you need details your context lost. Name your conversation with conversation_rename once you know what ' +
  'it is about.';
// The naming tools load with the session (Claude Code's alwaysLoad; other agents ignore _meta): deferred behind its
// tool search, as every MCP tool is, the agent skipped the extra step and never named the task when the reply was text
// only (a task of the author's, 2026-10-12, told at both prompts).
const UPFRONT = { 'anthropic/alwaysLoad': true };
// task: the task (tasks.ts) whose profiles the tools act on; t: the agent's terminal, when it came by its own URL.
function buildServer(task: Task, t: TaskTerminal | null) {
  const server = new McpServer({ name: 'kulisa', version: pkg.version }, { instructions: `${INSTRUCTIONS} ${taskContext(task)}` });
  // Profiles can be created while the agent runs, so this is a string checked at call time, not an enum.
  const closed = [...task.closed.values()].map(({ cfg }) => `${cfg.id} (${cfg.name}, closed)`);
  const profileArg = z.string().describe(`Profile id. Current: ${[...[...task.profiles.values()].map((p) => `${p.id} (${p.name})`), ...closed].join(', ') || 'none yet'}; call profile_list for the live list`);
  const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
  // Every tool's result in an unnamed task says so: the prompt hook does (agent-hooks.ts), but not for an agent without
  // hooks or whose hooks the human has not trusted (Codex).
  type Handler = (...a: unknown[]) => Promise<CallToolResult>;
  const register = server.registerTool.bind(server) as unknown as (name: string, config: object, cb: Handler) => unknown;
  server.registerTool = ((name: string, config: object, cb: Handler) => register(name, config, async (...a) => {
    log.info(`[mcp] ${name} ${task.key}${t ? `#${t.id}` : ''} ${summary(a[0])}`);
    let r: CallToolResult;
    try { r = await cb(...a); } catch (e) { log.info(`[mcp] ${name} failed: ${bare((e as Error).message)}`); throw e; }
    if (task.unnamed && name !== 'task_rename') r.content.push({ type: 'text', text: unnamed(task) });
    return r;
  })) as unknown as typeof server.registerTool;
  // The agent's handles on the core: profiles and tabs found as the window finds them (tasks.ts), plus what only
  // automation keeps to: no agent while the human signs in.
  const profileOf = (id: string) => {
    const r = task.find(id);
    if (refused(r)) throw new Error(r.closed ? `${r.error} With profile_open, if the task needs it.` : r.error);
    if (r.profile.signinMode) throw new Error(`Profile "${id}" is in sign-in mode: the human is signing in. Wait and try again later.`);
    return r.profile;
  };
  const tabOf = (id: string, tabId?: string) => {
    profileOf(id);
    const r = task.findTab(id, tabId);
    if (refused(r)) throw new Error(r.error);
    return r;
  };
  // A page showing a dialog is still until it is answered (Profile._dialog): acting on it would wait for nothing.
  const pageOf = (id: string, tabId?: string) => {
    const { profile, tab } = tabOf(id, tabId);
    if (tab.dialog) throw new Error(`Tab ${tab.id} of ${id} shows a ${tab.dialog.type} ("${tab.dialog.message}") for the human to answer; until then its page does nothing. Ask the human, or wait and try again.`);
    return profile.page(tab.id);
  };
  // The element for a ref or a locator. Waits a second for it to appear, then fails with what to do instead:
  // a guessed name ("New chat" for "New message") would otherwise cost the agent the action's full timeout.
  const locate = (page: Page, { ref, locator }: Element): Locator => {
    if (ref) return page.locator(`aria-ref=${ref}`);
    if (!locator) throw new Error('pass ref (from browser_snapshot) or locator');
    // A Playwright locator expression as the picker prints it, e.g. getByRole('button', { name: 'Pay now' }).
    if (!/^(getBy\w+|locator)\(/.test(locator)) throw new Error('locator must start with getBy*( or locator(');
    return vm.runInNewContext(`page.${locator}`, { page }, { timeout: 100 });
  };
  const target = async (page: Page, { ref, locator }: Element) => {
    const loc = locate(page, { ref, locator });
    try { await loc.first().waitFor({ state: 'attached', timeout: 1000 }); } catch {
      throw new Error(`No element matches ${locator || `ref ${ref}`} on ${page.url()}. Call browser_snapshot and use a ref from it.`);
    }
    return loc;
  };
  const element = { ref: z.string().optional(), locator: z.string().optional() };
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

  // description: who the profile is (the human's words), or not said; avatar: its picture, which the human knows the
  // pane by ("the fox").
  server.registerTool('profile_list', { description: 'List profiles: id, name, description (who it is in the app; null: not said, ask the human), picture (avatar), whether the human is signing in (signinMode), tabs; closed ones (closed: true) need profile_open first.', inputSchema: {} },
    async () => text(JSON.stringify([
      ...[...task.profiles.values()].map(({ id, name, description, avatar, login, hasPassword, signinMode, active, tabs }) =>
        ({ id, name, description: description || null, avatar, ...(login && { testLogin: login, testPassword: hasPassword }), signinMode, active,
          tabs: tabs.filter((t) => t.discarded || !t.wc.isDestroyed()).map((t) => ({ id: t.id, title: t.title, url: t.url })) })),
      ...[...task.closed.values()].map(({ cfg, urls }) => ({ id: cfg.id, name: cfg.name, description: cfg.description || null, avatar: cfg.avatar,
        ...(cfg.login && { testLogin: cfg.login, testPassword: cfg.hasPassword }),
        closed: true, tabs: urls.length })),
    ], null, 1)));

  server.registerTool('profile_open', {
    description: 'Open a closed profile: its pane comes back with its tabs, still signed in. Costs memory: open one only when the task needs it.',
    inputSchema: { profile: z.string().describe('Id of a closed profile (profile_list)') },
  }, async ({ profile }) => {
    const r = await task.openProfile(profile);
    if (refused(r)) throw new Error(`${r.error}. Profiles: ${[...task.profiles.keys(), ...task.closed.keys()].join(', ')}`);
    const page = await pageOf(profile); // its active tab loaded, for the next snapshot
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return text(`Profile ${profile} is open, with ${task.profiles.get(profile)!.tabs.length} tab(s); active: ${page.url()}`);
  });
  server.registerTool('profile_close', {
    description: "Close a profile: its pane and tabs go and free their memory; it stays signed in, and profile_open brings it back with the same tabs. Close profiles you opened when you are done with them, others only when the human asks.",
    inputSchema: { profile: z.string().describe('Id of an open profile') },
  }, async ({ profile }) => {
    const r = await task.closeProfile(profile);
    if (refused(r)) throw new Error(r.error);
    return text(`Closed profile ${profile}; it is still signed in.`);
  });
  server.registerTool('profile_delete', {
    description: "Remove a profile from this project: its copies in the project's tasks go (their tabs, and what was signed in only there); the profile itself stays, with its sign-ins, in Kulisa's Settings → Profiles, where only the human deletes profiles. The human is asked to confirm. Only when the human asks, or a profile you created is no longer needed.",
    inputSchema: { profile: z.string().describe('Profile id, open or closed') },
  }, async ({ profile }) => {
    const r = await task.deleteProfile(profile, 'agent');
    if (refused(r)) throw new Error(r.error);
    return text(`Removed profile ${profile} from the project; it stays in Settings → Profiles.`);
  });

  server.registerTool('profile_create', {
    description: 'Create a new, empty profile (a separate browser profile with its own pane) for a user the task needs and no profile has. The human then signs it in by hand. Costs memory: reuse a profile when one fits.',
    inputSchema: {
      name: z.string().describe('Who this profile is: letters, digits and @ . _ + - only, e.g. "ann@shop.com" (the account it signs in to) or "ann.admin"'),
      description: z.string().optional().describe('As in profile_describe: only what the human said'),
    },
  }, async ({ name, description }) => {
    const r = await task.createProfile(name, description);
    if (refused(r)) throw new Error(r.error);
    return text(`Created profile ${r.id} ("${name}"). It is signed out: ask the human to sign it in (profile_ask_signin).`);
  });

  server.registerTool('profile_rename', {
    description: 'Rename a profile, e.g. after the human signed it in to another account. Its id follows the name.',
    inputSchema: { profile: profileArg, name: z.string().describe('As in profile_create') },
  }, async ({ profile, name }) => {
    const r = task.renameProfile(profile, name);
    if (refused(r)) throw new Error(r.error);
    return text(`Renamed ${profile} to "${name.trim()}"; its id is now ${r.id}.`);
  });

  server.registerTool('task_rename', {
    description: 'Rename your Kulisa task once you know what it is about (it starts as task-<n>), silently: never ask the human for a name or mention it. Its name on its tab changes, and its git branch, which takes the name. Its folder stays. Letters, digits and @ . _ + -, no spaces, e.g. checkout-redesign.',
    inputSchema: { name: z.string().describe('The new name, e.g. checkout-redesign') },
    _meta: UPFRONT,
  }, async ({ name }) => {
    const r = await task.rename(name);
    if (refused(r)) throw new Error(r.error);
    return text(`The task is now "${r.name}"${r.branch ? `, on branch ${r.branch}` : ''}.`);
  });

  server.registerTool('task_add_repository', {
    description: "Add another of the project's repositories to this task, to change it: a copy (git worktree) on the task's branch. Only after the human has agreed in the conversation: ask them first, saying why the task needs it. To read a repository you need no copy: read it in the project's folder, changing nothing there.",
    inputSchema: { repository: z.string().describe("The repository's folder or name, as the instructions list the ones the task may add") },
  }, async ({ repository }) => {
    const r = await task.addRepository(repository);
    if (refused(r)) throw new Error(r.error);
    return text(`Added: ${r.folder}, on branch ${r.branch}; make your changes there. Kulisa gives you the folder as a working one (at once for some agents, once your turn is over for others); until then your changes there may ask for the human's permission.`);
  });

  server.registerTool('task_remove_repository', {
    description: "Remove a repository added to this task (task_add_repository) that it no longer needs: its copy's folder and branch are deleted. Only after the human has agreed in the conversation: ask them first. Not the task's own folder, where you work. When the copy holds commits not pushed or uncommitted files, Kulisa asks the human too.",
    inputSchema: { repository: z.string().describe("The repository's folder or name, or its copy's folder, as the instructions list the task's folders") },
  }, async ({ repository }) => {
    const r = await task.removeRepository(repository);
    if (refused(r)) throw new Error(r.error);
    return text(`Removed: ${r.folder} and its branch are gone; work no more there.`);
  });

  server.registerTool('task_history', {
    description: "The history of this task. Without a conversation: where it stands (its code in git, profiles, terminals) and its conversations, each an agent's, numbered, with its tab's name, open or closed, when, its first and last request. With a conversation's number: that conversation whole, what the human asked and the agent did, read from its transcript, the latest chapter first. When the human asks you to go on with another agent's work, find its conversation here and read every part of it before anything else. Also when you need details your context lost. Call with part 1, then the next ones up to the total it says.",
    inputSchema: {
      conversation: z.number().int().min(1).optional().describe('Which conversation, by its number in the list'),
      part: z.number().int().min(1).optional().describe('Which part, from 1 (the default)'),
    },
  }, async ({ conversation, part = 1 }) => {
    const r = await historyPart(task, part, conversation);
    if (refused(r)) throw new Error(r.error);
    if (t && conversation) task.historyRead(t, conversation, part, r.parts);
    return text(r.text);
  });

  if (t?.agent) {
    server.registerTool('conversation_rename', {
      description: 'Name your conversation in 1 to 3 words once you know what it is about, e.g. "Checkout discounts": the name of your tab in Kulisa, by which the human and other agents tell it from the others (task_history lists it so). Name it again when the work turns to something else.',
      inputSchema: { name: z.string().describe('1 to 3 words') },
      _meta: UPFRONT,
    }, async ({ name }) => {
      const r = task.nameConversation(t, name);
      if (refused(r)) throw new Error(r.error);
      return text(`Your conversation is now "${r.name}".`);
    });
  }

  server.registerTool('profile_describe', {
    description: "Save who a profile is in the app under test (its role, what it can do), which agents choose profiles by. Only the human's words: when no description tells which profile a task means, ask the human, then save their answer. An empty description clears it.",
    inputSchema: { profile: profileArg, description: z.string().describe('e.g. "seller in the Acme shop; can approve refunds"') },
  }, async ({ profile, description }) => {
    const r = task.describeProfile(profile, description);
    if (refused(r)) throw new Error(r.error);
    return text(description.trim() ? `Saved: ${profile} is "${description.trim()}".` : `Cleared ${profile}'s description.`);
  });

  // Tabs. Other tools act on the profile's active tab, or on the tab they are given; these open, switch and close tabs.
  const tabArg = z.string().describe('Tab id from profile_list');
  const onTab = z.string().optional().describe('Tab id (from profile_list or a [kulisa pick: …] reference); default: the active tab');
  server.registerTool('browser_tab_new', {
    description: "Open a URL in a new tab of the profile and make it the active tab. Use it instead of browser_navigate to keep the page the human has open.",
    inputSchema: { profile: profileArg, url: z.string() },
  }, async ({ profile, url }) => {
    const p = profileOf(profile);
    const tab = p.newTab(url);
    await tab.ready;
    const page = await p.page(tab.id);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return text(`Opened tab ${tab.id} in ${profile}: ${page.url()} — "${await page.title()}"`);
  });
  server.registerTool('browser_tab_select', { description: 'Make a tab the active one in its profile (the pane shows it; other tools act on it).', inputSchema: { profile: profileArg, tab: tabArg } },
    async ({ profile, tab }) => {
      const { profile: p, tab: t } = tabOf(profile, tab);
      p.activate(t.id);
      return text(`Active tab of ${profile}: ${t.id} ${t.url}`);
    });
  server.registerTool('browser_tab_close', { description: 'Close a tab of the profile. Close only tabs you opened, unless the human asked.', inputSchema: { profile: profileArg, tab: tabArg } },
    async ({ profile, tab }) => {
      const { profile: p, tab: t } = tabOf(profile, tab);
      p.closeTab(t.id);
      return text(`Closed tab ${tab} of ${profile}`);
    });

  // The human signs in, never the agent (CLAUDE.md, Rules): it asks, the pane shows the request, and this waits until
  // the human is through: the profile went through sign-in mode (signin-pause.ts) and left it, or its page is no
  // longer the one it was asked on. Where it was asked is kept across calls, so waiting again goes on from there.
  server.registerTool('profile_ask_signin', {
    description: 'Ask the human to sign a profile in, and wait until they have; the request shows over its pane. ' +
      "url: the app's sign-in page, opened first. Up to 45 s a call; \"not yet\": call again to keep waiting. Then check with browser_snapshot.",
    inputSchema: { profile: profileArg, url: z.string().optional(), why: z.string().optional().describe('A few words: as whom, for what') },
  }, async ({ profile, url, why }) => {
    const r = task.find(profile);
    if (refused(r)) throw new Error(r.error);
    const p = r.profile, key = `${task.key}/${profile}`;
    let ask = signinAsks.get(key);
    if (!ask || Date.now() - ask.at > 10 * 60_000) {
      if (url) {
        // The window's way, not Playwright's: a sign-in page puts the profile in sign-in mode, which cuts Playwright off.
        const wc = p.get()!.wc;
        p.navigate(undefined, url);
        await new Promise<void>((ok) => { wc.once('did-stop-loading', () => ok()); setTimeout(ok, 10_000); });
      }
      ask = { at: Date.now(), page: pageKey(p.get()!.wc.getURL()), wentIn: p.signinMode };
      signinAsks.set(key, ask);
    }
    task.caption(profile, `sign in, please${why ? `: ${why}` : ''}`, true);
    for (const until = Date.now() + 45_000; Date.now() < until; await new Promise((ok) => setTimeout(ok, 300))) {
      if (p.deleted) throw new Error(`Profile ${profile} was deleted.`);
      if (p.signinMode || p.resuming) { ask.wentIn = true; continue; }
      if (ask.wentIn || pageKey(p.get()!.wc.getURL()) !== ask.page) {
        signinAsks.delete(key);
        task.caption(profile, '');
        return text(`The human is through: ${profile} is at ${p.get()!.wc.getURL()}. Check with browser_snapshot that it is signed in.`);
      }
    }
    return text(`Not yet: ${profile} is still at ${p.get()!.wc.getURL()}. Call profile_ask_signin again to keep waiting, or go on with something else.`);
  });

  // Show the human what the agent means: Playwright's own highlight (locator.highlight(): an outline in the page
  // that follows the element; under it Playwright shows the locator). The labels go to the pane's caption.
  // Replaces the profile's previous highlights; they stay until replaced or cleared.
  server.registerTool('browser_highlight', {
    description: "Point the human at elements on a profile's tab (default: the active one): outline them in the page; the labels show over the pane. " +
      'Use when the human asks where something is, or to show what you mean, found or changed. Replaces this profile\'s previous highlights; an empty list clears them.',
    inputSchema: {
      profile: profileArg, tab: onTab,
      elements: z.array(z.object({
        ref: z.string().optional(), locator: z.string().optional(),
        label: z.string().optional().describe('A few words about the element'),
      })).describe('Elements by ref (from browser_snapshot) or Playwright locator'),
    },
  }, async ({ profile, tab: tabId, elements }) => {
    const page = await pageOf(profile, tabId);
    const hkey = `${task.key}/${profile}`;
    await clearHighlights(hkey);
    const shown: AsyncDisposable[] = [];
    for (const el of elements) {
      let loc = await target(page, el);
      if (await loc.count() > 1) loc = loc.first();
      await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
      shown.push(await loc.highlight({ style: { outline: `3px solid ${MARK}`, outlineOffset: '2px' } }));
    }
    if (shown.length) {
      const { tab } = tabOf(profile, tabId);
      const onInput = (_e: Electron.Event, input: Electron.InputEvent) => {
        if (!['mouseDown', 'keyDown', 'rawKeyDown'].includes(input.type)) return;
        void clearHighlights(hkey); task.caption(profile, '');
      };
      tab.wc.on('input-event', onInput);
      highlights.set(hkey, { disposables: shown, tab, onInput });
    }
    task.caption(profile, elements.length ? `points at: ${elements.map((e, i) => e.label || `${i + 1}`).join(' · ')}` : '', elements.length > 0);
    return text(elements.length ? `Highlighted ${elements.length} element(s) in ${profile}` : `Cleared highlights in ${profile}`);
  });

  // As the human's address bar (Profile.navigate), but through Playwright, as everything the agent does in a page: the
  // human sees it (ghost.ts), and the sign-in pause holds (CLAUDE.md, Architecture).
  server.registerTool('browser_navigate', {
    description: "Navigate the profile's active tab to a URL, or go back, forward, or reload it.",
    inputSchema: { profile: profileArg, url: z.string().optional(), go: z.enum(['back', 'forward', 'reload']).optional().describe('Instead of url'), dialog: dialogArg },
  }, async ({ profile, url, go, dialog }) => {
    if (!url === !go) throw new Error('pass url or go');
    const page = await pageOf(profile);
    const { tab } = tabOf(profile), history = tab.wc.navigationHistory;
    if (go === 'back' ? !history.canGoBack() : go === 'forward' && !history.canGoForward()) return text(`Nowhere to go ${go} in ${profile}'s tab; still at ${page.url()}.`);
    const said = await answering(tab, dialog, async () => {
      const opts = { waitUntil: 'domcontentloaded' as const };
      await (url ? page.goto(toUrl(url), opts) : go === 'back' ? page.goBack(opts) : go === 'forward' ? page.goForward(opts) : page.reload(opts));
    });
    return text(`${go ? `Went ${go}` : 'Navigated'}: ${profile} is at ${page.url()} — "${await page.title()}".${said}`);
  });

  server.registerTool('browser_snapshot', {
    description: "Accessibility snapshot of a profile's tab (default: the active one), with [ref=eN] for click/type.",
    inputSchema: { profile: profileArg, tab: onTab, also: z.array(z.string()).optional().describe("More profile ids: their active tabs too, in one call, e.g. to compare what each user sees") },
  }, async ({ profile, tab, also = [] }) => {
    const snap = async (id: string, tabId?: string) => {
      const page = await pageOf(id, tabId);
      return `- Profile: ${id}\n- URL: ${page.url()}\n- Title: ${await page.title()}\n\n${await page.ariaSnapshot({ mode: 'ai' })}`;
    };
    if (!also.length) return text(await snap(profile, tab));
    // One profile that cannot be read (signing in, closed) does not hide the others.
    const parts = await Promise.all([[profile, tab] as const, ...also.map((id) => [id, undefined as string | undefined] as const)].map(([id, t]) => snap(id, t).catch((e: Error) => `- Profile: ${id}\n- ${e.message}`)));
    return text(parts.join('\n\n'));
  });

  server.registerTool('browser_click', { description: 'Click an element by ref (from browser_snapshot) or by a Playwright locator like getByRole(\'button\', { name: \'Pay now\' }).',
    inputSchema: { profile: profileArg, tab: onTab, ...element, dialog: dialogArg } },
  async ({ profile, tab, ref, locator, dialog }) => {
    const page = await pageOf(profile, tab);
    const loc = await target(page, { ref, locator });
    const said = await answering(tabOf(profile, tab).tab, dialog, async () => {
      await loc.click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });
    return text(`Clicked ${locator || ref} as ${profile}. Now at ${page.url()}.${said}`);
  });

  server.registerTool('browser_type', { description: 'Type text into an element by ref or locator, replacing what it holds, key by key as a person types (a long text at once); submit presses Enter.',
    inputSchema: { profile: profileArg, tab: onTab, ...element, text: z.string(), submit: z.boolean().optional(), dialog: dialogArg } },
  async ({ profile, tab, ref, locator, text: value, submit, dialog }) => {
    const page = await pageOf(profile, tab);
    const loc = await target(page, { ref, locator });
    // Key by key, so the human sees it typed and the page gets the keys a person's typing sends (suggestions,
    // checks as one types): 40 ms a key, faster for a longer text, about 1.5 s at most; a long one (a pasted
    // paragraph) filled at once.
    await loc.fill(value.length > TYPED_MAX ? value : '', { timeout: 5000 });
    if (value && value.length <= TYPED_MAX) await loc.pressSequentially(value, { delay: Math.min(40, 1500 / value.length), timeout: 15000 });
    const said = submit ? await answering(tabOf(profile, tab).tab, dialog, () => loc.press('Enter')) : '';
    return text(`Typed into ${locator || ref} as ${profile}.${said}`);
  });

  // A test user's sign-in (profiles.md, "Test users' sign-ins"): its saved login or password typed by Kulisa into a field
  // of a local page; the agent never gets the password, the pane's caption shows dots. Real accounts stay the human's.
  server.registerTool('browser_type_login', {
    description: "Type a test user's saved login or password into a field (by ref or locator), replacing what it holds, to sign in to the app under test: only on a local page (localhost, *.test, a private network, the project's own list) or one the tab reached from it, never on Google, Microsoft or another account provider. You never see the password. The pair is saved by the human (Settings → Profiles) or by you (profile_set_login).",
    inputSchema: { profile: profileArg, tab: onTab, ...element, field: z.enum(['login', 'password']), submit: z.boolean().optional(), dialog: dialogArg },
  }, async ({ profile, tab, ref, locator, field, submit, dialog }) => {
    const r = task.loginFor(profile, tab, field);
    if (refused(r)) throw new Error(r.error);
    const page = await pageOf(profile, tab);
    const loc = await target(page, { ref, locator });
    const key = `${task.key}/${r.profile.id}`;
    task.shell.typingSecret.add(key);
    try { await loc.fill(r.value, { timeout: 5000 }); } finally { task.shell.typingSecret.delete(key); }
    const said = submit ? await answering(r.tab, dialog, () => loc.press('Enter')) : '';
    return text(`Typed ${r.profile.name}'s ${field} into ${locator || ref}.${said}`);
  });
  server.registerTool('profile_set_login', {
    description: "Save a test user's login-password pair for a profile, e.g. after you signed that user up in the app under test, so you (and later tasks) sign in with browser_type_login. Only for test users of the app on this computer: never a real account's password.",
    inputSchema: { profile: profileArg, login: z.string().describe('The user name or email'), password: z.string() },
  }, async ({ profile, login, password }) => {
    const r = task.setLogin(profile, login, password);
    if (refused(r)) throw new Error(r.error);
    return text(`Saved ${profile}'s test login ${login.trim()}; its password is kept encrypted.`);
  });

  server.registerTool('browser_press_key', {
    description: "Press a key or a combination (Escape, Tab, ArrowDown, Control+A) in a profile's tab: on an element by ref or locator, else on the focused one.",
    inputSchema: { profile: profileArg, tab: onTab, key: z.string(), ...element, dialog: dialogArg },
  }, async ({ profile, tab, key, ref, locator, dialog }) => {
    const page = await pageOf(profile, tab);
    const loc = ref || locator ? await target(page, { ref, locator }) : null;
    const said = await answering(tabOf(profile, tab).tab, dialog, () => (loc ? loc.first().press(key, { timeout: 5000 }) : page.keyboard.press(key)));
    return text(`Pressed ${key} as ${profile}.${said}`);
  });

  server.registerTool('browser_hover', { description: 'Move the pointer over an element (menus, tooltips) by ref or locator.', inputSchema: { profile: profileArg, tab: onTab, ...element } },
    async ({ profile, tab, ref, locator }) => {
      const page = await pageOf(profile, tab);
      await (await target(page, { ref, locator })).first().hover({ timeout: 5000 });
      return text(`Hovered ${locator || ref} as ${profile}`);
    });

  server.registerTool('browser_select_option', {
    description: 'Choose options in a <select> by ref or locator, by their value or label.',
    inputSchema: { profile: profileArg, tab: onTab, ...element, values: z.array(z.string()) },
  }, async ({ profile, tab, ref, locator, values }) => {
    const page = await pageOf(profile, tab);
    const chosen = await (await target(page, { ref, locator })).first().selectOption(values, { timeout: 5000 });
    return text(`Selected ${chosen.join(', ')} in ${locator || ref} as ${profile}`);
  });

  server.registerTool('browser_file_upload', {
    description: 'Give files to a file input, or to the button that opens a file chooser, by ref or locator.',
    inputSchema: { profile: profileArg, tab: onTab, ...element, paths: z.array(z.string()).describe('Absolute paths of files on this computer') },
  }, async ({ profile, tab, ref, locator, paths }) => {
    if (!paths.every((f) => path.isAbsolute(f))) throw new Error('paths must be absolute');
    const page = await pageOf(profile, tab);
    const el = (await target(page, { ref, locator })).first();
    if (await el.evaluate((e) => e instanceof HTMLInputElement && e.type === 'file')) await el.setInputFiles(paths, { timeout: 5000 });
    else {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), el.click({ timeout: 5000 })]);
      await chooser.setFiles(paths);
    }
    return text(`Gave ${paths.map((f) => path.basename(f)).join(', ')} to ${locator || ref} as ${profile}`);
  });

  // Waiting in one profile for what another one did is the point of Kulisa (several users at once). At most 45 s a
  // call: Codex gives an MCP tool 60 s.
  server.registerTool('browser_wait_for', {
    description: "Wait until text (or an element) appears on, or text is gone from, a profile's tab (default: the active one). " +
      'Act as one profile and wait here to see the effect as another (a message, an invite). Up to 45 s a call; call again to wait longer.',
    inputSchema: {
      profile: profileArg, tab: onTab, text: z.string().optional(), textGone: z.string().optional(), ...element,
      seconds: z.number().positive().max(45).optional().describe('Default 10'),
    },
  }, async ({ profile, tab, text: shows, textGone, ref, locator, seconds = 10 }) => {
    const page = await pageOf(profile, tab);
    const what = shows ?? textGone ?? locator ?? ref;
    if (what === undefined) throw new Error('pass text, textGone, ref or locator');
    const loc = textGone !== undefined ? page.getByText(textGone) : shows !== undefined ? page.getByText(shows) : locate(page, { ref, locator });
    const until = Date.now() + seconds * 1000;
    try {
      if (textGone !== undefined) {
        while (await loc.count()) { if (Date.now() > until) throw new Error(); await page.waitForTimeout(200); }
      } else await loc.first().waitFor({ state: 'visible', timeout: seconds * 1000 });
    } catch {
      throw new Error(`After ${seconds} s, "${what}" is ${textGone !== undefined ? 'still there' : 'not there'} in ${profile}'s tab ${page.url()}.`);
    }
    return text(`"${what}" is ${textGone !== undefined ? 'gone' : 'there'} in ${profile}'s tab ${page.url()}`);
  });

  server.registerTool('browser_evaluate', {
    description: "Run a JavaScript function in a profile's tab and get its result as JSON: () => document.title, or (el) => el.value with ref or locator. " +
      'For what the other tools do not do; never to read cookies, tokens or passwords.',
    inputSchema: { profile: profileArg, tab: onTab, function: z.string(), ...element },
  }, async ({ profile, tab, function: fn, ref, locator }) => {
    const page = await pageOf(profile, tab);
    const el = ref || locator ? await (await target(page, { ref, locator })).first().elementHandle({ timeout: 5000 }) : null;
    // The function made in the page (no eval here; CDP's evaluation is not held to the page's CSP), called there.
    const f = await page.evaluateHandle(`(${fn})`);
    let result: unknown;
    try { result = await f.evaluate((f, el) => (f as (el: unknown) => unknown)(el), el); } finally { void f.dispose(); void el?.dispose(); }
    return text(result === undefined ? 'undefined' : JSON.stringify(result, null, 1) ?? String(result));
  });

  server.registerTool('browser_screenshot', { description: "Screenshot of a profile's tab (default: the active one).", inputSchema: { profile: profileArg, tab: onTab } },
    async ({ profile, tab }) => {
      const page = await pageOf(profile, tab);
      const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
      return { content: [{ type: 'image', data: buf.toString('base64'), mimeType: 'image/jpeg' }] };
    });

  // What a tab reported recently, as Playwright keeps it for every page of the shell's connection (the last ones,
  // since the connection was made: after a sign-in pause, only what came after it).
  const clip = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n)}…` : s);
  server.registerTool('browser_console_messages', {
    description: "Recent console messages and uncaught errors of a profile's tab (default: the active one). Look here when something on the page does not work.",
    inputSchema: { profile: profileArg, tab: onTab, onlyErrors: z.boolean().optional().describe('Errors and warnings only') },
  }, async ({ profile, tab, onlyErrors }) => {
    const page = await pageOf(profile, tab);
    const lines = [
      ...(await page.consoleMessages()).filter((m) => !onlyErrors || ['error', 'warning'].includes(m.type())).map((m) => `${m.type()}: ${clip(m.text())}`),
      ...(await page.pageErrors()).map((e) => `uncaught: ${clip(String(e.stack || e), 1000)}`),
    ].slice(-100);
    return text(lines.length ? lines.join('\n') : `No ${onlyErrors ? 'errors' : 'console messages'} in ${profile}'s tab ${page.url()}`);
  });
  server.registerTool('browser_network_requests', {
    description: "Recent network requests of a profile's tab (default: the active one): method, URL, status or failure.",
    inputSchema: { profile: profileArg, tab: onTab, onlyFailed: z.boolean().optional().describe('Failed requests and HTTP errors (4xx, 5xx) only') },
  }, async ({ profile, tab, onlyFailed }) => {
    const page = await pageOf(profile, tab);
    const lines: string[] = [];
    for (const r of await page.requests()) {
      const failure = r.failure()?.errorText;
      const status = failure ? null : (await r.response().catch((): null => null))?.status();
      if (!onlyFailed || failure || (status ?? 0) >= 400) lines.push(`${r.method()} ${clip(r.url())} → ${failure || status || 'pending'}`);
    }
    return text(lines.length ? lines.slice(-100).join('\n') : `No ${onlyFailed ? 'failed ' : ''}requests in ${profile}'s tab ${page.url()}`);
  });

  // Shells next to the agent's terminal (Task.openTerminal): what keeps running, where the human sees it.
  const done = <T extends object>(r: import('../../shared/result.ts').Result<T>) => { if (refused(r)) throw new Error(r.error); return r; };
  const nameArg = z.string().describe('The terminal\'s name, e.g. "dev server"');
  server.registerTool('terminal_run', {
    description: "Run a command that keeps running (the app's dev server, docker compose up, a watcher) in a terminal of its own next to yours, where the human sees it: the user's shell in the task's folder, with your environment. A terminal of that name already open gets the command typed in: stop what runs there first (terminal_stop). Then read its output with terminal_read.",
    inputSchema: { name: nameArg, command: z.string().describe('A shell command line, e.g. "npm run dev -- --port 3100"') },
  }, async ({ name, command }) => {
    const r = done(await task.runInTerminal(name, command));
    return text(`${r.again ? 'Typed into' : 'Started in'} terminal "${r.name}": ${command}. Read its output with terminal_read.`);
  });
  server.registerTool('terminal_read', {
    description: 'The last lines a terminal next to yours shows, as plain text (a server\'s errors, the address it listens on). Without a name: the terminals open.',
    inputSchema: { name: nameArg.optional(), lines: z.number().int().min(1).max(READ_MAX).optional().describe('Default 50') },
  }, async ({ name, lines }) => {
    if (!name) {
      const list = task.terminalsInfo().list.filter((x) => !x.agent);
      return text(list.length ? list.map((x) => `"${x.name}" (${x.by === 'agent' ? "an agent's" : "the human's"})${x.command ? `: ${x.command}` : ''}`).join('\n') : 'No terminals open besides the agents\'.');
    }
    return text(done(task.readTerminal(name, lines)).text || '(nothing yet)');
  });
  server.registerTool('terminal_stop', {
    description: 'Stop what runs in a terminal next to yours (Ctrl+C); close: true closes the terminal too. The human\'s own terminals: only when they ask.',
    inputSchema: { name: nameArg, close: z.boolean().optional() },
  }, async ({ name, close }) => {
    done(close ? task.closeTerminal(name) : task.interruptTerminal(name));
    return text(close ? `Closed terminal "${name}".` : `Pressed Ctrl+C in terminal "${name}".`);
  });
  return server;
}

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return ''; } };

async function startMcpServer(shell: Shell, cfg: { port?: number }) {
  // The core says when a profile is unloaded (tasks.ts) and does not reach into its agent's handle.
  shell.bus.on('profile-unloading', (key: string) => void clearHighlights(key));
  const srv = http.createServer(async (req, res) => {
    if (!fromLocalTool(req)) { res.writeHead(403); return res.end(); }
    // /task/<project>/<n>[/t/<terminal id>]/…: a task of an open project, loaded; an agent's terminal of it.
    const m = req.url!.match(/^\/task\/([^/]+)\/(\d+)(?:\/t\/(\d+))?(\/.*)$/);
    const task = m && shell.taskOf(safeDecode(m[1]!), Number(m[2]));
    if (!task?.loaded) { res.writeHead(404); return res.end(); }
    const t = (m![3] && task.terminals.get(Number(m![3]))) || null;
    if (handleHookRequest(task, t, m![4]!, req, res)) return;
    if (!m![4]!.startsWith('/mcp')) { res.writeHead(404); return res.end(); }
    // The transport reads the body itself (with a size limit) and answers a malformed one.
    const server = buildServer(task, t);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });
  await new Promise<void>((r) => srv.listen(cfg.port || 0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  console.log('[kulisa] MCP server:', `${base}/task/<project>/<n>/mcp`);
  return { base, srv };
}

export { startMcpServer, highlights, READ_MAX };
