// Which account recognizes speech for agents without dictation of their own (src/dictation, the hidden session): the
// first account, in Settings → Agents' order, of an agent that can (its entry's recognizer, agents/) and whose
// sign-in gives it. Its session runs in a folder of Kulisa's (dictation/ in the data folder), trusted as a task's is;
// what it keeps of that folder in its account goes when it ends, and at the next start after a crash (the folder still
// there).
import fs from 'fs';
import path from 'path';
import { removeTree } from './remove.ts';
import { findAgent } from './agents/index.ts';
import type { Recognizer } from '../dictation/main/index.ts';
import type { Shell } from './shell.ts';

// clean: what a session left when Kulisa did not end it (a crash) goes; once the accounts are known.
function recognizer(shell: Shell, userData: string): Recognizer & { clean(): void } {
  const folder = path.join(userData, 'dictation');
  const accounts = () => shell.accounts.all().filter((a) => !a.own && a.dir && a.agent.recognizer && a.agent.command);
  const able = () => accounts().filter((a) => a.agent.recognizer!.available(a.dir!));
  const forget = (id: string) => {
    const a = accounts().find((x) => x.id === id);
    if (a) a.agent.forget?.({ folder, configDir: a.dir });
    removeTree(folder);
  };
  return {
    clean: () => { if (fs.existsSync(folder)) for (const a of accounts()) forget(a.id); },
    available: () => {
      if (able().length) return null;
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
      a.agent.trust?.set({ configDir: a.dir }, folder);
      return {
        id: a.id, command: found.path || a.agent.command!, args: r.args(), cwd: folder,
        env: { ...r.env(process.env), [a.agent.config!.env]: a.dir!, KULISA_URL: `${shell.mcp.base}/dictation` },
        key: r.key, repeat: r.repeat, clear: r.clear, submit: r.submit,
      };
    },
    forget,
  };
}

export { recognizer };
