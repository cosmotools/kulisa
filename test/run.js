// Kulisa tests: start the real app (Electron) against a local test site, drive it like the human (IPC, input
// events) and like the agent (MCP), and check the results. Two phases share a temporary user-data folder:
//   electron test/run.js            the tests in the files below, in this order (later ones build on earlier ones)
//   electron test/run.js --restart  after a restart: profiles, sign-ins and tabs are still there (restart.js)
// `npm test` runs both. Shared helpers: helpers.js.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { start } = require('../src/main/app');
const { ensureSite } = require('./fixtures/site');
const { root, userData, project, sleep, waitFor } = require('./helpers');

const restart = process.argv.includes('--restart');
// direnv's list of allowed .envrc files (workspaces copy and allow them): the test's own, not the user's.
process.env.XDG_DATA_HOME = path.join(root, 'xdg-data');
const FILES = restart ? ['restart'] : ['agent', 'profiles', 'window', 'grid', 'zoom-and-closing', 'workspaces'];
if (!restart) fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(project, { recursive: true });
// The agent: cat, typed into a bash started as a terminal would start the user's shell, in the project's folder;
// its startup file sets an environment of the project, as direnv's .envrc does.
const bashrc = path.join(root, 'bashrc');
fs.writeFileSync(bashrc, `PS1='$ '\nexport FROM_RC="rc of $PWD"\n`);
const agent = { command: 'bash', args: ['-c', 'echo "agent: $FROM_RC"; exec cat -v'], resume: () => [], shell: { command: 'bash', args: ['--rcfile', bashrc, '-i'] } };
// Agents to choose from for a workspace (agents.js): one that is not installed until its installer runs, into a
// folder of the test.
const bin = path.join(root, 'bin');
const agents = [
  { id: 'fake', name: 'Fake agent', maker: 'Kulisa tests', needs: 'Nothing', command: 'kulisa-fake-agent', dirs: [bin],
    install: { posix: `echo "installing the fake agent"; mkdir -p '${bin}' && printf '#!/bin/sh\\ncase "$1" in --version) echo "kulisa-fake-agent 1.2.3"; exit;; esac\\necho "fake agent in $PWD, ports + $KULISA_PORT_OFFSET"\\nexec cat\\n' > '${bin}/kulisa-fake-agent' && chmod +x '${bin}/kulisa-fake-agent' && echo done` },
    args: () => [] },
  { id: 'shell', name: 'Terminal only', maker: '', command: null, needs: 'No agent' },
];

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
for (const f of FILES) require(`./${f}`)(test);

const sitePromise = ensureSite();
// The restart phase runs as a packaged build would as to DevTools: Kulisa's own are off (appDevTools).
// After the restart no project is named: the one opened last opens.
start({ userData, project: restart ? undefined : project, agent, agents, mcpPort: 0, signinHosts: ['localhost'], appDevTools: !restart })
  .then(async (shell) => {
    await sitePromise;
    const ctx = await setup(shell);
    let failed = 0;
    for (const t of tests) {
      const t0 = Date.now();
      try {
        await Promise.race([t.fn(ctx), sleep(30000).then(() => { throw new Error('timeout 30 s'); })]);
        console.log(`  ✓ ${t.name} (${Date.now() - t0} ms)`);
      } catch (e) {
        failed++;
        console.log(`  ✗ ${t.name}\n      ${(e.code === 'ERR_ASSERTION' ? e.message : String(e.stack || e).split('\n').slice(0, 4).join('\n')).replace(/\n/g, '\n      ')}`);
      }
    }
    console.log(failed ? `\n${failed} of ${tests.length} failed` : `\nall ${tests.length} passed`);
    // Quit the way a user closes the window (before-quit saves session cookies, kills the pty), then set the code.
    app.on('will-quit', (e) => {
      e.preventDefault();
      if (restart && !failed) fs.rmSync(root, { recursive: true, force: true });
      app.exit(failed ? 1 : 0);
    });
    app.quit();
  })
  .catch((e) => { console.error(e); app.exit(1); });

async function setup(shell) {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
  // The agent of the workspace on screen (each has its own MCP URL), or of workspace ws.
  const clients = new Map();
  const mcpOf = async (url) => {
    if (!clients.has(url)) {
      const c = new Client({ name: 'kulisa-test', version: '0' });
      await c.connect(new StreamableHTTPClientTransport(new URL(url)));
      clients.set(url, c);
    }
    return clients.get(url);
  };
  const call = async (name, args, ws = shell.ws) => {
    const mcp = await mcpOf(ws.env().KULISA_MCP_URL);
    const r = await mcp.callTool({ name, arguments: args });
    const text = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    if (r.isError) throw new Error(`${name}: ${text}`);
    return { ...r, text };
  };
  const ui = (js) => shell.win.webContents.executeJavaScript(js);
  let pty = '';
  const watchPty = (p) => p.onData((d) => (pty += d)); // again for the agent of another project
  await waitFor(() => shell.pty, 10000); // the agent starts once the window has laid out its terminal
  watchPty(shell.pty);
  // What the terminal in the window shows; lines wrapped at its width joined again.
  const termText = () => ui(`(() => { const b = window.__term.buffer.active;
    return Array.from({ length: b.length }, (_, i) => b.getLine(i)).map((l, i) => (i && !l.isWrapped ? '\\n' : '') + l.translateToString(true)).join(''); })()`);
  await waitFor(async () => (await termText()).includes('agent: rc of')); // the agent runs
  // Questions (deleting a profile, a workspace…) are answered in the window's dialog, as the human would: ctx.answer
  // true clicks the button that does it, false Cancel; null leaves the dialog to the test. ctx.asked: what was asked.
  const asked = [];
  const ctx = { shell, call, ui, ptyOutput: () => pty, watchPty, termText, asked, answer: true };
  const ask = shell.askWhich;
  // Asked in the window w (window.js), the first one when none is named; shell.ask asks through it.
  shell.askWhich = (q, w = shell.windows[0]) => {
    asked.push(q);
    const answer = ask(q, w), yes = ctx.answer, there = (js) => w.win.webContents.executeJavaScript(js);
    if (yes !== null) waitFor(() => there(`document.getElementById('ask').open && document.querySelector('#ask h2').textContent === ${JSON.stringify(q.message)}`))
      .then(() => there(`document.querySelector('#ask ${yes === 'other' ? '.other' : yes ? '.ok' : 'button[value=""]'}').click()`));
    return answer;
  };
  return ctx;
}
