// What is "local" (profiles.md, "Test users' sign-ins"): the one definition in the core of an address on the
// developer's own machine or network, where the app under test runs, for where a test user's login-password pair may be
// typed. localhost and its subdomains, the names kept for testing and local networks (*.test, *.local), loopback and
// private addresses, plus a project's own list (a tunnel such as ngrok, its dev domains). An address left
// out is safe the other way: a pair is not typed there.
// Plain Node: unit-tested.
import ipaddr from 'ipaddr.js';

// ipaddr.js's names of the ranges, IPv4's and IPv6's; process() reads IPv4 written as IPv6 (::ffff:127.0.0.1) as IPv4.
const LOCAL_RANGES = ['loopback', 'private', 'linkLocal', 'uniqueLocal'];
const localIp = (host: string) => ipaddr.isValid(host) && LOCAL_RANGES.includes(ipaddr.process(host).range());
// Account providers no pair is ever typed on, even reached from a local app (Sign in with Google): a test account there
// is signed in to by the human, in the profile's master.
const PROVIDERS = ['google.com', 'microsoft.com', 'microsoftonline.com', 'live.com', 'apple.com', 'github.com', 'facebook.com',
  'okta.com', 'oktapreview.com', 'windows.net'];

const hostOf = (url: string | undefined) => { try { return new URL(url!).hostname.toLowerCase().replace(/^\[|\]$/g, ''); } catch { return ''; } };
const under = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

// extra: the project's own hosts (Project Settings…), each with its subdomains.
function isLocal(url: string | undefined, extra: string[] = []) {
  const host = hostOf(url);
  if (!host) return false;
  if (host === 'localhost' || localIp(host)) return true;
  if (['localhost', 'test', 'local'].some((d) => host.endsWith(`.${d}`))) return true;
  return extra.some((d) => d && under(host, d.trim().toLowerCase()));
}
// Where a pair may be typed: a local page, or a page the same tab reached from one (an Auth0 dev tenant, a local
// Keycloak on another name) unless it is a big account provider's. history: the tab's addresses, the current last.
function loginAllowed(history: string[], extra: string[] = []) {
  const now = history.at(-1);
  if (isLocal(now, extra)) return true;
  const host = hostOf(now);
  if (!host || PROVIDERS.some((d) => under(host, d))) return false;
  return history.slice(0, -1).some((u) => isLocal(u, extra));
}

export { isLocal, loginAllowed };
