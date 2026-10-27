// Settings' agents and their accounts (docs/tasks.md, Choosing the agent, Accounts): what the nav and an agent's page
// show, kept here rather than in a page, so an install goes on (and its output is kept) while another page is shown.
import { useSyncExternalStore } from 'react';
import { refused } from '../../shared/result';
import { tilde } from '../../shared/paths';
import type { Account, AccountsInfo, AgentInfo } from '../../shared/types';

interface Install { id: string; running: boolean; progress: string; log: string; error: string; open: boolean }
interface Agents {
  list: AgentInfo[]; home: string | null; looking: boolean;
  accounts: Account[]; clis: string[]; // clis: the agents an account can be made of
  install: Install | null; // the last one started, its output under Details
}
let now: Agents = { list: [], home: null, looking: false, accounts: [], clis: [], install: null };
const listeners = new Set<() => void>();
const set = (change: Partial<Agents>) => { now = { ...now, ...change }; for (const l of listeners) l(); };
const setInstall = (change: Partial<Install>) => set({ install: { ...now.install!, ...change } });
export const useAgents = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => now);

// The installer's output, streamed while it runs: it may come before any page shows it.
kulisa.on('agents:install-log', (data) => { if (now.install?.running) setInstall({ log: now.install.log + data }); });

// A folder with the home folder as ~.
export const shortPath = (p: string) => (now.home ? tilde(p, now.home, kulisa.platform === 'win32' ? '\\' : '/') : p);

// The agents (not the terminal only). cached: as the last look found them, at once ({ list: null } before the first);
// else looked for again (the user's shell, each one's --version: tenths of a second or more), saying so while there
// is no list yet. A look again that ends while an install runs is dropped: the install marks its own row. Whether a
// list came.
export async function loadAgents(cached: boolean) {
  if (!cached && !now.list.length) set({ looking: true });
  const r = await kulisa.invoke('agents:list', { details: true, cached });
  if (r.list && (cached || !now.install?.running)) set({ list: r.list, home: r.home });
  if (!cached) set({ looking: false });
  return !!r.list;
}
export const installing = () => !!now.install?.running;

export const showAccounts = (r: Partial<AccountsInfo>) => set({ ...(r.accounts && { accounts: r.accounts }), ...(r.clis && { clis: r.clis }) });
export const loadAccounts = async () => showAccounts(await kulisa.invoke('accounts:list'));

// Install: its maker's installer (the command shown before), its output under Details, opened by itself when it fails.
export async function install(id: string) {
  const a = now.list.find((x) => x.id === id);
  if (!a || now.install?.running) return;
  set({ install: { id, running: true, progress: `Installing ${a.name}…`, log: '', error: '', open: false } });
  const r = await kulisa.invoke('agents:install', { id });
  const installed = !refused(r) && r.installed;
  set({ list: now.list.map((x) => (x.id === id ? { ...x, installed } : x)) });
  setInstall({ running: false, ...(!refused(r) && { log: r.log }), // the whole of it: a piece streamed may come after the answer
    progress: installed ? `${a.name} is installed. Make an account of it below: + under Accounts.` : '',
    ...(!installed && { open: true, error: `${a.name} was not installed (${refused(r) ? r.error : `the installer ended with code ${r.code}`}). What the installer said is under Details: try again, or choose another agent.` }) });
  if (installed) await loadAgents(false); // where it went, its version
}
export const openInstallDetails = (open: boolean) => setInstall({ open });
