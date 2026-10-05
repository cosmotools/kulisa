// Kulisa's MCP server for the agent. Every tool takes `profile`; implemented with playwright-core through the
// CDP proxy, so every action also reaches the pane's caption and action annotations (ghost.js).
// Streamable HTTP at http://127.0.0.1:<port>/mcp, stateless (a new server per request).
const http = require('http');
const vm = require('vm');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const { handleHookRequest } = require('./agent-hooks');
const { fromLocalTool } = require('./local-only');

// The agent's highlights per profile: { disposables, tab, onInput }; kept across MCP requests (a server is built
// per request). They go when replaced, cleared, or on the first click or key press in that tab.
const highlights = new Map();
async function clearHighlights(profile) {
  const h = highlights.get(profile); if (!h) return;
  highlights.delete(profile);
  if (!h.tab.wc.isDestroyed()) h.tab.wc.off('input-event', h.onInput);
  for (const d of h.disposables) await d[Symbol.asyncDispose]().catch(() => {});
}

function buildServer(shell) {
  const server = new McpServer({ name: 'kulisa', version: '0.0.1' });
  // Profiles can be created while the agent runs, so this is a string checked at call time, not an enum.
  const closed = [...shell.closed.values()].map(({ cfg }) => `${cfg.id} (${cfg.name}, closed)`);
  const profileArg = z.string().describe(`Profile id. Current: ${[...[...shell.profiles.values()].map((p) => `${p.id} (${p.name})`), ...closed].join(', ') || 'none yet'}; call browser_profiles for the live list`);
  const text = (t) => ({ content: [{ type: 'text', text: t }] });
  const pageOfCheck = (profile) => {
    if (shell.closed.has(profile)) throw new Error(`Profile "${profile}" is closed (the human closed its pane; it is still signed in). Open it with profile_open if the task needs it.`);
    if (!shell.profiles.has(profile)) throw new Error(`No profile "${profile}". Profiles: ${[...shell.profiles.keys()].join(', ') || 'none — create one with profile_create'}`);
    if (shell.profiles.get(profile).signinMode) throw new Error(`Profile "${profile}" is in sign-in mode: the human is signing in. Wait and try again later.`);
  };
  const pageOf = async (profile, tab) => { pageOfCheck(profile); return shell.profiles.get(profile).page(tab); };
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
      ...[...shell.profiles.values()].map(({ id, name, signinMode, active, tabs }) =>
        ({ id, name, signinMode, active, tabs: tabs.filter((t) => !t.wc.isDestroyed()).map((t) => ({ id: t.id, title: t.wc.getTitle(), url: t.wc.getURL() })) })),
      ...[...shell.closed.values()].map(({ cfg, urls }) => ({ id: cfg.id, name: cfg.name, closed: true, tabs: urls.length })),
    ], null, 1)));

  server.registerTool('profile_open', {
    description: 'Open a closed profile: its pane comes back with its tabs, still signed in. Costs memory: open one only when the task needs it.',
    inputSchema: { profile: z.string().describe('Id of a closed profile (browser_profiles)') },
  }, async ({ profile }) => {
    const r = await shell.openProfile(profile);
    if (r.error) throw new Error(`${r.error}. Profiles: ${[...shell.profiles.keys(), ...shell.closed.keys()].join(', ')}`);
    const page = await pageOf(profile); // its active tab loaded, for the next snapshot
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return text(`Profile ${profile} is open, with ${shell.profiles.get(profile).tabs.length} tab(s); active: ${page.url()}`);
  });
  server.registerTool('profile_close', {
    description: "Close a profile: its pane and tabs go and free their memory; it stays signed in, and profile_open brings it back with the same tabs. Close profiles you opened when you are done with them, others only when the human asks.",
    inputSchema: { profile: z.string().describe('Id of an open profile') },
  }, async ({ profile }) => {
    const r = await shell.closeProfile(profile);
    if (r.error) throw new Error(r.error);
    return text(`Closed profile ${profile}; it is still signed in.`);
  });
  server.registerTool('profile_delete', {
    description: 'Delete a profile for good: its sign-ins, cookies, storage and tabs. The human is asked to confirm, and only they can sign a new profile in. Only when the human asks, or a profile you created is no longer needed.',
    inputSchema: { profile: z.string().describe('Profile id, open or closed') },
  }, async ({ profile }) => {
    const r = await shell.agentDeletesProfile(profile);
    if (r.error) throw new Error(r.error);
    return text(`Deleted profile ${profile}.`);
  });

  server.registerTool('profile_create', {
    description: 'Create a new, empty profile (a separate browser profile with its own pane) for a user the task needs and no profile has. The human then signs it in by hand. Costs memory: reuse a profile when one fits.',
    inputSchema: { name: z.string().describe('Who this profile is, e.g. "Ann · admin"') },
  }, async ({ name }) => {
    const r = await shell.createProfile(name);
    if (r.error) throw new Error(r.error);
    return text(`Created profile ${r.id} ("${name}"). It is signed out: ask the human to sign it in in its pane.`);
  });

  // Tabs. Other tools act on the profile's active tab; these open, switch and close tabs.
  const profileOf = (profile) => { pageOfCheck(profile); return shell.profiles.get(profile); };
  const tabArg = z.string().describe('Tab id from browser_profiles');
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
      const p = profileOf(profile);
      if (!p.get(tab)) throw new Error(`No tab ${tab} in ${profile}`);
      p.activate(tab);
      return text(`Active tab of ${profile}: ${tab} ${p.get(tab).wc.getURL()}`);
    });
  server.registerTool('browser_tab_close', { description: 'Close a tab of the profile. Close only tabs you opened, unless the human asked.', inputSchema: { profile: profileArg, tab: tabArg } },
    async ({ profile, tab }) => {
      const p = profileOf(profile);
      if (!p.get(tab)) throw new Error(`No tab ${tab} in ${profile}`);
      p.closeTab(tab);
      return text(`Closed tab ${tab} of ${profile}`);
    });

  // Show the human what the agent means: Playwright's own highlight (locator.highlight(): an outline in the page
  // that follows the element; under it Playwright shows the locator). The labels go to the pane's caption.
  // Replaces the profile's previous highlights; they stay until replaced or cleared.
  server.registerTool('browser_highlight', {
    description: "Point the human at elements on a profile's active tab: outline them in the page; the labels show over the pane. " +
      'Use when the human asks where something is, or to show what you mean, found or changed. Replaces this profile\'s previous highlights; an empty list clears them.',
    inputSchema: {
      profile: profileArg,
      elements: z.array(z.object({
        ref: z.string().optional(), locator: z.string().optional(),
        label: z.string().optional().describe('A few words about the element'),
      })).describe('Elements by ref (from browser_snapshot) or Playwright locator'),
    },
  }, async ({ profile, elements }) => {
    const page = await pageOf(profile);
    const p = shell.profiles.get(profile);
    await clearHighlights(profile);
    const shown = [];
    for (const el of elements) {
      let loc = await target(page, el);
      if (await loc.count() > 1) loc = loc.first();
      await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
      shown.push(await loc.highlight({ style: { outline: `3px solid ${p.color}`, outlineOffset: '2px' } }));
    }
    if (shown.length) {
      const tab = p.get();
      const onInput = (_e, input) => {
        if (!['mouseDown', 'keyDown', 'rawKeyDown'].includes(input.type)) return;
        clearHighlights(profile); shell.caption(profile, '');
      };
      tab.wc.on('input-event', onInput);
      highlights.set(profile, { disposables: shown, tab, onInput });
    }
    shell.caption(profile, elements.length ? `points at: ${elements.map((e, i) => e.label || `${i + 1}`).join(' · ')}` : '', elements.length > 0);
    return text(elements.length ? `Highlighted ${elements.length} element(s) in ${profile}` : `Cleared highlights in ${profile}`);
  });

  server.registerTool('browser_navigate', { description: "Navigate the profile's active tab to a URL.", inputSchema: { profile: profileArg, url: z.string() } },
    async ({ profile, url }) => {
      const page = await pageOf(profile);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      return text(`Navigated ${profile} to ${page.url()} — "${await page.title()}"`);
    });

  server.registerTool('browser_snapshot', { description: "Accessibility snapshot of the profile's active tab, with [ref=eN] for click/type.", inputSchema: { profile: profileArg } },
    async ({ profile }) => {
      const page = await pageOf(profile);
      return text(`- Profile: ${profile}\n- URL: ${page.url()}\n- Title: ${await page.title()}\n\n${await page.ariaSnapshot({ mode: 'ai' })}`);
    });

  server.registerTool('browser_click', { description: 'Click an element by ref (from browser_snapshot) or by a Playwright locator like getByRole(\'button\', { name: \'Pay now\' }).',
    inputSchema: { profile: profileArg, ref: z.string().optional(), locator: z.string().optional() } },
  async ({ profile, ref, locator }) => {
    const page = await pageOf(profile);
    const loc = await target(page, { ref, locator });
    await loc.click({ timeout: 5000 });
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return text(`Clicked ${locator || ref} as ${profile}. Now at ${page.url()}`);
  });

  server.registerTool('browser_type', { description: 'Fill text into an element by ref or locator; submit presses Enter.',
    inputSchema: { profile: profileArg, ref: z.string().optional(), locator: z.string().optional(), text: z.string(), submit: z.boolean().optional() } },
  async ({ profile, ref, locator, text: value, submit }) => {
    const page = await pageOf(profile);
    const loc = await target(page, { ref, locator });
    await loc.fill(value, { timeout: 5000 });
    if (submit) await loc.press('Enter');
    return text(`Typed into ${locator || ref} as ${profile}`);
  });

  server.registerTool('browser_screenshot', { description: "Screenshot of the profile's active tab.", inputSchema: { profile: profileArg } },
    async ({ profile }) => {
      const page = await pageOf(profile);
      const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
      return { content: [{ type: 'image', data: buf.toString('base64'), mimeType: 'image/jpeg' }] };
    });
  return server;
}

async function startMcpServer(shell, cfg) {
  const srv = http.createServer(async (req, res) => {
    if (!fromLocalTool(req)) { res.writeHead(403); return res.end(); }
    if (handleHookRequest(shell, req, res)) return;
    if (!req.url.startsWith('/mcp')) { res.writeHead(404); return res.end(); }
    let body = ''; req.on('data', (d) => (body += d));
    await new Promise((r) => req.on('end', r));
    let json;
    try { json = body ? JSON.parse(body) : undefined; } catch { res.writeHead(400); return res.end(); }
    const server = buildServer(shell);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, json);
  });
  await new Promise((r) => srv.listen(cfg.port || 0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const url = `${base}/mcp`;
  console.log('[kulisa] MCP server:', url);
  return { url, base, srv };
}

module.exports = { startMcpServer, highlights, clearHighlights };
