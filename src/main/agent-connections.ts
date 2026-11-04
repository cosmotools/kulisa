// Direct use of an existing CLI configuration (docs/tasks.md, Accounts). Discovery is read-only; connection repeats
// native status rather than trusting a stale renderer result. CLI-specific locations/status remain in adapters.
import path from 'path';
import os from 'os';
import fs from 'fs';
import { accountEmail, findAgent } from '../kulisa-plugin/main/index.ts';
import { refused } from '../shared/result.ts';
import type { Shell } from './shell.ts';
import type { Result } from '../shared/result.ts';
import type { ExistingAgentSetup } from '../shared/types.ts';

async function existingSetup(shell: Shell, agentId: string): Promise<Result<{ setup: (ExistingAgentSetup & { defaultConfig: boolean }) | null }>> {
  const a = shell.accounts.find(agentId);
  if (!a?.own || !a.agent.config) return { error: 'This agent has no configurable accounts' };
  const directory = path.resolve(a.agent.config.home());
  const canonical = (dir: string) => { try { return fs.realpathSync(dir); } catch { return path.resolve(dir); } };
  const storage = path.join(shell.accounts.dir, 'agents');
  const inside = (root: string, dir: string) => {
    const relative = path.relative(root, dir);
    return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  };
  if (inside(storage, directory) || inside(canonical(storage), canonical(directory))) {
    return { error: 'This directory is managed by Kulisa. Select its existing account instead.' };
  }
  const found = await findAgent(a.agent, os.homedir());
  if (!found?.path) return { setup: null };
  const defaultConfig = !process.env[a.agent.config.env];
  const status = await accountEmail(a.agent, found, directory, defaultConfig);
  return { setup: status ? { directory, email: status.email, defaultConfig,
    account: shell.accounts.connectionAt(agentId, directory, defaultConfig)?.id ?? null } : null };
}

async function connectExisting(shell: Shell, agentId: string): Promise<Result<{ connected: string }>> {
  const result = await existingSetup(shell, agentId);
  if (refused(result)) return result;
  const { setup } = result;
  if (!setup) return { error: 'No signed-in setup found. Sign in to a new configuration, or sign in with your CLI and check again.' };
  const a = shell.accounts.connect(agentId, setup.directory, setup.email, setup.defaultConfig);
  shell.sendProjects();
  return { connected: a.id };
}

export { existingSetup, connectExisting };
