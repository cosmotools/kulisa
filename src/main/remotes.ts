// A repository's remote by what it points to: its host and path, the same for every way of writing it (https or ssh,
// a user, a token or a port in it, .git or not, any case), so two remotes are compared by their key
// (github.com/acme/shop). A GitHub account is bound to a repository by it (src/github/), and a project moved to another
// computer finds its repositories by it. In the base, beside git, as both are about repositories, not about
// GitHub: any host has a key. What the remote's address held besides (a user, a token) is dropped here, at once: a
// key never carries it, so nothing built on one can log or show it. docs/tasks.md, Projects.
import { execFile } from 'child_process';
import { git } from './worktrees.ts';

// What ssh says an SSH host name is (`ssh -G`, its config read: a Host alias in ~/.ssh/config gives its HostName),
// lower case, or null when ssh cannot say (not installed, an error).
type SshHost = (alias: string) => Promise<string | null>;
const sshHost: SshHost = (alias) => new Promise((resolve) => {
  // `--` ends ssh's options: a remote naming its host "-oProxyCommand=…" must not become one.
  execFile('ssh', ['-G', '--', alias], { timeout: 5000, windowsHide: true }, (e, out) => {
    resolve(e ? null : /^hostname (\S+)$/m.exec(String(out))?.[1]?.toLowerCase() ?? null);
  });
});
// Asked once a run per alias: a page lists every repository's remote each time it is shown.
const asked = new Map<string, Promise<string | null>>();
const cached: SshHost = (alias) => { if (!asked.has(alias)) asked.set(alias, sshHost(alias)); return asked.get(alias)!; };
// GitHub's SSH host over port 443 (ssh.github.com), for networks that close 22: the same GitHub.
const SAME = new Map([['ssh.github.com', 'github.com']]);

// The host and path a remote's address names, or null when it names none (a folder, file://). ssh: whether its host is
// SSH's, which may be an alias of ~/.ssh/config.
function parse(url: string): { host: string; path: string; ssh: boolean } | null {
  const s = url.trim();
  // scp-like: [user@]host:path, with no scheme and not a Windows drive (C:\…).
  const scp = /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/.exec(s);
  if (scp && !/^[a-z]:[\\/]/i.test(s) && !s.includes('://')) return { host: scp[1]!, path: scp[2]!, ssh: true };
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (!['https:', 'http:', 'ssh:', 'git:', 'git+ssh:', 'ssh+git:'].includes(u.protocol) || !u.hostname) return null;
  return { host: u.hostname, path: decodeURIComponent(u.pathname), ssh: u.protocol.includes('ssh') };
}

// The key of a remote's address: "<host>/<path>" in lower case, without its scheme, user, password or token, port and
// .git; an SSH host's real name (an alias through ssh -G). null: not a remote (a folder), or an SSH alias ssh cannot
// name (then what it points to is not known: a host name given as it is, github.com, is taken as it is, as with no
// ssh there is no config to make it another).
async function remoteKey(url: string, { ssh = cached }: { ssh?: SshHost } = {}): Promise<string | null> {
  const r = parse(url);
  if (!r) return null;
  let host = r.host.toLowerCase();
  if (r.ssh) {
    const real = await ssh(host);
    if (real) host = real;
    else if (!host.includes('.')) return null;
  }
  host = SAME.get(host) ?? host;
  const p = r.path.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').toLowerCase();
  return p && !p.split('/').some((x) => !x || x === '.' || x === '..') ? `${host}/${p}` : null;
}

// The key of a folder's repository's origin (where the human pushes), or null: no git, no origin, not a remote.
async function originKey(folder: string, opts?: { ssh?: SshHost }) {
  const url = await git(folder, ['config', '--get', 'remote.origin.url']).catch((): null => null);
  return url ? remoteKey(url, opts) : null;
}

export { remoteKey, originKey };
