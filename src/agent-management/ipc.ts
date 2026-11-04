// Agent discovery and configuration contracts (README.md). Project membership and task choices stay in core IPC.
import type { Result } from '../shared/result.ts';

export interface Account { id: string; agent: string; name: string; email: string | null; projects: string[]; origin: 'kulisa' | 'external'; directory: string }
export interface AccountsInfo { accounts: Account[]; clis: string[] }
export interface ExistingAgentSetup { directory: string; email: string | null; account: string | null }
export interface AgentInfo {
  id: string; name: string; maker?: string; needs?: string; site?: string; install?: string | null; installed?: boolean;
  account?: string | null; agent?: string; path?: string | null; onPath?: boolean | null; version?: string | null;
}
export interface ListOptions { check?: boolean; details?: boolean; cached?: boolean }

type I<A extends unknown[], R = void> = { args: A; result: R };
export interface AgentManagementInvoke {
  'account:list': I<[], AccountsInfo>;
  'account:existing': I<[{ agent: string }], Result<{ setup: ExistingAgentSetup | null }>>;
  'account:connect-existing': I<[{ agent: string }], Result<AccountsInfo & { connected: string }>>;
  'account:show-folder': I<[{ id: string }], Result>;
  'account:signin:cancel': I<[{ key: string }]>;
  'agent:list': I<[ListOptions?], { list: AgentInfo[]; home: string } | { list: null }>;
  'agent:install:start': I<[{ id: string }], Result<{ code: number; installed: boolean; log: string }>>;
}
export interface AgentManagementEvents { 'agent:install:output': string }
