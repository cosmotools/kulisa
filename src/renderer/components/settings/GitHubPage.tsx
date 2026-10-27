// Settings → GitHub (src/github/README.md, The window): the GitHub accounts, a card with its list; an account added with
// Kulisa App (the device flow: Kulisa shows GitHub's code itself) or a fine-grained token, signed in again, deleted.
// Read as it is shown, not as Settings opens: where Kulisa App is installed is asked of GitHub.
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Field, Input, Link, makeStyles, MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle, Text,
  tokens } from '@fluentui/react-components';
import { AddRegular, SubtractRegular } from '@fluentui/react-icons';
import { ButtonMenu, RightClickMenu, type Item } from '../Menus';
import { List } from './List';
import { Group, Tool } from './Group';
import { refused } from '../../../shared/result';
import { NEW_TOKEN, type GitHubAccount, type GitHubInfo } from '../../../github/ipc';
import { useCommonStyles } from '../theme';
import { ErrorBar } from '../ErrorBar';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  buttons: { display: 'flex', gap: tokens.spacingHorizontalS, justifyContent: 'end' },
});

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const installed = (a: GitHubAccount) => (a.kind === 'pat' ? 'a token' : a.installed === null ? '—' : a.installed.join(', ') || 'nowhere yet');

export function GitHubPage() {
  const styles = useStyles(), common = useCommonStyles();
  const [info, setInfo] = useState<GitHubInfo | null>(null), [sel, setSel] = useState<string>(), [error, setError] = useState('');
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
    show(done); setSel(done.id);
  }
  async function withToken(again: string | null = null) {
    if (signing) await cancelSignin();
    setError(''); setTokenError(''); setToken(''); setPasting({ again });
  }
  async function addToken() {
    if (!token.trim()) { tokenField.current?.focus(); return; }
    const r = await kulisa.invoke('github:token', { token, again: pasting?.again ?? null });
    if (refused(r)) { setTokenError(r.error); return; }
    setPasting(null); setToken(''); show(r); setSel(r.id);
  }
  const again = (a: GitHubAccount) => (a.kind === 'app' ? withGitHub(a.id) : withToken(a.id));
  async function remove(id = sel) {
    if (!id) return;
    setError('');
    const r = await kulisa.invoke('github:delete', { id });
    if (refused(r)) { setError(r.error ?? ''); return; } // null: the human said no
    show(r);
    if (!r.accounts.some((x) => x.id === sel)) setSel(undefined);
  }

  const addMenu = (): Item[] => [{ heading: 'Add Account' },
    { label: 'With GitHub…', sub: 'Kulisa App, on the repositories you install it on', run: () => withGitHub() },
    { label: 'With a Token…', sub: 'a fine-grained token, where Kulisa App is not installed', run: () => withToken() }];
  const rowMenu = (e: MouseEvent): Item[] | null => {
    const id = (e.target as Element).closest<HTMLElement>('[data-github]')?.getAttribute('data-github'), a = info?.accounts.find((x) => x.id === id);
    if (!a) return null;
    setSel(a.id);
    return [{ label: 'Sign in Again…', run: () => again(a) }, { label: 'Delete…', run: () => remove(a.id) }];
  };
  if (!info) return null;

  return <div className={styles.page}>
    {!info.kept && <MessageBar intent="warning"><MessageBarBody>
      This computer has no keyring, so sign-ins are not kept: you sign in again after Kulisa restarts.</MessageBarBody></MessageBar>}

    <Group title="Accounts" hint="Your GitHub accounts, for your agents' work on GitHub. Each repository of a project goes as one of them (its row on the project's page)." tools={<>
      {/* never disabled: a new way replaces the one under way */}
      <ButtonMenu items={addMenu}><Tool label="Add an account" icon={<AddRegular />} /></ButtonMenu>
      <Tool label="Delete the account (asks first)" icon={<SubtractRegular />} disabled={!sel} onClick={() => void remove()} />
    </>}>
      {info.accounts.length ? <RightClickMenu items={rowMenu}>
        <List label="GitHub accounts" attr="github" rows={info.accounts} id={(a) => a.id} rowLabel={(a) => a.login} selected={sel} onSelect={setSel}
          onDelete={(k) => void remove(k)} columns={[
            { label: 'Account', width: '22%', cell: (a) => a.login },
            { label: 'Kulisa App on', cell: (a) => <Text size={200}>{installed(a)}</Text> },
            { label: 'Projects', cell: (a) => <Text size={200}>{a.projects.length ? `in ${a.projects.join(', ')}` : 'in no project'}</Text> },
            { label: 'Signed in', width: '22%', cell: (a) => (a.signedIn ? <Text size={200}>{a.ends === null ? 'no end' : `until ${day(a.ends)}`}</Text>
              : <Badge appearance="tint" color="warning">signed out</Badge>) },
          ]} />
      </RightClickMenu> : <Text size={200}>No accounts yet.</Text>}

      {/* named by its title (MessageBar's aria-labelledby) */}
      {signing && <MessageBar intent="info" layout="multiline">
        <MessageBarBody className={styles.stack}>
          <MessageBarTitle>Sign in with GitHub</MessageBarTitle>
          <Text size={200}>Enter this code on GitHub's page, which opened in your browser (<Link href={signing.url} target="_blank">open it again</Link>):</Text>
          {/* GitHub's code in a monospace font: read and typed without a mistake (0 and O) */}
          <Text font="monospace" size={500} weight="semibold" data-testid="code" className={common.selectable}>{signing.code}</Text>
          <Text size={200}>Enter a code on GitHub only when Kulisa has just shown it to you: a code someone else gives you signs them in as you.</Text>
        </MessageBarBody>
        <MessageBarActions>
          <Button onClick={() => void navigator.clipboard.writeText(signing.code).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy'}</Button>
          <Button onClick={() => void cancelSignin()}>Cancel</Button>
        </MessageBarActions>
      </MessageBar>}

      {pasting && <form aria-label="Add a token" className={styles.stack} onSubmit={(e) => { e.preventDefault(); void addToken(); }}>
        <Field label="Token" validationMessage={tokenError || undefined} className={common.selectable}
          hint={<>A fine-grained token: <Link href={NEW_TOKEN} target="_blank">make one on GitHub</Link>, its resource owner the organization or user
            of your repositories (an organization may have to approve it), then paste it here.</>}>
          <Input ref={tokenField} type="password" value={token} placeholder="github_pat_…" spellCheck={false}
            onChange={(_, d) => { setToken(d.value); setTokenError(''); }}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setPasting(null); } }} />
        </Field>
        <div className={styles.buttons}>
          <Button onClick={() => setPasting(null)}>Cancel</Button>
          <Button appearance="primary" type="submit">Add</Button>
        </div>
      </form>}
      {/* a refusal not at the token's field */}
      {error && <ErrorBar>{error}</ErrorBar>}
    </Group>
  </div>;
}
