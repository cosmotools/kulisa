// An agent's page in Settings (docs/tasks.md, "Choosing the agent", Accounts), as JetBrains' SDKs: who makes it, where it
// is, Install (agents.ts: the install goes on while another page is shown), and its accounts: Add Account signs in to a
// new one (SignIn.tsx), Delete deletes one (asked first). Stock Fluent only (docs/ui.md, Settings).
import { createElement, useEffect, useState } from 'react';
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Avatar, Badge, Button, Caption1, Card, CardHeader, Field, Link, MessageBar,
  MessageBarBody, Spinner, Subtitle2, Table, TableBody, TableCell, TableCellActions, TableCellLayout, TableRow, Text, Title3 } from '@fluentui/react-components';
import { AddRegular, MoreHorizontalRegular } from '@fluentui/react-icons';
import { install, loadAccounts, openInstallDetails, shortPath, showAccounts, useAgents } from './agents';
import { ButtonMenu, RightClickMenu, type Item } from '../Menus';
import { agentMark } from '../AgentMark';
import { SignIn } from '../SignIn';
import { refused } from '../../../shared/result';
import type { AgentInfo } from '../../../shared/types';
import { ErrorBar } from '../ErrorBar';

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
  const menu = (id: string): Item[] => [{ label: 'Delete…', run: () => remove(id) }];

  // section, data-agent: the tests' handle on the page shown (docs/testing.md); Card's root can only be a div.
  return <section aria-label={a.name} data-agent={a.id}><Card appearance="subtle">
    <Card>
      <CardHeader image={createElement(agentMark(a.id), { width: 48, height: 48, fontSize: 48 })}
        header={<Title3 role="heading" aria-level={2}>{a.name} <Badge role="status" appearance="tint" color={a.installed ? 'success' : 'informative'}>
          {a.installed ? 'Installed' : 'Not installed'}</Badge></Title3>}
        description={<Caption1>{a.maker || '—'}{a.site && <> · <Link href={a.site} target="_blank">Website</Link></>}</Caption1>}
        action={!a.installed && a.install ? <Button appearance="primary" disabled={installing} onClick={() => void install(a.id)}>Install</Button> : undefined} />
    </Card>

    <Card role="group" aria-label="About">
      <CardHeader header={<Subtitle2>About</Subtitle2>} />
      {a.needs && <Field label="Needs"><Text>{a.needs}</Text></Field>}
      {where ? <Field label="Installed at"><Text data-testid="agent-where">{where}</Text></Field>
        : a.install && <Field label="Install"><Text>{`Runs ${a.maker || 'its maker'}'s installer: ${a.install}`}</Text></Field>}
      {shown?.progress && (shown.running ? <Spinner size="tiny" labelPosition="after" label={shown.progress} />
        : <MessageBar intent="success"><MessageBarBody>{shown.progress}</MessageBarBody></MessageBar>)}
      {shown && <Accordion collapsible openItems={shown.open ? ['log'] : []} onToggle={(_, d) => openInstallDetails(d.openItems.includes('log'))}>
        <AccordionItem value="log">
          <AccordionHeader size="small">Details</AccordionHeader>
          <AccordionPanel>
            {/* a line a Text, in a monospace font: the installer's output as its terminal showed it */}
            <div role="log" aria-label="What the installer said">
              {shown.log.split('\n').map((l, i) => <Text key={i} block font="monospace" size={200}>{l || '\u00a0'}</Text>)}
            </div></AccordionPanel>
        </AccordionItem>
      </Accordion>}
      {shown?.error && <ErrorBar>{shown.error}</ErrorBar>}
    </Card>

    {clis.includes(a.id) && <Card role="group" aria-label="Accounts">
      <CardHeader header={<Subtitle2>Accounts</Subtitle2>} action={<Button icon={<AddRegular />} disabled={!a.installed || signing}
        onClick={() => { setError(''); onSigning(true); }}>Add Account</Button>} />
      {mine.length ? <RightClickMenu items={(e) => { const k = (e.target as Element).closest<HTMLElement>('[data-row]')?.dataset.key; return k ? menu(k) : null; }}>
        {/* data-row, data-key, aria-label: the tests' handles (docs/testing.md); the right-click is the table's: a menu's trigger wraps its child in a box, which a row cannot have */}
        <Table aria-label="Accounts"><TableBody>{mine.map((x) => {
          const name = x.email || x.id;
          return <TableRow key={x.id} data-row="" data-key={x.id} aria-label={name} data-account={x.id} title={name}>
            <TableCell>
              <TableCellLayout truncate media={<Avatar size={32} name={name} />}
                description={x.projects.length ? `in ${x.projects.join(', ')}` : 'in no project'}>{name}</TableCellLayout>
              <TableCellActions>
                <ButtonMenu end items={() => menu(x.id)}><Button appearance="subtle" icon={<MoreHorizontalRegular />} aria-label={`More for ${name}`} /></ButtonMenu>
              </TableCellActions>
            </TableCell>
          </TableRow>;
        })}</TableBody></Table>
      </RightClickMenu> : !signing && <Text>No accounts yet: each its own sign-in, added to a project on its page.</Text>}
      {signing && <SignIn agent={a} onDone={(r) => { onSigning(false); showAccounts(r); }} onClose={() => onSigning(false)} />}
      {error && <ErrorBar>{error}</ErrorBar>}
    </Card>}
  </Card></section>;
}
