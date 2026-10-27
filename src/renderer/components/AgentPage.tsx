// An agent's page in Settings (docs/tasks.md, "Choosing the agent", Accounts), as JetBrains' SDKs: who makes it, where it
// is, Install (agents.ts: the install goes on while another page is shown), and its accounts: + signs in to a new one
// (SignIn.tsx), − deletes one (asked first).
import { useEffect, useState } from 'react';
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Field, Link, MessageBar, MessageBarBody, Spinner, Text, Textarea } from '@fluentui/react-components';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { install, loadAccounts, openInstallDetails, shortPath, showAccounts, useAgents } from './agents';
import { RightClickMenu } from './Menus';
import { List } from './List';
import { Group, Tool } from './Group';
import { SignIn } from './SignIn';
import { refused } from '../../shared/result';
import type { AgentInfo } from '../../shared/types';

const mono = { overflowWrap: 'anywhere', userSelect: 'text' } as const;
const failed = (t: string) => <MessageBar intent="error"><MessageBarBody style={{ userSelect: 'text' }}>{t}</MessageBarBody></MessageBar>;

export function AgentPage({ agent: a, signing, onSigning }: { agent: AgentInfo; signing: boolean; onSigning: (on: boolean) => void }) {
  const { accounts, clis, install: inst } = useAgents();
  const [selected, setSelected] = useState<string>(), [error, setError] = useState('');
  useEffect(() => { void loadAccounts(); }, []); // as now: made in a project, or let go by one, meanwhile

  const mine = accounts.filter((x) => x.agent === a.id);
  const where = a.path ? [a.version, shortPath(a.path), a.onPath === false && 'not on your PATH: Kulisa runs it from here'].filter(Boolean).join(' · ') : '';
  const installing = !!inst?.running, shown = inst?.id === a.id ? inst : null;
  async function remove(id = selected) {
    if (!id) return;
    setError('');
    const r = await kulisa.invoke('account:delete', { id });
    if (refused(r)) { setError(r.error ?? ''); return; } // null: the human said no
    showAccounts(r);
    if (!r.accounts.some((x) => x.id === id)) setSelected(undefined);
  }

  return <section aria-label={a.name} data-agent={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
    <Field label="Maker"><Text>{a.maker || '—'}{a.site && <> · <Link href={a.site} target="_blank">Website</Link></>}</Text></Field>
    {a.needs && <Field label="Needs"><Text>{a.needs}</Text></Field>}
    <Field label="Status" hint={a.install && !a.installed ? <Text font="monospace" size={200} style={mono}>Install runs {a.maker || 'its maker'}'s installer: {a.install}</Text> : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text role="status" weight="semibold">{a.installed ? 'Installed' : 'Not installed'}</Text>
        {where && <Text font="monospace" size={200} style={mono} data-testid="agent-where">{where}</Text>}
        {!a.installed && a.install && <Button size="small" disabled={installing} onClick={() => void install(a.id)}>Install</Button>}
      </div>
    </Field>
    {shown && <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {shown.progress && (shown.running ? <Spinner size="tiny" labelPosition="after" label={shown.progress} />
        : <MessageBar intent="success"><MessageBarBody>{shown.progress}</MessageBarBody></MessageBar>)}
      <Accordion collapsible openItems={shown.open ? ['log'] : []} onToggle={(_, d) => openInstallDetails(d.openItems.includes('log'))}>
        <AccordionItem value="log">
          <AccordionHeader size="small">Details</AccordionHeader>
          {/* as tall as what it says, up to the small size's most (field-sizing) */}
          <AccordionPanel><Textarea readOnly resize="none" size="small" appearance="filled-darker" aria-label="What the installer said" value={shown.log}
            style={{ width: '100%' }} textarea={{ style: { fontFamily: 'var(--fontFamilyMonospace)', overflowWrap: 'anywhere', fieldSizing: 'content' } }} /></AccordionPanel>
        </AccordionItem>
      </Accordion>
      {shown.error && failed(shown.error)}
    </div>}

    {clis.includes(a.id) && <Group title="Accounts" hint="Each its own sign-in; a project's page adds it to that project." tools={<>
      <Tool label="New Account…: signed in with its own sign-in" icon={<PlusIcon />} disabled={!a.installed || signing} onClick={() => { setError(''); onSigning(true); }} />
      <Tool label="Delete the account (asks first)" icon={<MinusIcon />} disabled={!mine.some((x) => x.id === selected)} onClick={() => void remove()} />
    </>}>
      {mine.length ? <RightClickMenu items={(e) => {
        const id = (e.target as Element).closest('[data-account]')?.getAttribute('data-account');
        if (!id) return null;
        setSelected(id);
        return [{ label: 'Delete…', run: () => remove(id) }];
      }}>
        <List label="Accounts" attr="account" rows={mine} id={(x) => x.id} rowLabel={(x) => x.email || x.id} selected={selected} onSelect={setSelected}
          onDelete={() => void remove()} columns={[
            { label: 'Account', width: '50%', cell: (x) => x.email || x.id },
            { label: 'Projects', cell: (x) => <Text size={200}>{x.projects.length ? `in ${x.projects.join(', ')}` : 'in no project'}</Text> },
          ]} />
      </RightClickMenu> : !signing && <Text size={200}>No accounts yet.</Text>}
      {signing && <SignIn agent={a} onDone={(r) => { onSigning(false); showAccounts(r); }} onClose={() => onSigning(false)} />}
      {error && failed(error)}
    </Group>}
  </section>;
}
