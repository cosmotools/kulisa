// Local test site for the tests. Pages:
//   /app      a fake multi-user app: a name cookie (no password; our own test site), links and buttons that open tabs
//   /errors   a page that logs console errors and makes failing requests (for point and tell)
//   /strict   like /app's buttons, with Trusted Types enforced (as Microsoft 365 apps do): no HTML from strings
//   /form     controls for the agent's tools: dialogs, a select, a file input, a hover, keys, text shown later
//   /drag     a header with app-region: drag, as Teams has (a page must never move Kulisa's window)
//   /board    messages shared by every profile, polled (one profile posts, another waits to see it)
//   /headers  echoes the User-Agent and Sec-CH-UA* request headers as JSON
//   /draft    a page that holds its unload (beforeunload), as a form with unsaved changes does: never discarded
//   /menu     a link, a field, an empty place and a block with its own right-click menu (as Teams has)
//   /github   a fake GitHub (KULISA_GITHUB, run.ts), as Kulisa asks it: the device flow, a refresh, who a token is, a
//             repository reached, Kulisa App's installations (github, below)
// It runs in its own process: inside Electron's main process it can deadlock, because a synchronous Electron call
// waits for a renderer that waits for a response from this (then blocked) server.
import { spawn } from 'child_process';
import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';

function page(title: string, body: string, color = '#4a7') {
  const icon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="${color}"/></svg>`)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><link rel="icon" href="${icon}"></head><body>${body}</body></html>`;
}

const board: string[] = [];

// The fake GitHub. A device flow's code is entered by the test as the human would on GitHub's page
// (/github/login/device/enter?code=…&login=…), or denied (&deny=1). Kulisa App's user token of a login reaches its
// own repositories, where it is "installed"; a fine-grained token github_pat_<login>_<owner> is <login>'s and reaches
// <owner>'s, and ends at the time GitHub's header says.
const codes = new Map<string, { device: string; login?: string; denied?: boolean }>();
const tokens = new Map<string, string>(); // a user token -> its login
let issued = 0;
function github(u: URL, req: IncomingMessage, res: ServerResponse, body: string) {
  const json = (v: unknown, code = 200, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(v)); };
  const p = u.pathname.slice('/github'.length), form = new Map<string, string>(Object.entries(body ? JSON.parse(body) as Record<string, string> : {}));
  const pair = (login: string) => { const t = `ghu_${login}_${++issued}`; tokens.set(t, login);
    return { access_token: t, expires_in: 28800, refresh_token: `ghr_${login}_${issued}`, refresh_token_expires_in: 15897600, token_type: 'bearer', scope: '' }; };
  if (p === '/login/device/code') {
    const code = `KUL${++issued}-TEST`, device = `dev-${issued}`;
    codes.set(code, { device });
    return json({ device_code: device, user_code: code, verification_uri: `http://${req.headers.host}/github/login/device`, expires_in: 900, interval: 0.2 }); // GitHub says 5 s: a test waits less
  }
  if (p === '/login/device/enter') {
    const c = codes.get(u.searchParams.get('code') || '');
    if (!c) return json({ error: 'no such code' }, 404);
    if (u.searchParams.get('deny')) c.denied = true; else c.login = u.searchParams.get('login') || 'ann';
    return json({ ok: true });
  }
  if (p === '/login/oauth/access_token') {
    if (form.get('grant_type') === 'refresh_token') return json(/^ghr_(\w+?)_\d+$/.test(form.get('refresh_token') || '') ? pair(form.get('refresh_token').split('_')[1]) : { error: 'bad_refresh_token' });
    const c = [...codes.values()].find((x) => x.device === form.get('device_code'));
    if (!c) return json({ error: 'incorrect_device_code' });
    if (c.denied) return json({ error: 'access_denied' });
    return json(c.login ? pair(c.login) : { error: 'authorization_pending' });
  }
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const pat = /^github_pat_([a-z]+)_([a-z]+)$/.exec(token);
  const login = tokens.get(token) ?? pat?.[1];
  if (!login) return json({ message: 'Bad credentials' }, 401);
  const ends = pat ? { 'github-authentication-token-expiration': '2027-03-01 12:00:00 UTC' } : {};
  if (p === '/api/user') return json({ login }, 200, ends);
  if (p === '/api/user/installations') return json({ total_count: 1, installations: [{ account: { login } }] });
  const repo = /^\/api\/repos\/([^/]+)\/([^/]+)$/.exec(p);
  if (repo) return json({}, repo[1].toLowerCase() === (pat ? pat[2] : login) ? 200 : 404, ends);
  json({ message: 'Not Found' }, 404);
}

