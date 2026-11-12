// Starting-agent table (docs/tasks.md, Projects). One row per configuration, plus a separate new-configuration row
// per provider. Discovery completes as a batch before rows become actionable; connections persist outside the draft.
import { createElement, Fragment, useState } from 'react';
import { ArrowRightIcon, DownloadIcon, RefreshCwIcon } from 'lucide-react';
import { Button, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui';
import { agentMark } from '../../../agent-presentation/renderer';
import { SignIn } from '../SignIn';
import { InstallProgress } from '../AgentPicker';
import { useAgentList } from '../../lib/agents';
import { useExistingSetups } from '../../lib/agent-setup';
import { useProjectDraft, type ProjectDraft } from './draft';
import { refused } from '../../../shared/result';
import type { Account, AgentInfo } from '../../../shared/types';

type Configuration = {
  key: string; agent: AgentInfo; title: string; directory: string; origin: Account['origin']; account?: string; label: string;
};

function Provider({ agent }: { agent: AgentInfo }) {
  return <div className="flex min-w-0 items-center gap-2">
    {createElement(agentMark(agent.id), { className: 'size-4 shrink-0' })}
    <span className="truncate font-medium" title={agent.name}>{agent.name}</span>
  </div>;
}

function ConfigurationRow({ config: c, selected, disabled, onUse }: {
  config: Configuration; selected: boolean; disabled: boolean; onUse: () => void;
}) {
  return <TableRow className="h-20" data-state={selected ? 'selected' : undefined}>
    <TableCell><Provider agent={c.agent} /></TableCell>
    <TableCell><p className="truncate" title={c.title}>{c.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{c.origin === 'external' ? 'External configuration' : 'Created in Kulisa'}</p>
      <p data-selectable title={c.directory} className="mt-1 truncate font-mono text-xs text-muted-foreground">{c.directory}</p>
    </TableCell>
    <TableCell><Button type="button" variant="outline" disabled={disabled || !c.agent.installed} aria-label={c.label} onClick={onUse}>Use<ArrowRightIcon /></Button></TableCell>
  </TableRow>;
}

export function AgentsStep({ draft: d }: { draft: ProjectDraft }) {
  const s = useProjectDraft(d, (x) => x), list = useAgentList(d.installs, (x) => x);
  const agents = list.agents.filter((a) => s.clis.includes(a.id));
  const discovery = useExistingSetups(agents), [signing, setSigning] = useState<AgentInfo | null>(null);
  const loading = list.looking || !agents.length || discovery.checking, busy = list.installing || s.connecting;

  async function selectConfiguration(config: Configuration) {
    if (config.account) { d.choose(config.account); await d.next(); return; }
    d.set({ connecting: true, error: '' });
    try {
      const r = await kulisa.invoke('account:connect-existing', { agent: config.agent.id });
      if (refused(r)) { d.set({ error: r.error }); return; }
      d.connected(r); d.set({ connecting: false }); await d.next();
    } catch (e) { d.set({ error: String(e) }); }
    finally { d.set({ connecting: false }); }
  }

  return <div className="flex flex-col gap-3">
    <div className="overflow-hidden rounded-xl border" aria-busy={loading}>
      {loading ? <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Spinner />Checking agents and configurations…</p>
        : <Table aria-label="Choose a starting agent" className="table-fixed">
          <TableHeader><TableRow><TableHead className="w-1/4">Agent</TableHead><TableHead>Configuration</TableHead><TableHead className="w-28"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
          <TableBody>{agents.map((agent) => {
            const accounts = s.accounts.filter((a) => a.agent === agent.id), local = discovery.entries[agent.id]?.setup;
            const configurations: Configuration[] = accounts.map((a) => ({ key: a.id, agent, title: a.email || a.name,
              directory: a.directory, origin: a.origin, account: a.id, label: `Use ${a.name}` }));
            if (local && !accounts.some((a) => a.id === local.account)) configurations.push({ key: `${agent.id}/external`,
              agent, title: local.email || 'Existing setup', directory: local.directory, origin: 'external', label: `Use existing ${agent.name} setup` });
            return <Fragment key={agent.id}>
              {configurations.map((config) => <ConfigurationRow key={config.key} config={config} selected={!!config.account && s.selected === config.account}
                disabled={busy} onUse={() => void selectConfiguration(config)} />)}
              <TableRow className="h-20">
                <TableCell><Provider agent={agent} /></TableCell>
                <TableCell><p>New configuration</p><p className="mt-1 text-xs text-muted-foreground">{agent.installed ? 'Sign in to a separate account in Kulisa' : 'Install the CLI, then connect an account'}</p></TableCell>
                <TableCell>{agent.installed
                  ? <Button type="button" variant="outline" disabled={busy} aria-label={`Connect a new ${agent.name} setup`} onClick={() => { setSigning(agent); d.set({ connecting: true }); }}>Connect</Button>
                  : <Button type="button" variant="outline" disabled={busy || !agent.install} onClick={() => void d.installs.install(agent.id)}><DownloadIcon />Install</Button>}</TableCell>
              </TableRow>
            </Fragment>;
          })}</TableBody>
        </Table>}
    </div>
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs text-muted-foreground">Choose one agent to start. You can add more agents and accounts to the project later.</p>
      <Button type="button" variant="ghost" size="icon-sm" disabled={busy || loading} aria-label="Check agent setups again" onClick={discovery.refresh}><RefreshCwIcon /></Button>
    </div>
    {!loading && agents.map((agent) => discovery.entries[agent.id]?.error && <p key={agent.id} data-selectable className="text-xs text-destructive">{agent.name}: {discovery.entries[agent.id]!.error}</p>)}
    <InstallProgress list={d.installs} />
    {signing && <SignIn agent={signing} onClose={() => { setSigning(null); d.set({ connecting: false }); }} onDone={(r) => {
      d.connected(r); setSigning(null); d.set({ connecting: false }); void d.next();
    }} />}
    <p className="text-xs text-muted-foreground">An existing setup shares its login and settings with your other CLI sessions. A new setup starts empty in Kulisa. Connected accounts stay available if you cancel.</p>
  </div>;
}
