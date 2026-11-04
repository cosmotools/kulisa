// An agent's page in Settings (docs/tasks.md, "Choosing the agent", Accounts).
import { createElement, useEffect, useState } from 'react';
import { CopyIcon, FolderOpenIcon, CircleAlertIcon } from 'lucide-react';
import { Avatar, AvatarFallback, Badge, Button, Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle, Alert, AlertDescription, Field,
  FieldTitle, FieldDescription, Card, CardHeader, CardTitle, CardContent } from '@ui';
import { agents, loadAccounts, showAccounts, useAccounts } from './agents';
import { Things } from './kit';
import { agentMark } from '../AgentMark';
import { AgentSetup } from '../AgentSetup';
import { toast } from 'sonner';
import { InstallProgress } from '../AgentPicker';
import { shortPath, useAgentList } from '../../lib/agents';
import { refused } from '../../../shared/result';
import type { AgentInfo } from '../../../shared/types';

export function AgentPage({ agent: a, signing, onSigning }: { agent: AgentInfo; signing: boolean; onSigning: (on: boolean) => void }) {
  const { accounts, clis } = useAccounts();
  const home = useAgentList(agents, (s) => s.home), installing = useAgentList(agents, (s) => s.installing);
  // The install's output on the page of the agent it is of.
  const shown = useAgentList(agents, (s) => s.showDetails && s.selected === a.id);
  const [error, setError] = useState('');
  useEffect(() => { void loadAccounts(); }, []); // as now: made in a project, or let go by one, meanwhile

  const mine = accounts.filter((x) => x.agent === a.id);
  const where = a.path ? [a.version, shortPath(a.path, home), a.onPath === false && 'not on your PATH: Kulisa runs it from here'].filter(Boolean).join(' · ') : '';
  async function remove(id: string) {
    setError('');
    const r = await kulisa.invoke('account:delete', { id });
    if (refused(r)) { setError(r.error ?? ''); return; } // null: the human said no
    showAccounts(r);
  }

  // section, data-agent: the tests' handle on the page shown (docs/testing.md).
  return <section aria-label={a.name} data-agent={a.id} className="flex flex-col gap-4">
    <Item variant="outline">
      <ItemMedia>{createElement(agentMark(a.id), { className: 'size-10' })}</ItemMedia>
      <ItemContent>
        <ItemTitle role="heading" aria-level={2}>{a.name}
          <Badge role="status" variant={a.installed ? 'default' : 'secondary'}>{a.installed ? 'Installed' : 'Not installed'}</Badge></ItemTitle>
        <ItemDescription>{a.maker || '—'}{a.site && <> · <a href={a.site} target="_blank" rel="noreferrer">Website</a></>}</ItemDescription>
      </ItemContent>
      {!a.installed && a.install && <ItemActions><Button disabled={installing} onClick={() => void agents.install(a.id)}>Install</Button></ItemActions>}
    </Item>

    <Card role="group" aria-label="About"><CardHeader><CardTitle>About</CardTitle></CardHeader><CardContent><div className="flex flex-col gap-3">
      {a.needs && <Field><FieldTitle>Needs</FieldTitle><FieldDescription data-selectable>{a.needs}</FieldDescription></Field>}
      {where ? <Field><FieldTitle>Installed at</FieldTitle><FieldDescription data-selectable data-testid="agent-where">{where}</FieldDescription></Field>
        : a.install && <Field><FieldTitle>Install</FieldTitle><FieldDescription data-selectable>{`Runs ${a.maker || 'its maker'}'s installer: ${a.install}`}</FieldDescription></Field>}
      {shown && <InstallProgress list={agents} />}
    </div></CardContent></Card>

    {clis.includes(a.id) && <Card role="group" aria-label="Accounts"><CardHeader><CardTitle>Accounts</CardTitle></CardHeader><CardContent><div className="flex flex-col gap-4">
      {!mine.length && !signing && <p className="text-sm text-muted-foreground">No accounts yet. Connect a setup to use it in projects.</p>}
      {mine.map((x) => <div key={x.id} className="flex flex-col gap-2">
        <Things label="Accounts" menu={() => [{ label: x.origin === 'external' ? 'Disconnect…' : 'Delete…', run: () => remove(x.id) }]}
          things={[{ key: x.id, name: x.email || x.id, data: { 'data-account': x.id },
            media: <Avatar size="sm"><AvatarFallback>{(x.email || x.id).slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>,
            description: x.projects.length ? `in ${x.projects.join(', ')}` : 'in no project' }]} />
        <div role="group" aria-label={`Configuration for ${x.email || x.id}`} className="flex flex-col gap-2 px-3">
          <Badge variant="outline">{x.origin === 'external' ? 'External configuration' : 'Created in Kulisa'}</Badge>
          <p data-selectable className="font-mono text-xs break-all text-muted-foreground">{x.directory}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void kulisa.invoke('account:show-folder', { id: x.id }).then((r) => { if (refused(r)) setError(r.error); })}><FolderOpenIcon />Open Folder</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void navigator.clipboard.writeText(x.directory).then(() => toast.success('Path copied')).catch((e: unknown) => setError(String(e)))}><CopyIcon />Copy Path</Button>
          </div>
          {x.origin === 'external' && <p className="text-xs text-muted-foreground">Shared with your other CLI sessions. Disconnecting keeps your files and sign-in.</p>}
        </div>
      </div>)}
      <AgentSetup agent={a} signing={signing} onSigning={onSigning} onDone={showAccounts} />
      {error && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{error}</span></AlertDescription></Alert>}
    </div></CardContent></Card>}
  </section>;
}
