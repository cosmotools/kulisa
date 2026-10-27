// An agent's page in Settings (docs/tasks.md, "Choosing the agent", Accounts), as JetBrains' SDKs: who makes it, where it
// is, Install (agents.ts: the install goes on while another page is shown), and its accounts: Add Account signs in to a
// new one (SignIn.tsx), Delete deletes one (asked first).
import { createElement, useEffect, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Alert, AlertDescription, Avatar, AvatarFallback, Badge, Button, Card, CardAction, CardDescription, CardHeader, CardTitle } from '@ui';
import { install, loadAccounts, openInstallDetails, shortPath, showAccounts, useAgents } from './agents';
import { Section, Things } from './kit';
import { agentMark } from '../AgentMark';
import { SignIn } from '../SignIn';
import { ErrorBar } from '../ErrorBar';
import { Working } from '../Working';
import { Details } from '../Details';
import { refused } from '../../../shared/result';
import type { AgentInfo } from '../../../shared/types';

export function AgentPage({ agent: a, signing, onSigning }: { agent: AgentInfo; signing: boolean; onSigning: (on: boolean) => void }) {
  const { accounts, clis, install: inst } = useAgents();
  const [error, setError] = useState('');
  useEffect(() => { void loadAccounts(); }, []); // as now: made in a project, or let go by one, meanwhile

  const mine = accounts.filter((x) => x.agent === a.id);
  const where = a.path ? [a.version, shortPath(a.path), a.onPath === false && 'not on your PATH: Kulisa runs it from here'].filter(Boolean).join(' · ') : '';
  const installing = !!inst?.running, shown = inst?.id === a.id ? inst : null;
  async function remove(id: string) {
    setError('');
    const r = await kulisa.invoke('account:delete', { id });
    if (refused(r)) { setError(r.error ?? ''); return; } // null: the human said no
    showAccounts(r);
  }
  const fact = (label: string, value: string, testid?: string) => <div className="flex flex-col gap-0.5">
    <span className="font-medium">{label}</span><span data-selectable data-testid={testid} className="text-muted-foreground">{value}</span>
  </div>;

  // section, data-agent: the tests' handle on the page shown (docs/testing.md).
  return <section aria-label={a.name} data-agent={a.id} className="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {createElement(agentMark(a.id), { className: 'size-10 shrink-0' })}
          <div className="flex flex-col gap-1">
            <CardTitle role="heading" aria-level={2}><span className="flex items-center gap-2">{a.name}
              <Badge role="status" variant={a.installed ? 'default' : 'secondary'}>{a.installed ? 'Installed' : 'Not installed'}</Badge></span></CardTitle>
            <CardDescription>{a.maker || '—'}{a.site && <> · <a href={a.site} target="_blank" rel="noreferrer" className="underline underline-offset-4">Website</a></>}</CardDescription>
          </div>
        </div>
        {!a.installed && a.install && <CardAction><Button disabled={installing} onClick={() => void install(a.id)}>Install</Button></CardAction>}
      </CardHeader>
    </Card>

    <Section title="About">
      {a.needs && fact('Needs', a.needs)}
      {where ? fact('Installed at', where, 'agent-where') : a.install && fact('Install', `Runs ${a.maker || 'its maker'}'s installer: ${a.install}`)}
      {shown?.progress && (shown.running ? <Working>{shown.progress}</Working>
        : <Alert><AlertDescription>{shown.progress}</AlertDescription></Alert>)}
      {shown && <Details open={shown.open} onOpenChange={openInstallDetails}>
        {/* the installer's output as its terminal showed it */}
        <div role="log" aria-label="What the installer said" data-selectable className="max-h-64 overflow-auto font-mono text-xs whitespace-pre-wrap">{shown.log}</div>
      </Details>}
      {shown?.error && <ErrorBar>{shown.error}</ErrorBar>}
    </Section>

    {clis.includes(a.id) && <Section title="Accounts" action={<Button variant="outline" size="sm" disabled={!a.installed || signing}
      onClick={() => { setError(''); onSigning(true); }}><PlusIcon data-icon="inline-start" />Add Account</Button>}>
      <Things label="Accounts" menu={(id) => [{ label: 'Delete…', run: () => remove(id) }]}
        empty={signing ? undefined : 'No accounts yet: each its own sign-in, added to a project on its page.'}
        things={mine.map((x) => { const name = x.email || x.id; return { key: x.id, name, data: { 'data-account': x.id },
          media: <Avatar size="sm"><AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>,
          description: x.projects.length ? `in ${x.projects.join(', ')}` : 'in no project' }; })} />
      {signing && <SignIn agent={a} onDone={(r) => { onSigning(false); showAccounts(r); }} onClose={() => onSigning(false)} />}
      {error && <ErrorBar>{error}</ErrorBar>}
    </Section>}
  </section>;
}
