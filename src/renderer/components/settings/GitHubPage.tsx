// Settings → GitHub (src/github/README.md, The window): the GitHub accounts, a row each; an account added with
// Kulisa App (the device flow: Kulisa shows GitHub's code itself) or a fine-grained token, signed in again, deleted.
// Read as it is shown, not as Settings opens: where Kulisa App is installed is asked of GitHub.
import { useEffect, useRef, useState } from 'react';
import { PlusIcon, CircleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle, Avatar, AvatarFallback, Badge, Button, Card, CardHeader, CardTitle, CardContent, CardAction } from '@ui';
import { ButtonMenu } from '../Menus';
import { AddInPlace, Things } from './kit';
import type { MenuItem } from '../../lib/menu';
import { refused } from '../../../shared/result';
import { NEW_TOKEN, type GitHubAccount, type GitHubInfo } from '../../../github/ipc';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const installed = (a: GitHubAccount) => (a.kind === 'pat' ? 'a token' : a.installed === null ? '—' : a.installed.join(', ') || 'nowhere yet');

export function GitHubPage() {
  const [info, setInfo] = useState<GitHubInfo | null>(null), [error, setError] = useState('');
  const [tokenError, setTokenError] = useState(''); // GitHub's refusal of the token pasted, at its field
  // Signing in with Kulisa App: the code GitHub gave, until it is entered (again: the account signed in again).
  const [signing, setSigning] = useState<{ again: string | null; code: string; url: string } | null>(null);
  // A token being pasted (again: the account it is a new token for).
  const [pasting, setPasting] = useState<{ again: string | null } | null>(null), [token, setToken] = useState('');
  const code = useRef<string | null>(null);
  const show = (r: GitHubInfo) => setInfo({ accounts: r.accounts, kept: r.kept });

  // Shown: read again (an account's projects and sign-in change elsewhere). Left: a code no longer on screen is not to
  // be entered, so its sign-in ends.
  useEffect(() => {
    void kulisa.invoke('github:account:list').then(show);
    return () => { if (code.current) { code.current = null; void kulisa.invoke('github:signin:cancel'); } };
  }, []);

  async function cancelSignin() { code.current = null; setSigning(null); await kulisa.invoke('github:signin:cancel'); }
  async function withGitHub(again: string | null = null) {
    setError(''); setPasting(null);
    const r = await kulisa.invoke('github:signin:start', { again });
    if (refused(r)) { setError(r.error); return; }
    code.current = r.code; setSigning({ again, ...r });
    const done = await kulisa.invoke('github:signin:wait');
    if (code.current !== r.code) return; // cancelled, or another begun
    code.current = null; setSigning(null);
    if (refused(done)) { setError(done.error ?? ''); return; }
    show(done);
  }
  async function withToken(again: string | null = null) {
    if (signing) await cancelSignin();
    setError(''); setTokenError(''); setToken(''); setPasting({ again });
  }
  async function addToken() {
    if (!token.trim()) return;
    const r = await kulisa.invoke('github:signin:token', { token, again: pasting?.again ?? null });
    if (refused(r)) { setTokenError(r.error); return; }
    setPasting(null); setToken(''); show(r);
  }
  const again = (a: GitHubAccount | undefined) => a && (a.kind === 'app' ? withGitHub(a.id) : withToken(a.id));
  async function remove(id: string) {
    setError('');
    const r = await kulisa.invoke('github:account:delete', { id });
    if (refused(r)) { setError(r.error ?? ''); return; } // null: the human said no
    show(r);
  }

  const addMenu = (): MenuItem[] => [{ heading: 'Add Account' },
    { label: 'With GitHub…', sub: 'Kulisa App, on the repositories you install it on', run: () => withGitHub() },
    { label: 'With a Token…', sub: 'a fine-grained token, where Kulisa App is not installed', run: () => withToken() }];
  const menu = (id: string): MenuItem[] => [{ label: 'Sign in Again…', run: () => again(info?.accounts.find((a) => a.id === id)) }, { label: 'Delete…', run: () => remove(id) }];
  if (!info) return null;

  return <>
    {!info.kept && <Alert><AlertDescription>
      This computer has no keyring, so sign-ins are not kept: you sign in again after Kulisa restarts.</AlertDescription></Alert>}

    {/* never disabled: a new way replaces the one under way */}
    <Card role="group" aria-label="Accounts"><CardHeader><CardTitle>Accounts</CardTitle><CardAction><ButtonMenu end items={addMenu}><Button variant="outline" size="sm"><PlusIcon data-icon="inline-start" />Add Account</Button></ButtonMenu></CardAction></CardHeader><CardContent><div className="flex flex-col gap-3">
      <Things label="Accounts" menu={menu} empty="No accounts yet: your agents work on GitHub as one; each repository of a project goes as one of them."
        things={info.accounts.map((a) => ({ key: a.id, name: a.login, data: { 'data-github': a.id },
          media: <Avatar size="sm"><AvatarFallback>{a.login.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>,
          badges: !a.signedIn && <Badge variant="outline"><span className="text-warning">Signed out</span></Badge>,
          description: [a.kind === 'pat' ? 'a token' : `Kulisa App on ${installed(a)}`, a.projects.length ? `in ${a.projects.join(', ')}` : 'in no project',
            a.signedIn && (a.ends === null ? 'signed in, no end' : `signed in until ${day(a.ends)}`)].filter(Boolean).join(' · ') }))} />

      {signing && <div role="group" aria-label="Sign in with GitHub">
        <Alert>
          <AlertTitle>Sign in with GitHub</AlertTitle>
          <AlertDescription>
            <p>Enter this code on GitHub's page, which opened in your browser (<a href={signing.url} target="_blank" rel="noreferrer">open it again</a>):</p>
            {/* GitHub's code in a monospace font: read and typed without a mistake (0 and O) */}
            <p data-testid="code" data-selectable className="font-mono text-xl font-semibold text-foreground">{signing.code}</p>
            <p>Enter a code on GitHub only when Kulisa has just shown it to you: a code someone else gives you signs them in as you.</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(signing.code).then(() => toast.success('Copied'))}>Copy</Button>
              <Button variant="outline" size="sm" onClick={() => void cancelSignin()}>Cancel</Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>}

      {pasting && <AddInPlace label="Token" type="password" placeholder="github_pat_…" value={token} ok="Add" error={tokenError || undefined}
        description={<>A fine-grained token: <a href={NEW_TOKEN} target="_blank" rel="noreferrer">make one on GitHub</a>, its resource owner the
          organization or user of your repositories (an organization may have to approve it), then paste it here.</>}
        onChange={(v) => { setToken(v); setTokenError(''); }} go={() => void addToken()} stop={() => setPasting(null)} />}
      {/* a refusal not at the token's field */}
      {error && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{error}</span></AlertDescription></Alert>}
    </div></CardContent></Card>
  </>;
}
