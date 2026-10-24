// The agent's tools in a profile's pages: tabs, reading, acting, pointing, what the page reported. Through playwright-core
// over the CDP proxy, so the human sees every action (ghost.ts) and the sign-in pause holds. How a tool is designed:
// ../CLAUDE.md.
import { z } from 'zod';
import path from 'path';
import { toUrl } from '../../profiles.ts';
import { MARK } from '../ghost.ts';
import { saveArtifact } from '../artifacts.ts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConsoleMessage, Page, Request } from 'playwright-core';
import type { Tab } from '../../profiles.ts';
import type { Handles } from './handles.ts';

// The agent's highlights per profile (by '<task key>/<profile id>'): { disposables, tab, onInput }; kept across MCP
// requests (a server is built per request). They go when replaced, cleared, or on the first click or key press in
// that tab.
const highlights = new Map<string, { disposables: AsyncDisposable[]; tab: Tab; onInput: (e: Electron.Event, input: Electron.InputEvent) => void }>();
async function clearHighlights(profile: string) {
  const h = highlights.get(profile); if (!h) return;
  highlights.delete(profile);
  if (!h.tab.wc.isDestroyed()) h.tab.wc.off('input-event', h.onInput);
  for (const d of h.disposables) await Promise.resolve(d[Symbol.asyncDispose]()).catch(() => {});
}

// browser_type: a text longer than this is filled at once, not typed key by key.
const TYPED_MAX = 300;

