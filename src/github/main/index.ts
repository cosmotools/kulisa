// GitHub's main process half: its entry (../README.md). The caller makes a GitHub (its data folder, the keyring, the
// fetch) and installs its channels, saying what only the rest knows: the projects that use an account, where a question
// is asked, what goes with a deleted account outside, how a page opens in the user's browser.
import { handle } from '../../main/ipc.ts';
import { GitHub } from './github.ts';
import { REVOKE } from '../ipc.ts';
import type { IpcMainInvokeEvent } from 'electron';
import type { Question } from '../../shared/types.ts';
import type { GitHubInfo } from '../ipc.ts';

interface Caller {
  usedBy(id: string): string[]; // the names of the projects bound to it
  ask(e: IpcMainInvokeEvent, q: Question): Promise<boolean>; // in the window the message came from
  forget(id: string): void; // deleted: the projects bound to it let go of it
  open(url: string): void; // GitHub's page, in the user's browser
}

function installGitHub(gh: GitHub, { usedBy, ask, forget, open }: Caller) {
  const info = async (): Promise<GitHubInfo> => ({ accounts: await gh.list(usedBy), kept: gh.kept() });
  const after = async (r: { id: string; error?: undefined } | { error: string | null }) => ('id' in r && r.id ? { ...(await info()), id: r.id } : { error: r.error ?? null });
  handle('github:accounts', info);
  handle('github:signin', async (_e, { again = null } = {}) => {
    try { return await gh.startFlow(again); } catch (e) { return { error: (e as Error).message.startsWith('GitHub') ? (e as Error).message : 'GitHub could not be reached' }; }
  });
  handle('github:signin-wait', async () => after(await gh.waitFlow(open)));
  handle('github:signin-cancel', () => gh.cancelFlow());
  handle('github:token', async (_e, { token, again = null }) => {
    const r = await gh.addToken(String(token ?? ''), again);
    return 'id' in r && r.id ? { ...(await info()), id: r.id } : { error: r.error ?? 'not added' };
  });
  // Its tokens forgotten (README, Deleting): GitHub's API to revoke them needs the App's secret, which Kulisa has not,
  // so the question names the page where the human revokes it.
  handle('github:delete', async (e, { id }) => {
    const a = gh.accounts.get(id);
    if (!a) return { error: `no account ${id}` };
    const projects = usedBy(id);
    if (!await ask(e, { message: `Delete the GitHub account ${a.login}?`, ok: 'Delete', danger: true,
      detail: [`Kulisa forgets its sign-in${projects.length ? `, and the projects ${projects.join(', ')} let go of it` : ''}.`,
        a.kind === 'app' ? 'GitHub keeps the sign-in until it ends (8 hours, or 6 months for its refresh): revoke Kulisa App on GitHub to end it now.'
          : 'The token stays on GitHub until it ends: delete it there to end it now.'].join(' '),
      link: { url: REVOKE[a.kind], label: a.kind === 'app' ? 'Revoke on GitHub' : 'Your tokens on GitHub' } })) return { error: null };
    forget(id);
    gh.accounts.delete(id);
    return info();
  });
}

export { GitHub, installGitHub };
