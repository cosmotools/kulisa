// Settings' agents and their accounts (docs/tasks.md, Choosing the agent, Accounts), kept here rather than in a page,
// so an install goes on (and its output is kept) while another page is shown.
import { createStore, useStore } from 'zustand';
import { agentList } from '../../lib/agents';
import type { Account, AccountsInfo } from '../../../shared/types';

export const agents = agentList({ details: true, installed: (a) => `${a.name} is installed. Connect a setup below under Accounts.` });

// clis: the agents an account can be made of.
const accounts = createStore<{ accounts: Account[]; clis: string[]; loaded: boolean; loading: boolean; error: string }>()(() => ({ accounts: [], clis: [], loaded: false, loading: false, error: '' }));
export const useAccounts = () => useStore(accounts);
let revision = 0;
export const showAccounts = (r: Partial<AccountsInfo>) => {
  revision++;
  accounts.setState({ ...(r.accounts && { accounts: r.accounts, loaded: true, error: '' }), ...(r.clis && { clis: r.clis }) });
};
let pending: Promise<void> | null = null;
export const loadAccounts = () => {
  if (pending) return pending;
  const read = revision;
  accounts.setState({ loading: true, error: '' });
  pending = kulisa.invoke('account:list').then((r) => { if (read === revision) showAccounts(r); })
    .catch((e: unknown) => { if (read === revision) accounts.setState({ error: String(e) }); })
    .finally(() => { pending = null; accounts.setState({ loading: false }); });
  return pending;
};
