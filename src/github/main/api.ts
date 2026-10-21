// What Kulisa asks GitHub (README, How it signs in): the device flow's code and token, a refresh, who a token is,
// whether it reaches a repository, where Kulisa App is installed. Through @octokit/request (GitHub's own; its REST,
// whose ETag answers cost nothing when nothing changed) over the fetch the caller gives (Electron's net.fetch:
// Chromium's network, the system's proxy). Nothing here logs: what goes and comes holds tokens.
import { request } from '@octokit/request';

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

// github.com's OAuth endpoints answer an error with 200 and its code in the body, as JSON when asked so. Not
// @octokit/oauth-methods: its refresh requires the client secret, which a device flow's token does without.
async function oauth(fetch: Fetch, path: string, params: Record<string, string>) {
  const r = await request(`POST ${web()}${path}`, { ...params, headers: { accept: 'application/json' }, request: { fetch } });
  return r.data as Record<string, unknown>;
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

// GitHub's REST as the token's account; an answer of 4xx or 5xx is thrown (RequestError, its status), a network
// failure too (no status).
const rest = (fetch: Fetch, token: string) => request.defaults({ baseUrl: api(), headers: { authorization: `Bearer ${token}` }, request: { fetch } });
const statusOf = (e: unknown): number => { const s = (e as { status?: unknown }).status; if (typeof s === 'number') return s; throw e; };
// GitHub's refusal as null; a network failure still thrown.
const refused = (e: unknown): null => { statusOf(e); return null; };

// Who a token is: its login, and a fine-grained token's end, which GitHub says in a header of every answer
// ("2027-01-01 00:00:00 UTC"); null: GitHub refused it.
async function user(fetch: Fetch, token: string) {
  const r = await rest(fetch, token)('GET /user').catch(refused);
  if (!r) return null;
  const end = r.headers['github-authentication-token-expiration'];
  const ends = typeof end === 'string' ? Date.parse(end.trim().replace(' UTC', 'Z').replace(' ', 'T')) : NaN;
  return { login: r.data.login, ends: Number.isNaN(ends) ? undefined : ends };
}
// Whether the token reaches the repository (owner/repo): GitHub answers 404 for one it may not see, as for one not there.
// 401: the token itself is refused.
async function reaches(fetch: Fetch, token: string, repo: string) {
  const [owner = '', name = ''] = repo.split('/');
  return rest(fetch, token)('GET /repos/{owner}/{repo}', { owner, repo: name }).then((r) => r.status, statusOf);
}
// The accounts Kulisa App is installed on that this user may use (a user token's alone), or null when GitHub did not say.
async function installations(fetch: Fetch, token: string) {
  const r = await rest(fetch, token)('GET /user/installations', { per_page: 100 }).catch(refused);
  return r && r.data.installations.map((i) => (i.account && ('login' in i.account ? i.account.login : i.account.slug)) || '').filter(Boolean);
}

export type { Fetch, Tokens };
export { deviceCode, deviceToken, refresh, user, reaches, installations };
