// What Kulisa asks GitHub (README, How it signs in): the device flow's code and token, a refresh, who a token is,
// whether it reaches a repository, where Kulisa App is installed. Through the fetch the caller gives (Electron's
// net.fetch: Chromium's network, the system's proxy). Nothing here logs: what goes and comes holds tokens.

// Kulisa App (https://github.com/apps/kulisa-app): its client ID is public, no secret (a desktop app cannot keep one).
const CLIENT_ID = 'Iv23li0yj4qNx88KBUcq';
// GitHub's two addresses; KULISA_GITHUB, the tests' alone, puts both on their fake GitHub (its API under /api).
const web = () => process.env.KULISA_GITHUB || 'https://github.com';
const api = () => (process.env.KULISA_GITHUB ? `${process.env.KULISA_GITHUB}/api` : 'https://api.github.com');

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
// A token pair as GitHub gives it, its ends as times (ms). A fine-grained token has no refresh, its end only when one
// was set.
interface Tokens { access: string; ends?: number; refresh?: string; refreshEnds?: number }
// GitHub's OAuth answer: a token pair, or an error's code (authorization_pending, slow_down, bad_refresh_token …).
type OAuth = { tokens: Tokens } | { error: string; interval?: number };

// A form posted to github.com's OAuth endpoints, the answer as JSON (they answer as a form without Accept).
async function oauth(fetch: Fetch, path: string, form: Record<string, string>) {
  const r = await fetch(`${web()}${path}`, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString() });
  if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
  return await r.json() as Record<string, unknown>;
}
const tokensOf = (j: Record<string, unknown>, now: number): Tokens => ({ access: String(j.access_token),
  ...(typeof j.expires_in === 'number' && { ends: now + j.expires_in * 1000 }),
  ...(typeof j.refresh_token === 'string' && { refresh: j.refresh_token }),
  ...(typeof j.refresh_token_expires_in === 'number' && { refreshEnds: now + j.refresh_token_expires_in * 1000 }) });
const answer = (j: Record<string, unknown>, now: number): OAuth => (typeof j.access_token === 'string' ? { tokens: tokensOf(j, now) }
  : { error: String(j.error || 'no token'), ...(typeof j.interval === 'number' && { interval: j.interval }) });

// The device flow's first step: the code the human enters on GitHub's page, how long it lives and how often to ask.
async function deviceCode(fetch: Fetch) {
  const j = await oauth(fetch, '/login/device/code', { client_id: CLIENT_ID });
  if (typeof j.device_code !== 'string' || typeof j.user_code !== 'string') throw new Error(`GitHub gave no code${j.error ? `: ${String(j.error)}` : ''}`);
  return { device: j.device_code, code: j.user_code, url: String(j.verification_uri || `${web()}/login/device`),
    expires: Number(j.expires_in) || 900, interval: Number(j.interval ?? 5) };
}
// Asked again at its interval until the human has entered the code.
const deviceToken = async (fetch: Fetch, device: string, now = Date.now()) => answer(await oauth(fetch, '/login/oauth/access_token',
  { client_id: CLIENT_ID, device_code: device, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }), now);
// A new pair for the refresh token, no secret (a device flow's token); the old pair works no more.
const refresh = async (fetch: Fetch, token: string, now = Date.now()) => answer(await oauth(fetch, '/login/oauth/access_token',
  { client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: token }), now);

// A REST call as the token's account: its status and its JSON (null when it is not).
async function get(fetch: Fetch, path: string, token: string) {
  const r = await fetch(`${api()}${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } });
  return { status: r.status, headers: r.headers, json: await r.json().catch((): null => null) as Record<string, unknown> | null };
}
// Who a token is: its login, and a fine-grained token's end, which GitHub says in a header of every answer
// ("2027-01-01 00:00:00 UTC"); null: GitHub refused it.
async function user(fetch: Fetch, token: string) {
  const r = await get(fetch, '/user', token);
  if (r.status !== 200 || typeof r.json?.login !== 'string') return null;
  const end = r.headers.get('github-authentication-token-expiration');
  const ends = end ? Date.parse(end.trim().replace(' UTC', 'Z').replace(' ', 'T')) : NaN;
  return { login: r.json.login, ends: Number.isNaN(ends) ? undefined : ends };
}
// Whether the token reaches the repository (owner/repo): GitHub answers 404 for one it may not see, as for one not there.
// 401: the token itself is refused.
const reaches = async (fetch: Fetch, token: string, repo: string) => (await get(fetch, `/repos/${repo}`, token)).status;
// The accounts Kulisa App is installed on that this user may use (a user token's alone), or null when GitHub did not say.
async function installations(fetch: Fetch, token: string) {
  const r = await get(fetch, '/user/installations?per_page=100', token);
  const list = r.status === 200 && Array.isArray(r.json?.installations) ? r.json.installations as { account?: { login?: string; slug?: string } }[] : null;
  return list && list.map((i) => i.account?.login || i.account?.slug || '').filter(Boolean);
}

export type { Fetch, Tokens };
export { deviceCode, deviceToken, refresh, user, reaches, installations };
