// Kulisa's MCP server for the agent. Every tool takes `profile`; implemented with playwright-core through the
// CDP proxy, so every action also reaches the pane's caption and action annotations (ghost.js).
// Streamable HTTP, one URL per workspace: http://127.0.0.1:<port>/ws/<project>/<n>/mcp (the parts
// percent-encoded); its agent sees that workspace's profiles only. Stateless (a new server per request).
const http = require('http');
const vm = require('vm');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const { handleHookRequest } = require('./agent-hooks');
const { fromLocalTool } = require('./local-only');
const { toUrl } = require('./profiles');
const { version: VERSION } = require('../../package.json');

// The agent's highlights per profile (by '<workspace>/<profile id>'): { disposables, tab, onInput }; kept across MCP
// requests (a server is built per request). They go when replaced, cleared, or on the first click or key press in
// that tab.
const highlights = new Map();
async function clearHighlights(profile) {
  const h = highlights.get(profile); if (!h) return;
  highlights.delete(profile);
  if (!h.tab.wc.isDestroyed()) h.tab.wc.off('input-event', h.onInput);
  for (const d of h.disposables) await d[Symbol.asyncDispose]().catch(() => {});
}

// ws: the workspace (workspaces.js) whose profiles the tools act on.
function buildServer(ws) {
  const server = new McpServer({ name: 'kulisa', version: VERSION });
  // Profiles can be created while the agent runs, so this is a string checked at call time, not an enum.
  const closed = [...ws.closed.values()].map(({ cfg }) => `${cfg.id} (${cfg.name}, closed)`);
  const profileArg = z.string().describe(`Profile id. Current: ${[...[...ws.profiles.values()].map((p) => `${p.id} (${p.name})`), ...closed].join(', ') || 'none yet'}; call browser_profiles for the live list`);
  const text = (t) => ({ content: [{ type: 'text', text: t }] });
  // The agent's handles on the core: profiles and tabs found as the window finds them (workspaces.js), plus what only
  // automation keeps to: no agent while the human signs in.
  const profileOf = (id) => {
    const r = ws.find(id);
    if (r.error) throw new Error(r.closed ? `${r.error} With profile_open, if the task needs it.` : r.error);
    if (r.profile.signinMode) throw new Error(`Profile "${id}" is in sign-in mode: the human is signing in. Wait and try again later.`);
    return r.profile;
  };
  const tabOf = (id, tabId) => {
    profileOf(id);
    const r = ws.findTab(id, tabId);
    if (r.error) throw new Error(r.error);
    return r;
  };
  const pageOf = (id, tabId) => { const { profile, tab } = tabOf(id, tabId); return profile.page(tab.id); };
  // The element for a ref or a locator. Waits a second for it to appear, then fails with what to do instead:
  // a guessed name ("New chat" for "New message") would otherwise cost the agent the action's full timeout.
  const target = async (page, { ref, locator }) => {
    let loc;
    if (ref) loc = page.locator(`aria-ref=${ref}`);
    else if (locator) {
      // A Playwright locator expression as the picker prints it, e.g. getByRole('button', { name: 'Pay now' }).
      if (!/^(getBy\w+|locator)\(/.test(locator)) throw new Error('locator must start with getBy*( or locator(');
      loc = vm.runInNewContext(`page.${locator}`, { page }, { timeout: 100 });
    } else throw new Error('pass ref (from browser_snapshot) or locator');
    try { await loc.first().waitFor({ state: 'attached', timeout: 1000 }); } catch {
      throw new Error(`No element matches ${locator || `ref ${ref}`} on ${page.url()}. Call browser_snapshot and use a ref from it.`);
    }
    return loc;
  };

  server.registerTool('browser_profiles', { description: 'List profiles: id, name, whether the human is signing in (signinMode), tabs; closed ones (closed: true) need profile_open first.', inputSchema: {} },
    async () => text(JSON.stringify([
      ...[...ws.profiles.values()].map(({ id, name, signinMode, active, tabs }) =>
        ({ id, name, signinMode, active, tabs: tabs.filter((t) => !t.wc.isDestroyed()).map((t) => ({ id: t.id, title: t.wc.getTitle(), url: t.wc.getURL() })) })),
      ...[...ws.closed.values()].map(({ cfg, urls }) => ({ id: cfg.id, name: cfg.name, closed: true, tabs: urls.length })),
    ], null, 1)));

  server.registerTool('profile_open', {
    description: 'Open a closed profile: its pane comes back with its tabs, still signed in. Costs memory: open one only when the task needs it.',
    inputSchema: { profile: z.string().describe('Id of a closed profile (browser_profiles)') },
  }, async ({ profile }) => {
    const r = await ws.openProfile(profile);
    if (r.error) throw new Error(`${r.error}. Profiles: ${[...ws.profiles.keys(), ...ws.closed.keys()].join(', ')}`);
    const page = await pageOf(profile); // its active tab loaded, for the next snapshot
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return text(`Profile ${profile} is open, with ${ws.profiles.get(profile).tabs.length} tab(s); active: ${page.url()}`);
  });
  server.registerTool('profile_close', {
    description: "Close a profile: its pane and tabs go and free their memory; it stays signed in, and profile_open brings it back with the same tabs. Close profiles you opened when you are done with them, others only when the human asks.",
    inputSchema: { profile: z.string().describe('Id of an open profile') },
  }, async ({ profile }) => {
    const r = await ws.closeProfile(profile);
    if (r.error) throw new Error(r.error);
    return text(`Closed profile ${profile}; it is still signed in.`);
  });
  server.registerTool('profile_delete', {
    description: 'Delete a profile for good: its sign-ins, cookies, storage and tabs. The human is asked to confirm, and only they can sign a new profile in. Only when the human asks, or a profile you created is no longer needed.',
    inputSchema: { profile: z.string().describe('Profile id, open or closed') },
  }, async ({ profile }) => {
    const r = await ws.deleteProfile(profile, 'agent');
    if (r.error) throw new Error(r.error);
    return text(`Deleted profile ${profile}.`);
  });

  server.registerTool('profile_create', {
    description: 'Create a new, empty profile (a separate browser profile with its own pane) for a user the task needs and no profile has. The human then signs it in by hand. Costs memory: reuse a profile when one fits.',
    inputSchema: { name: z.string().describe('Who this profile is: letters, digits and @ . _ + - only, e.g. "ann@shop.com" (the account it signs in to) or "ann.admin"') },
  }, async ({ name }) => {
    const r = await ws.createProfile(name);
    if (r.error) throw new Error(r.error);
    return text(`Created profile ${r.id} ("${name}"). It is signed out: ask the human to sign it in in its pane.`);
  });

  // Tabs. Other tools act on the profile's active tab, or on the tab they are given; these open, switch and close tabs.
  const tabArg = z.string().describe('Tab id from browser_profiles');
  const onTab = z.string().optional().describe('Tab id (from browser_profiles or a [kulisa pick: …] reference); default: the active tab');
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
      return text(`Active tab of ${profile}: ${t.id} ${t.wc.getURL()}`);
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
    const page = await pageOf(profile, tabId);
    const p = profileOf(profile);
    const hkey = `${ws.key}/${profile}`;
    await clearHighlights(hkey);
    const shown = [];
    for (const el of elements) {
      let loc = await target(page, el);
      if (await loc.count() > 1) loc = loc.first();
      await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
      shown.push(await loc.highlight({ style: { outline: `3px solid ${p.color}`, outlineOffset: '2px' } }));
    }
    if (shown.length) {
      const { tab } = tabOf(profile, tabId);
      const onInput = (_e, input) => {
        if (!['mouseDown', 'keyDown', 'rawKeyDown'].includes(input.type)) return;
        clearHighlights(hkey); ws.caption(profile, '');
      };
      tab.wc.on('input-event', onInput);
      highlights.set(hkey, { disposables: shown, tab, onInput });
    }
    ws.caption(profile, elements.length ? `points at: ${elements.map((e, i) => e.label || `${i + 1}`).join(' · ')}` : '', elements.length > 0);
    return text(elements.length ? `Highlighted ${elements.length} element(s) in ${profile}` : `Cleared highlights in ${profile}`);
  });

  // As the human's address bar (Profile.navigate), but through Playwright, as everything the agent does in a page: the
  // human sees it (ghost.js), and the sign-in pause holds (CLAUDE.md, Architecture).
  server.registerTool('browser_navigate', { description: "Navigate the profile's active tab to a URL.", inputSchema: { profile: profileArg, url: z.string() } },
    async ({ profile, url }) => {
      const page = await pageOf(profile);
      await page.goto(toUrl(url), { waitUntil: 'domcontentloaded' });
      return text(`Navigated ${profile} to ${page.url()} — "${await page.title()}"`);
    });

  server.registerTool('browser_snapshot', { description: "Accessibility snapshot of a profile's tab (default: the active one), with [ref=eN] for click/type.", inputSchema: { profile: profileArg, tab: onTab } },
    async ({ profile, tab }) => {
      const page = await pageOf(profile, tab);
      return text(`- Profile: ${profile}\n- URL: ${page.url()}\n- Title: ${await page.title()}\n\n${await page.ariaSnapshot({ mode: 'ai' })}`);
    });

  server.registerTool('browser_click', { description: 'Click an element by ref (from browser_snapshot) or by a Playwright locator like getByRole(\'button\', { name: \'Pay now\' }).',
    inputSchema: { profile: profileArg, tab: onTab, ref: z.string().optional(), locator: z.string().optional() } },
  async ({ profile, tab, ref, locator }) => {
    const page = await pageOf(profile, tab);
    const loc = await target(page, { ref, locator });
    await loc.click({ timeout: 5000 });
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return text(`Clicked ${locator || ref} as ${profile}. Now at ${page.url()}`);
  });

  server.registerTool('browser_type', { description: 'Fill text into an element by ref or locator; submit presses Enter.',
    inputSchema: { profile: profileArg, tab: onTab, ref: z.string().optional(), locator: z.string().optional(), text: z.string(), submit: z.boolean().optional() } },
  async ({ profile, tab, ref, locator, text: value, submit }) => {
    const page = await pageOf(profile, tab);
    const loc = await target(page, { ref, locator });
    await loc.fill(value, { timeout: 5000 });
    if (submit) await loc.press('Enter');
    return text(`Typed into ${locator || ref} as ${profile}`);
  });

  server.registerTool('browser_screenshot', { description: "Screenshot of a profile's tab (default: the active one).", inputSchema: { profile: profileArg, tab: onTab } },
    async ({ profile, tab }) => {
      const page = await pageOf(profile, tab);
      const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
      return { content: [{ type: 'image', data: buf.toString('base64'), mimeType: 'image/jpeg' }] };
    });

  // What a tab reported recently, as Playwright keeps it for every page of the shell's connection (the last ones,
  // since the connection was made: after a sign-in pause, only what came after it).
  const clip = (s, n = 300) => (s.length > n ? `${s.slice(0, n)}…` : s);
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
    const lines = [];
    for (const r of await page.requests()) {
      const failure = r.failure()?.errorText;
      const status = failure ? null : (await r.response().catch(() => null))?.status();
      if (!onlyFailed || failure || status >= 400) lines.push(`${r.method()} ${clip(r.url())} → ${failure || status || 'pending'}`);
    }
    return text(lines.length ? lines.slice(-100).join('\n') : `No ${onlyFailed ? 'failed ' : ''}requests in ${profile}'s tab ${page.url()}`);
  });
  return server;
}

const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return ''; } };

async function startMcpServer(shell, cfg) {
  const srv = http.createServer(async (req, res) => {
    if (!fromLocalTool(req)) { res.writeHead(403); return res.end(); }
    // /ws/<project>/<n>/…: a workspace of an open project, loaded.
    const m = req.url.match(/^\/ws\/([^/]+)\/(\d+)(\/.*)$/);
    const ws = m && shell.workspaceOf(safeDecode(m[1]), Number(m[2]));
    if (!ws?.loaded) { res.writeHead(404); return res.end(); }
    if (handleHookRequest(ws, m[3], req, res)) return;
    if (!m[3].startsWith('/mcp')) { res.writeHead(404); return res.end(); }
    let body = ''; req.on('data', (d) => (body += d));
    await new Promise((r) => req.on('end', r));
    let json;
    try { json = body ? JSON.parse(body) : undefined; } catch { res.writeHead(400); return res.end(); }
    const server = buildServer(ws);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, json);
  });
  await new Promise((r) => srv.listen(cfg.port || 0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  console.log('[kulisa] MCP server:', `${base}/ws/<project>/<n>/mcp`);
  return { base, srv };
}

module.exports = { startMcpServer, highlights, clearHighlights };
