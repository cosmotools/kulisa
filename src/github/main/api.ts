// What Kulisa asks GitHub (../README.md, Signing in): the device flow, a token refreshed, who a token is and what it
// reaches. Plain fetch: a few calls, no library needed.

// Where GitHub is: its site (sign-in), its API and its own MCP server (the remote one: no process of Kulisa's; by
// GitHub's docs for every user, whatever their plan); the tests' fake one (KULISA_GITHUB) in their place.
interface Hosts { web: string; api: string; mcp: string }
const GITHUB: Hosts = { web: 'https://github.com', api: 'https://api.github.com', mcp: 'https://api.githubcopilot.com/mcp/' };
// Kulisa App's (cosmotools; docs: issue #48): public, in the code. It has no secret: a desktop app could not keep one,
// and the device flow and its refresh need none.
const CLIENT_ID = 'Iv23li0yj4qNx88KBUcq';
const APP = 'kulisa-app';

// A sign-in's tokens; ends, refreshEnds: when each stops working (ms; null: never).
interface Tokens { access: string; refresh: string | null; ends: number | null; refreshEnds: number | null }

class Unauthorized extends Error {}

const after = (s: unknown, now: number) => (typeof s === 'number' && s > 0 ? now + s * 1000 : null);
const tokensOf = (j: Record<string, unknown>, now = Date.now()): Tokens => ({
  access: String(j.access_token), refresh: typeof j.refresh_token === 'string' ? j.refresh_token : null,
  ends: after(j.expires_in, now), refreshEnds: after(j.refresh_token_expires_in, now) });

async function oauth(h: Hosts, path: string, body: Record<string, string>, signal?: AbortSignal) {
  const r = await fetch(`${h.web}/login/${path}`, { method: 'POST', signal,
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'Kulisa' }, body: JSON.stringify({ client_id: CLIENT_ID, ...body }) });
  if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
  return await r.json() as Record<string, unknown>;
}

// The device flow's first step: the code the human enters on GitHub, at url.
async function deviceCode(h: Hosts) {
  const j = await oauth(h, 'device/code', {});
  if (typeof j.device_code !== 'string') throw new Error(`GitHub gave no code${j.error ? `: ${String(j.error)}` : ''}`);
  return { device: j.device_code, code: String(j.user_code), url: String(j.verification_uri), interval: Number(j.interval) || 5, ends: after(j.expires_in, Date.now())! };
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
});
// Then GitHub asked every interval until the human authorized it there (its pace: slow_down adds 5 s). Tokens, or
// why not.
async function deviceTokens(h: Hosts, device: string, interval: number, signal: AbortSignal): Promise<Tokens> {
  for (;;) {
    await wait(interval * 1000, signal);
    const j = await oauth(h, 'oauth/access_token', { device_code: device, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }, signal);
    if (j.access_token) return tokensOf(j);
    if (j.error === 'authorization_pending') continue;
    if (j.error === 'slow_down') { interval = Number(j.interval) || interval + 5; continue; }
    throw new Error(j.error === 'access_denied' ? 'Not signed in: cancelled on GitHub.' : j.error === 'expired_token' ? 'Not signed in: the code expired. Try again.'
      : `Not signed in: ${String(j.error_description || j.error)}`);
  }
}

// New tokens for a refresh token (each refresh replaces it), or null when GitHub no longer takes it: signed out.
async function refreshed(h: Hosts, refresh: string): Promise<Tokens | null> {
  const j = await oauth(h, 'oauth/access_token', { grant_type: 'refresh_token', refresh_token: refresh });
  if (j.access_token) return tokensOf(j);
  if (j.error === 'bad_refresh_token' || j.error === 'unauthorized') return null;
  throw new Error(`GitHub did not refresh the sign-in: ${String(j.error_description || j.error)}`);
}

// A call of GitHub's API; etag: an answer that did not change since is 304, which does not count against the limit
// (a pull request watched: partners.ts), json null then.
async function call(h: Hosts, token: string, path: string, o: { method?: string; body?: unknown; etag?: string } = {}) {
  const r = await fetch(`${h.api}${path}`, { method: o.method, body: o.body === undefined ? undefined : JSON.stringify(o.body),
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'Kulisa',
      ...(o.etag && { 'if-none-match': o.etag }), ...(o.body !== undefined && { 'content-type': 'application/json' }) } });
  if (r.status === 401) throw new Unauthorized('GitHub no longer takes this sign-in');
  if (r.status === 304) return { json: null, headers: r.headers };
  if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
  return { json: await r.json() as unknown, headers: r.headers };
}
const get = (h: Hosts, token: string, path: string) => call(h, token, path);

// Who a token is; ends: a fine-grained token's own expiry, as GitHub tells it in a header.
async function whoIs(h: Hosts, token: string) {
  const { json, headers } = await get(h, token, '/user');
  const u = json as { id: number; login: string; name?: string | null };
  const expiry = headers.get('github-authentication-token-expiration');
  return { id: String(u.id), login: u.login, name: u.name || null, ends: expiry ? Date.parse(expiry.replace(' UTC', 'Z').replace(' ', 'T')) || null : null };
}

// The repositories it reaches (owner/name): with Kulisa App, those it is installed on that the human can use; with a
// token, those chosen for it. At most 500: enough to suggest an account for a repository.
async function reposOf(h: Hosts, token: string) {
  const all: string[] = [];
  for (let page = 1; page <= 5; page++) {
    const list = (await get(h, token, `/user/repos?per_page=100&page=${page}`)).json as { full_name: string }[];
    all.push(...list.map((r) => r.full_name));
    if (list.length < 100) break;
  }
  return all;
}

// Whether a repository (owner/name) is public, as the account sees it; one it cannot see is not.
async function isPublic(h: Hosts, token: string, repo: string) {
  try { return ((await get(h, token, `/repos/${repo}`)).json as { private?: boolean }).private === false; } catch { return false; }
}

// A remote's repository on GitHub (owner/name), lowercase as GitHub compares them, or null for another host (an SSH
// host alias is one: Kulisa does not read the SSH config). Its user and token, if the URL holds them, are never kept.
function repoOf(remote: string) {
  const m = /^(?:https?:\/\/(?:[^@/]*@)?github\.com\/|(?:ssh:\/\/)?git@github\.com[:/])([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(remote.trim());
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : null;
}

export type { Hosts, Tokens };
export { call, GITHUB, APP, Unauthorized, deviceCode, deviceTokens, refreshed, whoIs, reposOf, isPublic, repoOf };