// browser_snapshot's find: a regular expression, or the text itself when it is not one ("Pay (card)").
function patternOf(find: string) {
  try { return new RegExp(find, 'i'); } catch { return new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
}
const indent = (line: string) => line.length - line.trimStart().length;
// The snapshot's lines that match, each under its ancestors (the lines less indented above it), so the agent sees
// where it is on the page and gets its ref.
function found(yaml: string, pattern: RegExp) {
  const lines = yaml.split('\n'), keep = new Set<number>();
  lines.forEach((line, i) => {
    if (!pattern.test(line)) return;
    keep.add(i);
    for (let j = i - 1, d = indent(line); j >= 0 && d > 0; j--) if (indent(lines[j]!) < d) { keep.add(j); d = indent(lines[j]!); }
  });
  return [...keep].sort((a, b) => a - b).map((i) => lines[i]).join('\n');
}

// A snapshot or a body larger than this goes to a file (../CLAUDE.md, "Large goes to disk"): about 10k tokens, where
// Claude Code starts to warn of a tool's answer. The answer then gives its outline, the snapshot's top levels.
const LARGE = 40_000, OUTLINE = 4_000;
function outline(yaml: string) {
  const lines = yaml.split('\n');
  let out = '';
  for (let d = 0; d <= Math.max(...lines.map(indent)); d += 2) {
    const next = lines.filter((l) => indent(l) <= d).join('\n');
    if (next.length > OUTLINE) break;
    out = next;
  }
  return out || clipped(lines.filter((l) => !indent(l)).join('\n'), OUTLINE);
}
const clipped = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

// What a page reported, as playwright-core keeps it: the console (200), uncaught errors (200), requests (100). The
// agent's last action in a page is marked: "since action" starts there, and the action's answer counts what came
// after it (2 console errors, 1 failed request), so the agent reads the details only when there are some.
type Mark = { at: number; request: Request | undefined; errors: number };
const marks = new WeakMap<Page, Mark>();
// Uncaught errors carry no time: those seen are counted, from the page's first mark.
const errorsSeen = new WeakMap<Page, { n: number }>();
async function mark(page: Page) {
  let seen = errorsSeen.get(page);
  if (!seen) {
    const s = { n: 0 };
    errorsSeen.set(page, seen = s);
    page.on('pageerror', () => { s.n++; });
  }
  marks.set(page, { at: Date.now(), request: (await page.requests()).at(-1), errors: seen.n });
}
type Since = 'action' | 'navigation' | undefined;
async function reportedOf(page: Page, since: Since) {
  const filter = since === 'navigation' ? 'since-navigation' : 'all';
  const messages = await page.consoleMessages({ filter }), errors = await page.pageErrors({ filter });
  const m = since === 'action' && marks.get(page);
  if (!m) return { messages, errors };
  const after = errorsSeen.get(page)!.n - m.errors;
  return { messages: messages.filter((x) => x.timestamp() >= m.at), errors: after ? errors.slice(-after) : [] };
}
// A request's number in its page, given when it is first listed and kept, so the agent can ask for one by it.
const numbers = new WeakMap<Request, number>(), numbered = new WeakMap<Page, number>();
async function requestsOf(page: Page, since?: Since) {
  const all = await page.requests();
  let n = numbered.get(page) ?? 0;
  for (const r of all) if (!numbers.has(r)) numbers.set(r, ++n);
  numbered.set(page, n);
  if (since === 'navigation') {
    const i = all.findLastIndex((r) => r.isNavigationRequest() && r.frame() === page.mainFrame());
    return i < 0 ? all : all.slice(i);
  }
  const m = since === 'action' && marks.get(page);
  if (!m || !m.request) return all;
  // The mark's request evicted (over 100 since): all there is came after it.
  const i = all.indexOf(m.request);
  return i < 0 ? all : all.slice(i + 1);
}
const failed = (r: Request) => !!r.failure() || (r.existingResponse()?.status() ?? 0) >= 400;
const LEVELS = ['error', 'warning', 'info', 'debug'] as const;
const levelOf = (m: ConsoleMessage) => (['error', 'assert'].includes(m.type()) ? 0 : m.type() === 'warning' ? 1 : m.type() === 'debug' ? 3 : 2);
// What an action's answer adds: the errors and failed requests since the action began, when there are some.
async function signals(page: Page) {
  const { messages, errors } = await reportedOf(page, 'action');
  const e = messages.filter((m) => levelOf(m) === 0).length + errors.length, f = (await requestsOf(page, 'action')).filter(failed).length;
  const said = [e && `${e} console error${e > 1 ? 's' : ''}`, f && `${f} failed request${f > 1 ? 's' : ''}`].filter(Boolean);
  return said.length ? ` Since: ${said.join(', ')}.` : '';
}
// Left out of the requests unless asked for (they fail, they show).
const STATIC = new Set(['image', 'font', 'script', 'stylesheet', 'media']);
// Never given to the agent (CLAUDE.md, Rules): the values of the headers that carry cookies and credentials.
const CREDENTIAL = /^(cookie|set-cookie|authorization|proxy-authorization)$|token|secret|api-?key|session|csrf|xsrf/i;
const TEXT = /^text\/|json|xml|javascript|x-www-form-urlencoded|graphql/;
const bodyOf = (b: Buffer, type = '') => ` (${b.length} bytes${type ? `, ${type}` : ''})${TEXT.test(type) ? `:\n${b.toString('utf8')}` : ': not text'}`;

function browserTools(server: McpServer, h: Handles) {
  const { task, profileArg, text, done, idOf, profileOf, tabOf, pageOf, locate, target, element, dialogArg, answering, tabArg, onTab } = h;
  // Into the task's artifacts (../artifacts.ts), never the project's folder: nothing of Kulisa's in the agent's git
  // status. Named by the profile and tab it came from.
  const toFile = async (profile: string, tabId: string | undefined, kind: string, content: string | Buffer) => {
    const { profile: p, tab: t } = tabOf(profile, tabId);
    const file = await saveArtifact(task.store.artifacts, `${p.id}-${t.id}-${kind}`, content);
    task.artifactsChanged();
    return file;
  };

  server.registerTool('browser_tab_new', {
    description: "Open a URL in a new tab of the profile and make it the active tab. Use it instead of browser_navigate to keep the page the human has open.",
    inputSchema: { profile: profileArg, url: z.string() },
  }, async ({ profile, url }) => {
    const p = profileOf(profile);
    const tab = p.newTab(url);
    await tab.ready;
    const page = await p.page(tab.id);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return text(`Opened tab ${tab.id} in ${profile}: ${page.url()} — "${await page.title()}".${await signals(page)}`);
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
    const page = await pageOf(profile, tabId), id = profileOf(profile).id;
    const hkey = `${task.key}/${id}`;
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
        void clearHighlights(hkey); task.caption(id, '');
      };
      tab.wc.on('input-event', onInput);
      highlights.set(hkey, { disposables: shown, tab, onInput });
    }
    task.caption(id, elements.length ? `points at: ${elements.map((e, i) => e.label || `${i + 1}`).join(' · ')}` : '', elements.length > 0);
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
    await mark(page);
    const said = await answering(tab, dialog, async () => {
      const opts = { waitUntil: 'domcontentloaded' as const };
      await (url ? page.goto(toUrl(url), opts) : go === 'back' ? page.goBack(opts) : go === 'forward' ? page.goForward(opts) : page.reload(opts));
    });
    return text(`${go ? `Went ${go}` : 'Navigated'}: ${profile} is at ${page.url()} — "${await page.title()}".${said}${await signals(page)}`);
  });

  server.registerTool('browser_snapshot', {
    description: "Accessibility snapshot of a profile's tab (default: the active one), with [ref=eN] for click/type. " +
      'A whole page can be large: take a part (an element by ref or locator, a depth) or find what you look for.',
    inputSchema: { profile: profileArg, tab: onTab, ...element,
      depth: z.number().int().positive().optional().describe('Only this many levels'),
      find: z.string().optional().describe('Only the nodes whose line matches this (a regular expression, case-insensitive), each under its ancestors'),
      also: z.array(z.string()).optional().describe("More profiles, by name: their active tabs too, in one call (with locator: the same element in each), e.g. to compare what each user sees") },
  }, async ({ profile, tab, ref, locator, depth, find, also = [] }) => {
    if (ref && also.length) throw new Error('A ref is one page\'s: with also, pass a locator');
    const pattern = find === undefined ? undefined : patternOf(find);
    const snap = async (name: string, tabId?: string) => {
      const page = await pageOf(name, tabId);
      const root = ref || locator ? (await target(page, { ref, locator })).first() : page;
      let yaml = await root.ariaSnapshot({ mode: 'ai', depth });
      if (pattern) yaml = found(yaml, pattern) || `Nothing matches ${find}.`;
      const head = `- Profile: ${name}\n- URL: ${page.url()}\n- Title: ${await page.title()}`;
      if (yaml.length <= LARGE) return `${head}\n\n${yaml}`;
      const file = await toFile(name, tabId, 'snapshot.yml', yaml);
      return `${head}\n- Snapshot: ${yaml.length} characters (about ${Math.round(yaml.length / 4000)}k tokens), in ${file}. ` +
        `Read the part you need there, or take one here: an element by ref or locator, a depth, or find. Its top levels:\n\n${outline(yaml)}`;
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
    await mark(page);
    const said = await answering(tabOf(profile, tab).tab, dialog, async () => {
      await loc.click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });
    return text(`Clicked ${locator || ref} as ${profile}. Now at ${page.url()}.${said}${await signals(page)}`);
  });

  server.registerTool('browser_type', { description: 'Type text into an element by ref or locator, replacing what it holds, key by key as a person types (a long text at once); submit presses Enter.',
    inputSchema: { profile: profileArg, tab: onTab, ...element, text: z.string(), submit: z.boolean().optional(), dialog: dialogArg } },
  async ({ profile, tab, ref, locator, text: value, submit, dialog }) => {
    const page = await pageOf(profile, tab);
    const loc = await target(page, { ref, locator });
    await mark(page);
    // Key by key, so the human sees it typed and the page gets the keys a person's typing sends (suggestions,
    // checks as one types): 40 ms a key, faster for a longer text, about 1.5 s at most; a long one (a pasted
    // paragraph) filled at once.
    await loc.fill(value.length > TYPED_MAX ? value : '', { timeout: 5000 });
    if (value && value.length <= TYPED_MAX) await loc.pressSequentially(value, { delay: Math.min(40, 1500 / value.length), timeout: 15000 });
    const said = submit ? await answering(tabOf(profile, tab).tab, dialog, () => loc.press('Enter')) : '';
    return text(`Typed into ${locator || ref} as ${profile}.${said}${await signals(page)}`);
  });

  // A test user's sign-in (profiles.md, "Test users' sign-ins"): its saved login or password typed by Kulisa into a field
  // of a local page; the agent never gets the password, the pane's caption shows dots. Real accounts stay the human's.
  server.registerTool('browser_type_login', {
    description: "Type a test user's saved login or password into a field (by ref or locator), replacing what it holds, to sign in to the app under test: only on a local page (localhost, *.test, a private network, the project's own list) or one the tab reached from it, never on Google, Microsoft or another account provider. You never see the password. The pair is saved by the human (Settings → Profiles) or by you (profile_set_login).",
    inputSchema: { profile: profileArg, tab: onTab, ...element, field: z.enum(['login', 'password']), submit: z.boolean().optional(), dialog: dialogArg },
  }, async ({ profile, tab, ref, locator, field, submit, dialog }) => {
    const r = done(task.loginFor(idOf(profile), tab, field));
    const page = await pageOf(profile, tab);
    const loc = await target(page, { ref, locator });
    const key = `${task.key}/${r.profile.id}`;
    await mark(page);
    task.shell.typingSecret.add(key);
    try { await loc.fill(r.value, { timeout: 5000 }); } finally { task.shell.typingSecret.delete(key); }
    const said = submit ? await answering(r.tab, dialog, () => loc.press('Enter')) : '';
    return text(`Typed ${r.profile.name}'s ${field} into ${locator || ref}.${said}${await signals(page)}`);
  });

  server.registerTool('browser_press_key', {
    description: "Press a key or a combination (Escape, Tab, ArrowDown, Control+A) in a profile's tab: on an element by ref or locator, else on the focused one.",
    inputSchema: { profile: profileArg, tab: onTab, key: z.string(), ...element, dialog: dialogArg },
  }, async ({ profile, tab, key, ref, locator, dialog }) => {
    const page = await pageOf(profile, tab);
    const loc = ref || locator ? await target(page, { ref, locator }) : null;
    await mark(page);
    const said = await answering(tabOf(profile, tab).tab, dialog, () => (loc ? loc.first().press(key, { timeout: 5000 }) : page.keyboard.press(key)));
    return text(`Pressed ${key} as ${profile}.${said}${await signals(page)}`);
  });

  server.registerTool('browser_hover', { description: 'Move the pointer over an element (menus, tooltips) by ref or locator.', inputSchema: { profile: profileArg, tab: onTab, ...element } },
    async ({ profile, tab, ref, locator }) => {
      const page = await pageOf(profile, tab);
      const loc = (await target(page, { ref, locator })).first();
      await mark(page);
      await loc.hover({ timeout: 5000 });
      return text(`Hovered ${locator || ref} as ${profile}.${await signals(page)}`);
    });

  server.registerTool('browser_select_option', {
    description: 'Choose options in a <select> by ref or locator, by their value or label.',
    inputSchema: { profile: profileArg, tab: onTab, ...element, values: z.array(z.string()) },
  }, async ({ profile, tab, ref, locator, values }) => {
    const page = await pageOf(profile, tab);
    const loc = (await target(page, { ref, locator })).first();
    await mark(page);
    const chosen = await loc.selectOption(values, { timeout: 5000 });
    return text(`Selected ${chosen.join(', ')} in ${locator || ref} as ${profile}.${await signals(page)}`);
  });

  server.registerTool('browser_file_upload', {
    description: 'Give files to a file input, or to the button that opens a file chooser, by ref or locator.',
    inputSchema: { profile: profileArg, tab: onTab, ...element, paths: z.array(z.string()).describe('Absolute paths of files on this computer') },
  }, async ({ profile, tab, ref, locator, paths }) => {
    if (!paths.every((f) => path.isAbsolute(f))) throw new Error('paths must be absolute');
    const page = await pageOf(profile, tab);
    const el = (await target(page, { ref, locator })).first();
    await mark(page);
    if (await el.evaluate((e) => e instanceof HTMLInputElement && e.type === 'file')) await el.setInputFiles(paths, { timeout: 5000 });
    else {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), el.click({ timeout: 5000 })]);
      await chooser.setFiles(paths);
    }
    return text(`Gave ${paths.map((f) => path.basename(f)).join(', ')} to ${locator || ref} as ${profile}.${await signals(page)}`);
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
      'For what the other tools do not do.',
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

  server.registerTool('browser_screenshot', {
    description: "Screenshot of a profile's tab (default: the active one): its visible part, one element (ref or locator), or the whole page (fullPage). Also saved as a file, its path in the answer.",
    inputSchema: { profile: profileArg, tab: onTab, ...element,
      fullPage: z.boolean().optional().describe('The whole page, scrolled to its end; a page scrolling inside a container of its own gives its visible part: take the container by locator'),
      also: z.array(z.string()).optional().describe('More profiles, by name: their active tabs too, in one call (with locator: the same element in each), e.g. to compare what each user sees') },
  }, async ({ profile, tab, ref, locator, fullPage, also = [] }) => {
    if (ref && also.length) throw new Error('A ref is one page\'s: with also, pass a locator');
    // At CSS pixels: at a screen's density the picture is several times larger and costs the agent's context for nothing.
    const shoot = async (id: string, tabId?: string) => {
      const found = tabOf(id, tabId);
      const el = ref || locator ? { element: (page: Page) => target(page, { ref, locator }) } : {};
      const buf = await found.profile.screenshot(found.tab, { ...el, fullPage, scale: 'css', type: 'jpeg', by: 'agent' });
      return { buf, file: await toFile(id, tabId, 'screenshot.jpg', buf) };
    };
    const image = (buf: Buffer) => ({ type: 'image' as const, data: buf.toString('base64'), mimeType: 'image/jpeg' });
    if (!also.length) {
      const { buf, file } = await shoot(profile, tab);
      return { content: [{ type: 'text' as const, text: `Saved as ${file}` }, image(buf)] };
    }
    // One profile that cannot be taken (signing in, closed) does not hide the others.
    const parts = await Promise.all([[profile, tab] as const, ...also.map((id) => [id, undefined as string | undefined] as const)].map(([id, t]) =>
      shoot(id, t).then(({ buf, file }) => [{ type: 'text' as const, text: `- Profile: ${id}\n- Saved as ${file}` }, image(buf)], (e: Error) => [{ type: 'text' as const, text: `- Profile: ${id}\n- ${e.message}` }])));
    return { content: parts.flat() };
  });

  // What a tab reported recently, as Playwright keeps it for every page of the shell's connection (the last ones,
  // since the connection was made: after a sign-in pause, only what came after it).
  const clip = (s: string, n = 300) => clipped(s, n);
  const since = z.enum(['action', 'navigation']).optional()
    .describe('Only what came since your last action in this tab (a click, typing, navigating), or since its page loaded; default: all that is kept');
  server.registerTool('browser_console_messages', {
    description: "Recent console messages and uncaught errors of a profile's tab (default: the active one), the last 200. Look here when something on the page does not work.",
    inputSchema: { profile: profileArg, tab: onTab, level: z.enum(LEVELS).optional().describe('This level and the more severe ones; default debug: all'), since },
  }, async ({ profile, tab, level = 'debug', since }) => {
    const page = await pageOf(profile, tab);
    const { messages, errors } = await reportedOf(page, since);
    const lines = [
      ...messages.filter((m) => levelOf(m) <= LEVELS.indexOf(level)).map((m) => `${m.type()}: ${clip(m.text())}`),
      ...errors.map((e) => `uncaught: ${clip(String(e.stack || e), 1000)}`),
    ].slice(-100);
    return text(lines.length ? lines.join('\n') : `No ${level === 'debug' ? 'console messages' : `${level}s`} in ${profile}'s tab ${page.url()}`);
  });
  server.registerTool('browser_network_requests', {
    description: "Recent network requests of a profile's tab (default: the active one), the last 100, numbered: method, URL, status or failure. " +
      'Successful images, fonts, scripts and styles are left out unless static. Headers and bodies of one: browser_network_request with its number.',
    inputSchema: {
      profile: profileArg, tab: onTab, onlyFailed: z.boolean().optional().describe('Failed requests and HTTP errors (4xx, 5xx) only'),
      filter: z.string().optional().describe('A regular expression the URL matches, e.g. /api/'),
      static: z.boolean().optional().describe('Also the successful images, fonts, scripts and styles'), since,
    },
  }, async ({ profile, tab, onlyFailed, filter, static: statics, since }) => {
    const page = await pageOf(profile, tab);
    let match: RegExp | undefined;
    try { match = filter === undefined ? undefined : new RegExp(filter); } catch { throw new Error(`filter is not a regular expression: ${filter}`); }
    const lines: string[] = [];
    for (const r of await requestsOf(page, since)) {
      const failure = r.failure()?.errorText, status = r.existingResponse()?.status();
      if (onlyFailed && !failed(r)) continue;
      if (!statics && !failed(r) && status && STATIC.has(r.resourceType())) continue;
      if (match && !match.test(r.url())) continue;
      lines.push(`#${numbers.get(r)} ${r.method()} ${clip(r.url())} → ${failure || status || 'pending'}`);
    }
    return text(lines.length ? lines.join('\n') : `No ${onlyFailed ? 'failed ' : ''}requests${filter ? ` matching ${filter}` : ''} in ${profile}'s tab ${page.url()}`);
  });
  server.registerTool('browser_network_request', {
    description: "One request of a profile's tab (default: the active one) by its number from browser_network_requests: its method, URL, status, headers and bodies. Cookies and credentials in headers are hidden.",
    inputSchema: { profile: profileArg, tab: onTab, number: z.number().int().positive() },
  }, async ({ profile, tab, number }) => {
    const page = await pageOf(profile, tab);
    const r = (await requestsOf(page)).find((x) => numbers.get(x) === number);
    if (!r) throw new Error(`No request #${number} in ${profile}'s tab: the page keeps its last 100. Call browser_network_requests for the numbers there are.`);
    const res = r.existingResponse(), failure = r.failure()?.errorText;
    const headers = (h: Record<string, string>) => Object.entries(h).map(([k, v]) => `  ${k}: ${CREDENTIAL.test(k) ? '(hidden)' : v}`).join('\n');
    const parts = [
      `#${number} ${r.method()} ${r.url()} → ${failure || (res ? `${res.status()} ${res.statusText()}` : 'pending')} (${r.resourceType()})`,
      `Request headers:\n${headers(await r.allHeaders())}`,
    ];
    // A large body to a file, as a snapshot.
    const body = async (b: Buffer, type: string | undefined, which: string) => {
      if (!TEXT.test(type ?? '') || b.length <= LARGE) return bodyOf(b, type);
      return ` (${b.length} bytes, ${type}): in ${await toFile(profile, tab, `${which}.txt`, b)}`;
    };
    const sent = r.postDataBuffer();
    if (sent) parts.push(`Request body${await body(sent, (await r.allHeaders())['content-type'], 'request')}`);
    if (res) {
      parts.push(`Response headers:\n${headers(await res.allHeaders())}`);
      // A body still coming (a stream, a long download) is not waited for.
      const got = await Promise.race([res.body(), new Promise<'later'>((ok) => setTimeout(() => ok('later'), 2000))]).catch((): null => null);
      parts.push(got === 'later' ? 'Response body: still loading' : got ? `Response body${await body(got, res.headers()['content-type'], 'response')}` : 'Response body: none, or no longer kept by the browser');
    }
    return text(parts.join('\n\n'));
  });
}

export { browserTools, clearHighlights, highlights };
