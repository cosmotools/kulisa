// An agent's page in Settings (docs/tasks.md, "Choosing the agent", Accounts), as JetBrains' SDKs: who makes it, where it
// is, Install (agents.ts: the install goes on while another page is shown), and its accounts: Add Account signs in to a
// new one (SignIn.tsx), Delete deletes one (asked first).
import { createElement, useEffect, useState } from 'react';
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Avatar, Badge, Button, Caption1, Link, makeStyles, MessageBar, MessageBarBody, Spinner,
  Textarea, tokens } from '@fluentui/react-components';
import { AddRegular, FolderRegular, KeyRegular } from '@fluentui/react-icons';
import { install, loadAccounts, openInstallDetails, shortPath, showAccounts, useAgents } from './agents';
import { Row, Section } from './Row';
import { agentMark } from '../AgentMark';
import { SignIn } from '../SignIn';
import { refused } from '../../../shared/result';
import type { AgentInfo } from '../../../shared/types';
import { ErrorBar } from '../ErrorBar';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  mark: { fontSize: '32px' },
  install: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  log: { width: '100%' },
  // as tall as what it says, up to the small size's most (field-sizing)
  logText: { fontFamily: tokens.fontFamilyMonospace, overflowWrap: 'anywhere', fieldSizing: 'content' },
});

export function AgentPage({ agent: a, signing, onSigning }: { agent: AgentInfo; signing: boolean; onSigning: (on: boolean) => void }) {
  const styles = useStyles();
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
  return <section aria-label={a.name} data-agent={a.id} className={styles.page}>
    <Row image={createElement(agentMark(a.id), { className: styles.mark })} title={a.name}
      badges={<Badge role="status" appearance="tint" color={a.installed ? 'success' : 'informative'}>{a.installed ? 'Installed' : 'Not installed'}</Badge>}
      description={<>{a.maker || '—'}{a.site && <> · <Link href={a.site} target="_blank">Website</Link></>}</>}
      action={!a.installed && a.install && <Button appearance="primary" disabled={installing} onClick={() => void install(a.id)}>Install</Button>} />
    {shown && <div className={styles.install}>
      {shown.progress && (shown.running ? <Spinner size="tiny" labelPosition="after" label={shown.progress} />
        : <MessageBar intent="success"><MessageBarBody>{shown.progress}</MessageBarBody></MessageBar>)}
      <Accordion collapsible openItems={shown.open ? ['log'] : []} onToggle={(_, d) => openInstallDetails(d.openItems.includes('log'))}>
        <AccordionItem value="log">
          <AccordionHeader size="small">Details</AccordionHeader>
          <AccordionPanel><Textarea readOnly resize="none" size="small" appearance="filled-darker" aria-label="What the installer said" value={shown.log}
            className={styles.log} textarea={{ className: styles.logText }} /></AccordionPanel>
        </AccordionItem>
      </Accordion>
      {shown.error && <ErrorBar>{shown.error}</ErrorBar>}
    </div>}

    <Section title="About">
      {a.needs && <Row image={<KeyRegular />} title="Needs" description={a.needs} />}
      {where ? <Row image={<FolderRegular />} title="Installed at" description={<span data-testid="agent-where">{where}</span>} />
        : a.install && <Row image={<FolderRegular />} title="Install" description={`Runs ${a.maker || 'its maker'}'s installer: ${a.install}`} />}
    </Section>

    {clis.includes(a.id) && <Section title="Accounts" action={<Button icon={<AddRegular />} disabled={!a.installed || signing}
      onClick={() => { setError(''); onSigning(true); }}>Add Account</Button>}>
      {mine.map((x) => <Row key={x.id} image={<Avatar size={32} name={x.email || x.id} />} title={x.email || x.id} data={{ 'data-account': x.id }}
        description={x.projects.length ? `in ${x.projects.join(', ')}` : 'in no project'} menu={() => [{ label: 'Delete…', run: () => remove(x.id) }]} />)}
      {!mine.length && !signing && <Caption1>No accounts yet: each its own sign-in, added to a project on its page.</Caption1>}
      {signing && <SignIn agent={a} onDone={(r) => { onSigning(false); showAccounts(r); }} onClose={() => onSigning(false)} />}
      {error && <ErrorBar>{error}</ErrorBar>}
    </Section>}
  </section>;
}
