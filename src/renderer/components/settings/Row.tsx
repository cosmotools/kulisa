// A Settings page's parts (docs/ui.md, Settings): a section, its title and its button; a row, a Card holding one
// setting or one thing of a list, as Windows' Settings shows them.
import type { ReactElement, ReactNode } from 'react';
import { Body1Strong, Button, Caption1, Card, CardHeader, makeStyles, Text, tokens } from '@fluentui/react-components';
import { ChevronRightRegular, MoreHorizontalRegular } from '@fluentui/react-icons';
import { ButtonMenu, RightClickMenu, type Item } from '../Menus';

const useStyles = makeStyles({
  section: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '32px', marginBlockStart: tokens.spacingVerticalL },
  title: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, minWidth: 0 },
  // An icon's box as wide as an avatar's, so the titles of a list line up.
  image: { width: '32px', display: 'flex', justifyContent: 'center', fontSize: '20px' },
  // CardHeader's middle column is as wide as its text: a long description would push the action out of the card.
  text: { minWidth: 0 },
  action: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
});

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const styles = useStyles();
  return <section role="group" aria-label={title} className={styles.section}>
    <div className={styles.head}><Body1Strong>{title}</Body1Strong>{action}</div>
    {children}
  </section>;
}

// menu: its actions, behind its ⋯ and its right-click; open: the row goes to its page (a chevron at its end, its
// actions on that page and in its right-click only: a ⋯ inside would open the page too).
export function Row({ image, title, badges, description, action, menu, open, label, data }: {
  image: ReactElement; title: ReactNode; badges?: ReactNode; description?: ReactNode; action?: ReactNode;
  menu?: () => Item[]; open?: () => void; label?: string; data?: Record<string, string>;
}) {
  const styles = useStyles();
  // data-row: the tests' handle on a row (docs/testing.md)
  // A thing of a list is named (found by it); a setting is not: its control has the name.
  const name = menu || open || data ? label ?? (typeof title === 'string' ? title : undefined) : undefined;
  // title: what its truncated lines cut, whole (docs/ui.md, Tooltips: a row's is the native one)
  const card = <Card appearance="filled" data-row="" aria-label={name} title={[label ?? (typeof title === 'string' ? title : undefined), typeof description === 'string' && description].filter(Boolean).join('\n') || undefined}
    onClick={open} {...data}>
    <CardHeader image={<span className={styles.image}>{image}</span>}
      header={{ className: styles.text, children: <span className={styles.title}><Text truncate wrap={false}>{title}</Text>{badges}</span> }}
      description={description ? { className: styles.text, children: <Caption1 truncate wrap={false}>{description}</Caption1> } : undefined}
      action={<span className={styles.action}>{action}
        {menu && !open && <ButtonMenu end items={menu}><Button appearance="subtle" icon={<MoreHorizontalRegular />} aria-label={`More for ${name ?? 'it'}`} /></ButtonMenu>}
        {open && <ChevronRightRegular fontSize={20} />}</span>} />
  </Card>;
  return menu ? <RightClickMenu items={() => menu()}>{card}</RightClickMenu> : card;
}
