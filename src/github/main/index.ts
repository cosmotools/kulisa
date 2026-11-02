// GitHub's main process half: its entry (../README.md). The caller makes a GitHub (its data folder, the keyring, the
// fetch) and installs its channels, saying what only the rest knows: the projects that use an account, where a question
// is asked, what goes with a deleted account outside, how a page opens in the user's browser.
import { handle } from '../../main/ipc.ts';
import { GitHub } from './github.ts';
import type { IpcMainInvokeEvent } from 'electron';
import { refused } from '../../shared/result.ts';
import type { Result } from '../../shared/result.ts';
import type { GitHubInfo } from '../ipc.ts';

interface Caller {
  usedBy(id: string): string[]; // the names of the projects bound to it
  remove(e: IpcMainInvokeEvent, id: string): Promise<Result<{ ok: true }, string | null>>; // deleted, asked in the window the message came from (null: the human said no)
  open(url: string): void; // GitHub's page, in the user's browser
}

function installGitHub(gh: GitHub, { usedBy, remove, open }: Caller) {
  const info = async (): Promise<GitHubInfo> => ({ accounts: await gh.list(usedBy), kept: gh.kept() });
  const signedIn = async <E extends string | null>(r: Result<{ id: string }, E>) => (refused(r) ? r : { ...(await info()), id: r.id });
  handle('github:account:list', info);
  handle('github:signin:start', async (_e, { again = null } = {}) => {
    try { return await gh.startFlow(again); } catch { return { error: 'GitHub could not be reached' }; }
  });
  handle('github:signin:wait', async () => signedIn(await gh.waitFlow(open)));
  handle('github:signin:cancel', () => gh.cancelFlow());
  handle('github:signin:token', async (_e, { token, again = null }) => signedIn(await gh.addToken(String(token ?? ''), again)));
  handle('github:account:delete', async (e, { id }) => { const r = await remove(e, id); return refused(r) ? r : info(); });
}

export { GitHub, installGitHub };
