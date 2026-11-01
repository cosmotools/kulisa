// Settings' agents and their accounts (docs/tasks.md, Choosing the agent, Accounts), kept here rather than in a page,
// so an install goes on (and its output is kept) while another page is shown.
import { createStore, useStore } from 'zustand';
import { agentList } from '../../lib/agents';
import type { Account, AccountsInfo } from '../../../shared/types';

export const agents = agentList({ details: true, installed: (a) => `${a.name} is installed. Make an account of it below: + under Accounts.` });

// clis: the agents an account can be made of.
const accounts = createStore<{ accounts: Account[]; clis: string[] }>()(() => ({ accounts: [], clis: [] }));
export const useAccounts = () => useStore(accounts);
export const showAccounts = (r: Partial<AccountsInfo>) => accounts.setState({ ...(r.accounts && { accounts: r.accounts }), ...(r.clis && { clis: r.clis }) });
export const loadAccounts = async () => showAccounts(await kulisa.invoke('account:list'));
