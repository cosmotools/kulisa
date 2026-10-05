// Local test site for the tests. Pages:
//   /app      a fake multi-user app: a name cookie (no password; our own test site), links and buttons that open tabs
//   /errors   a page that logs console errors and makes failing requests (for point and tell)
//   /strict   like /app's buttons, with Trusted Types enforced (as Microsoft 365 apps do): no HTML from strings
//   /headers  echoes the User-Agent and Sec-CH-UA* request headers as JSON (asks for high-entropy hints with Accept-CH)
// It runs in its own process: inside Electron's main process it can deadlock, because a synchronous Electron call
// waits for a renderer that waits for a response from this (then blocked) server.
const http = require('http');

function page(title, body, color = '#4a7') {
  const icon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="${color}"/></svg>`)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><link rel="icon" href="${icon}"></head><body>${body}</body></html>`;
}

function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  const send = (code, body, type = 'text/html; charset=utf-8', headers = {}) => {
    res.writeHead(code, { 'content-type': type, 'accept-ch': 'Sec-CH-UA-Full-Version-List, Sec-CH-UA-Platform-Version', ...headers });
    res.end(body);
  };
  const user = Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => c.split('='))).user;
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
  if (u.pathname === '/app') {
    const n = u.searchParams.get('n') || '1';
    return send(200, page(user ? `App · ${user} · ${n}` : 'App · signed out', `
<h2 id="who">${user ? `Signed in as <b>${user}</b>` : 'Signed out'}</h2>
<form action="/app/login"><input name="name" aria-label="Name"><button>Sign in</button></form>
<p><a href="/app?n=${+n + 1}" target="_blank">target=_blank link</a>
<button onclick="window.open('/app?n=${+n + 1}')">window.open()</button></p>
<p><button onclick="this.textContent='Checked out ✓'">Checkout</button></p>`));
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
  if (u.pathname.startsWith('/api/')) return send(500, '{"error":"stub failure"}', 'application/json');
  send(404, 'not found', 'text/plain');
}

// Start the site in a child process (or reuse one already listening).
async function ensureSite(port = 4417) {
  const url = `http://127.0.0.1:${port}`;
  const up = () => fetch(url + '/headers').then(() => true, () => false);
  if (await up()) return { url };
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, [__filename], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', SITE_PORT: String(port) }, stdio: 'ignore' });
  process.on('exit', () => child.kill());
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  return { url, child };
}

module.exports = { ensureSite };
if (require.main === module) http.createServer(handler).listen(Number(process.env.SITE_PORT || 4417), '127.0.0.1');
