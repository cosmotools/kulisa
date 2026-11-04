// Which account recognizes speech for agents without dictation of their own (src/dictation, the hidden session): the
// first account, in Settings → Agents' order, of an agent that can (its entry's recognizer, agents/) and whose
// sign-in gives it. Its session runs in a folder of Kulisa's (dictation/ in the data folder), trusted as a task's is;
// what it keeps of that folder in its account goes when it ends, and at the next start after a crash (the folder still
// there).
import fs from 'fs';
import path from 'path';
import { removeTree } from './remove.ts';
import { findAgent } from '../kulisa-plugin/main/index.ts';
import type { Recognizer } from '../dictation/main/index.ts';
import type { Shell } from './shell.ts';

// clean: what a session left when Kulisa did not end it (a crash) goes; once the accounts are known.
function recognizer(shell: Shell, userData: string): Recognizer & { clean(): void } {
  const folder = path.join(userData, 'dictation');
  const accounts = () => shell.accounts.all().filter((a) => !a.own && a.dir && a.agent.recognizer && a.agent.command);
  const signedIn = () => accounts().filter((a) => a.agent.recognizer!.available(a.dir!, a.defaultConfig));
  // A hidden terminal cannot ask the human to trust its folder. External configurations may use only a decision
  // already made in the CLI; Kulisa never adds trust to them just to enable dictation.
  const able = () => signedIn().filter((a) => a.origin === 'kulisa' || a.agent.trust?.has({ configDir: a.dir, defaultConfig: a.defaultConfig }, folder));
  const forget = (id: string) => {
    const a = accounts().find((x) => x.id === id);
    if (a?.origin === 'kulisa') a.agent.forget?.({ folder, configDir: a.dir });
    removeTree(folder);
  };
  return {
    clean: () => { if (fs.existsSync(folder)) for (const a of accounts()) forget(a.id); },
    available: () => {
      if (able().length) return null;
      if (signedIn().some((a) => a.origin === 'external')) return 'the external setup has not trusted Kulisa’s dictation folder. Connect a separate account in Settings → Agents to use dictation in other agents.';
      const names = [...new Set(shell.accounts.all().filter((a) => a.own && a.agent.recognizer).map((a) => a.agent.name))];
      if (!names.length) return 'no agent here can recognize speech for it';
      return `Kulisa recognizes speech for it with ${names.join(' or ')}, which needs an account of it signed in with a subscription (Settings → Agents)`;
    },
    start: async (skip) => {
      const a = able().find((x) => !skip.includes(x.id));
      if (!a) return { error: 'no account could start its dictation' };
      const r = a.agent.recognizer!, found = await findAgent(a.agent, userData);
      if (!found) return { error: `${a.agent.name} is not installed` };
      fs.mkdirSync(folder, { recursive: true });
      if (a.origin === 'kulisa') a.agent.trust?.set({ configDir: a.dir }, folder);
      return {
        id: a.id, command: found.path || a.agent.command!, args: r.args(), cwd: folder,
        env: Object.fromEntries(Object.entries({ ...r.env(process.env), [a.agent.config!.env]: a.defaultConfig ? undefined : a.dir!, KULISA_URL: `${shell.mcp.base}/dictation` }).filter((entry): entry is [string, string] => entry[1] !== undefined)),
        key: r.key, repeat: r.repeat, clear: r.clear, submit: r.submit,
      };
    },
    forget,
  };
}

export { recognizer };
