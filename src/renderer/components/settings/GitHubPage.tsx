// Settings → GitHub (src/github/README.md, The window): the GitHub accounts, a row each; an account added with
// Kulisa App (the device flow: Kulisa shows GitHub's code itself) or a fine-grained token, signed in again, deleted.
// Read as it is shown, not as Settings opens: where Kulisa App is installed is asked of GitHub. Stock Fluent only (docs/ui.md, Settings).
import { useEffect, useRef, useState } from 'react';
import { Avatar, Badge, Button, Card, CardFooter, CardHeader, Field, Input, Link, MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle, Subtitle2,
  Table, TableBody, TableCell, TableCellActions, TableCellLayout, TableRow, Text } from '@fluentui/react-components';
import { AddRegular, MoreHorizontalRegular } from '@fluentui/react-icons';
import { ButtonMenu, RightClickMenu, type Item } from '../Menus';
import { refused } from '../../../shared/result';
import { NEW_TOKEN, type GitHubAccount, type GitHubInfo } from '../../../github/ipc';
import { ErrorBar } from '../ErrorBar';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const installed = (a: GitHubAccount) => (a.kind === 'pat' ? 'a token' : a.installed === null ? '—' : a.installed.join(', ') || 'nowhere yet');

export function GitHubPage() {
  const [info, setInfo] = useState<GitHubInfo | null>(null), [error, setError] = useState('');
  const [tokenError, setTokenError] = useState(''); // GitHub's refusal of the token pasted, at its field
  // Signing in with Kulisa App: the code GitHub gave, until it is entered (again: the account signed in again).
  const [signing, setSigning] = useState<{ again: string | null; code: string; url: string } | null>(null), [copied, setCopied] = useState(false);
  // A token being pasted (again: the account it is a new token for).
  const [pasting, setPasting] = useState<{ again: string | null } | null>(null), [token, setToken] = useState('');
  const tokenField = useRef<HTMLInputElement>(null), code = useRef<string | null>(null);
  const show = (r: GitHubInfo) => setInfo({ accounts: r.accounts, kept: r.kept });

  // Shown: read again (an account's projects and sign-in change elsewhere). Left: a code no longer on screen is not to
  // be entered, so its sign-in ends.
  useEffect(() => {
    void kulisa.invoke('github:accounts').then(show);
    return () => { if (code.current) { code.current = null; void kulisa.invoke('github:signin-cancel'); } };
  }, []);
  // The field takes the keyboard once the menu that opened it has given it back to its button.
  useEffect(() => { if (pasting) requestAnimationFrame(() => tokenField.current?.focus()); }, [pasting]);

  async function cancelSignin() { code.current = null; setSigning(null); await kulisa.invoke('github:signin-cancel'); }
  async function withGitHub(again: string | null = null) {
    setError(''); setPasting(null);
    const r = await kulisa.invoke('github:signin', { again });
    if (refused(r)) { setError(r.error); return; }
    code.current = r.code; setSigning({ again, ...r }); setCopied(false);
    const done = await kulisa.invoke('github:signin-wait');
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
    if (!token.trim()) { tokenField.current?.focus(); return; }
    const r = await kulisa.invoke('github:token', { token, again: pasting?.again ?? null });
    if (refused(r)) { setTokenError(r.error); return; }
    setPasting(null); setToken(''); show(r);
  }
  const again = (a: GitHubAccount | undefined) => a && (a.kind === 'app' ? withGitHub(a.id) : withToken(a.id));
  async function remove(id: string) {
    setError('');
    const r = await kulisa.invoke('github:delete', { id });
    if (refused(r)) { setError(r.error ?? ''); return; } // null: the human said no
    show(r);
  }

  const addMenu = (): Item[] => [{ heading: 'Add Account' },
    { label: 'With GitHub…', sub: 'Kulisa App, on the repositories you install it on', run: () => withGitHub() },
    { label: 'With a Token…', sub: 'a fine-grained token, where Kulisa App is not installed', run: () => withToken() }];
  const menu = (id: string): Item[] => [{ label: 'Sign in Again…', run: () => again(info?.accounts.find((a) => a.id === id)) }, { label: 'Delete…', run: () => remove(id) }];
  if (!info) return null;

  return <Card appearance="subtle">
    {!info.kept && <MessageBar intent="warning"><MessageBarBody>
      This computer has no keyring, so sign-ins are not kept: you sign in again after Kulisa restarts.</MessageBarBody></MessageBar>}

    <Card role="group" aria-label="Accounts">
      {/* never disabled: a new way replaces the one under way */}
      <CardHeader header={<Subtitle2>Accounts</Subtitle2>} action={<ButtonMenu end items={addMenu}><Button icon={<AddRegular />}>Add Account</Button></ButtonMenu>} />
      {info.accounts.length ? <RightClickMenu items={(e) => { const k = (e.target as Element).closest<HTMLElement>('[data-row]')?.dataset.key; return k ? menu(k) : null; }}>
        {/* data-row, data-key, aria-label: the tests' handles (docs/testing.md); the right-click is the table's: a menu's trigger wraps its child in a box, which a row cannot have */}
        <Table aria-label="Accounts"><TableBody>{info.accounts.map((a) =>
          <TableRow key={a.id} data-row="" data-key={a.id} aria-label={a.login} data-github={a.id} title={a.login}>
            <TableCell>
              <TableCellLayout truncate media={<Avatar size={32} name={a.login} />}
                description={[a.kind === 'pat' ? 'a token' : `Kulisa App on ${installed(a)}`, a.projects.length ? `in ${a.projects.join(', ')}` : 'in no project',
                  a.signedIn && (a.ends === null ? 'signed in, no end' : `signed in until ${day(a.ends)}`)].filter(Boolean).join(' · ')}>
                {a.login} {!a.signedIn && <Badge appearance="tint" color="warning">Signed out</Badge>}
              </TableCellLayout>
              <TableCellActions>
                <ButtonMenu end items={() => menu(a.id)}><Button appearance="subtle" icon={<MoreHorizontalRegular />} aria-label={`More for ${a.login}`} /></ButtonMenu>
              </TableCellActions>
            </TableCell>
          </TableRow>)}</TableBody></Table>
      </RightClickMenu> : <Text>No accounts yet: your agents work on GitHub as one; each repository of a project goes as one of them.</Text>}

      {/* named by its title (MessageBar's aria-labelledby) */}
      {signing && <MessageBar intent="info" layout="multiline">
        <MessageBarBody>
          <MessageBarTitle>Sign in with GitHub</MessageBarTitle>
          <Text block size={200}>Enter this code on GitHub's page, which opened in your browser (<Link href={signing.url} target="_blank">open it again</Link>):</Text>
          {/* GitHub's code in a monospace font: read and typed without a mistake (0 and O) */}
          <Text block font="monospace" size={500} weight="semibold" data-testid="code">{signing.code}</Text>
          <Text block size={200}>Enter a code on GitHub only when Kulisa has just shown it to you: a code someone else gives you signs them in as you.</Text>
        </MessageBarBody>
        <MessageBarActions>
          <Button onClick={() => void navigator.clipboard.writeText(signing.code).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy'}</Button>
          <Button onClick={() => void cancelSignin()}>Cancel</Button>
        </MessageBarActions>
      </MessageBar>}

      {pasting && <>
        <Field label="Token" validationMessage={tokenError || undefined}
          hint={<>A fine-grained token: <Link href={NEW_TOKEN} target="_blank">make one on GitHub</Link>, its resource owner the organization or user
            of your repositories (an organization may have to approve it), then paste it here.</>}>
          <Input ref={tokenField} type="password" value={token} placeholder="github_pat_…" spellCheck={false}
            onChange={(_, d) => { setToken(d.value); setTokenError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') void addToken(); if (e.key === 'Escape') { e.stopPropagation(); setPasting(null); } }} />
        </Field>
        <CardFooter>
          <Button onClick={() => setPasting(null)}>Cancel</Button>
          <Button appearance="primary" onClick={() => void addToken()}>Add</Button>
        </CardFooter>
      </>}
      {/* a refusal not at the token's field */}
      {error && <ErrorBar>{error}</ErrorBar>}
    </Card>
  </Card>;
}
