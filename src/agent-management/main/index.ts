// Agent management's public entry (../README.md). The caller supplies window context and project usage;
// account lifecycle, CLI discovery and installation remain independent of those domains.
import electron from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { handle } from '../../main/ipc.ts';
import { refused } from '../../shared/result.ts';
import { Accounts } from './accounts.ts';
import type { Account } from './accounts.ts';

interface Caller {
  usedBy(id: string): string[];
  choices(event: IpcMainInvokeEvent, details?: boolean): { accounts: Account[]; cwd: string };
  changed(): void;
  serial<T>(action: () => Promise<T>): Promise<T>;
}

function installAgentManagement(manager: Accounts, caller: Caller) {
  const info = () => manager.info(caller.usedBy);
  handle('account:list', info);
  handle('account:existing', (_e, { agent }) => manager.existing(agent));
  handle('account:connect-existing', (_e, { agent }) => caller.serial(async () => {
    const result = await manager.connectExisting(agent);
    if (refused(result)) return result;
    caller.changed();
    return { ...info(), ...result };
  }));
  handle('account:show-folder', async (_e, { id }) => {
    const account = manager.find(id);
    if (!account?.dir) return { error: 'No configuration directory for this account' };
    const error = await electron.shell.openPath(account.dir);
    return error ? { error } : {};
  });
  handle('account:signin:cancel', (_e, { key }) => manager.cancel(key));
  handle('agent:list', (e, options = {}) => {
    const { accounts, cwd } = caller.choices(e, options.details);
    return manager.list(accounts, cwd, options);
  });
  handle('agent:install:start', (e, { id }) => manager.install(id, caller.choices(e).cwd, (data) => {
    if (!e.sender.isDestroyed()) e.sender.send('agent:install:output', data);
  }));
}

export { Accounts, installAgentManagement };
export type { Account } from './accounts.ts';