function handler(req: IncomingMessage, res: ServerResponse) {
  const u = new URL(req.url, 'http://x');
  const send = (code: number, body: string, type = 'text/html; charset=utf-8', headers = {}) => {
    res.writeHead(code, { 'content-type': type, ...headers });
    res.end(body);
  };
  const user = Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => c.split('='))).user;
  if (u.pathname.startsWith('/github/')) {
    let body = '';
    req.on('data', (d) => (body += d)).on('end', () => github(u, req, res, body));
    return;
  }
  if (u.pathname === '/hang') return; // a site that never answers (Kulisa must open a profile with such a tab anyway)
  if (u.pathname === '/headers') {
    const h = Object.fromEntries(Object.entries(req.headers).filter(([k]) => k === 'user-agent' || k.startsWith('sec-ch-ua')));
    return send(200, JSON.stringify(h), 'application/json');
  }
  if (u.pathname === '/app/login') {
    const name = (u.searchParams.get('name') || '').replace(/[^\w-]/g, '');
    // A session cookie (no Max-Age/Expires), like many sign-ins (Entra's ESTSAUTH): it must survive a Kulisa restart
    // the way it survives a Chrome restart with "continue where you left off".
    return send(302, '', 'text/plain', { 'set-cookie': `user=${name}; Path=/; SameSite=Lax`, location: '/app' });
  }
  // A test user's sign-in with a password (a profile's pair, browser_type_login): the password is "secret-<name>".
  if (u.pathname === '/app/logout') return send(302, '', 'text/plain', { 'set-cookie': 'user=; Path=/; Max-Age=0', location: '/app' });
  if (u.pathname === '/app/signin') {
    return send(200, page('sign in', `<form action="/app/password"><input id="user" name="user" aria-label="User"><input id="pass" name="pass" type="password" aria-label="Password"><button>Sign in</button></form>`));
  }
  if (u.pathname === '/app/password') {
    const name = (u.searchParams.get('user') || '').replace(/[^\w-]/g, '');
    if (u.searchParams.get('pass') !== `secret-${name}`) return send(200, page('wrong', '<h2 id="who">Wrong password</h2>'));
    return send(302, '', 'text/plain', { 'set-cookie': `user=${name}; Path=/; SameSite=Lax`, location: '/app' });
  }
  if (u.pathname === '/app') {
    const n = u.searchParams.get('n') || '1';
    return send(200, page(user ? `App · ${user} · ${n}` : 'App · signed out', `
<h2 id="who">${user ? `Signed in as <b>${user}</b>` : 'Signed out'}</h2>
<form action="/app/login"><input name="name" aria-label="Name"><button>Sign in</button></form>
<p><a href="/app?n=${+n + 1}" target="_blank">target=_blank link</a>
<button onclick="window.open('/app?n=${+n + 1}')">window.open()</button></p>
<p><button onclick="this.textContent='Checked out ✓'">Checkout</button></p>`));
  }
  // A box of a known size and color on a page taller than any pane (screenshots: an element, the whole page).
  if (u.pathname === '/tall') return send(200, page('tall', `<div id="box" style="width: 200px; height: 120px; margin: 40px; background: #d00"></div><div style="height: 3000px"></div><p>end</p>`));
  if (u.pathname === '/menu') {
    return send(200, page('menu', `<p><a id="link" href="/app">a link</a></p><p><input id="field" value="some text"></p>
<div id="blank" style="height:60px"></div><div id="own" style="padding:20px">a block with its own menu</div>
<script>own.addEventListener('contextmenu', (e) => { e.preventDefault(); own.textContent = 'its own menu'; });</script>`));
  }
  if (u.pathname === '/strict') {
    return send(200, page('strict', `<h3>Strict page</h3><p><button>Sign in</button> <a href="/app">a link</a></p>`), undefined,
      { 'content-security-policy': "require-trusted-types-for 'script'" });
  }
  if (u.pathname === '/errors') {
    return send(200, page('errors', `
<h3>Shop checkout (broken)</h3>
<button id="pay" onclick="pay()">Pay now</button><p id="status"></p>
<script>
function pay() { console.error('PaymentError: card declined by stub'); fetch('/api/pay', { method: 'POST' }).then((r) => { document.getElementById('status').textContent = 'HTTP ' + r.status; }); }
</script>`));
  }
  if (u.pathname === '/form') {
    return send(200, page('form', `
<h3>Form</h3><p id="out">nothing yet</p>
<button onclick="out.textContent = confirm('Delete the draft?') ? 'deleted' : 'kept'">Delete</button>
<select aria-label="Size" onchange="out.textContent = 'size ' + this.value"><option>S</option><option>M</option><option>L</option></select>
<input type="file" aria-label="Attachment" onchange="out.textContent = 'file ' + this.files[0].name">
<span onmouseenter="hint.hidden = false">Help</span><span id="hint" hidden>Hint shown</span>
<button onclick="setTimeout(() => out.textContent = 'done later', 1500)">Later</button>
<script>addEventListener('keydown', (e) => { if (e.key === 'Escape') out.textContent = 'Escape pressed'; });</script>`));
  }
  if (u.pathname === '/draft') return send(200, page('draft', `<h3>Draft</h3><button>Draft</button><script>onbeforeunload = (e) => { e.preventDefault(); e.returnValue = 'unsaved'; };</script>`));
  if (u.pathname === '/drag') return send(200, page('drag', `<header id="bar" style="app-region: drag; height: 60px">Title bar</header><p>page</p>`));
  if (u.pathname === '/board/post') { board.push(u.searchParams.get('text') || ''); return send(302, '', 'text/plain', { location: '/board' }); }
  if (u.pathname === '/board/messages') return send(200, JSON.stringify(board), 'application/json');
  if (u.pathname === '/board') {
    return send(200, page('board', `
<form action="/board/post"><input name="text" aria-label="Message"><button>Post</button></form><ul id="list"></ul>
<script>setInterval(async () => { list.replaceChildren(...(await (await fetch('/board/messages')).json()).map((t) => Object.assign(document.createElement('li'), { textContent: t }))); }, 300);</script>`));
  }
  if (u.pathname.startsWith('/api/')) return send(500, '{"error":"stub failure"}', 'application/json');
  send(404, 'not found', 'text/plain');
}

// Start the site in a child process (or reuse one already listening).
async function ensureSite(port = 4417) {
  const url = `http://127.0.0.1:${port}`;
  const up = () => fetch(url + '/headers').then(() => true, () => false);
  if (await up()) return { url };
  const child = spawn(process.execPath, [import.meta.filename], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', SITE_PORT: String(port) }, stdio: 'ignore' });
  process.on('exit', () => child.kill());
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return { url, child };
}

export { ensureSite };
if (import.meta.main) http.createServer(handler).listen(Number(process.env.SITE_PORT || 4417), '127.0.0.1');
