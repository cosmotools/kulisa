// The bar of a master's window (docs/profiles.md), 44 px high (main/master.ts, BAR). While the human types an address,
// where the page goes does not overwrite it.
import { useEffect, useRef, useState } from 'react';
import { AriaLiveAnnouncer, FluentProvider, Input, Text, Toolbar, ToolbarButton, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowClockwiseRegular, ArrowLeftRegular, ArrowRightRegular, type FluentIcon } from '@fluentui/react-icons';
import { dark, light, shade, useCommonStyles } from './theme';

const query = new URLSearchParams(location.search);
const what = `${query.get('name')}: signed in here, every new task's copy is too`;
let shown = '', onShown: ((url: string) => void) | null = null;
kulisa.on('master:url', (url) => { shown = url === 'about:blank' ? '' : url; onShown?.(shown); });

// The bar is the Toolbar itself, not FluentProvider's className, which Fluent copies to every portal's node (App.tsx).
const useStyles = makeStyles({
  bar: { height: '44px', boxSizing: 'border-box', gap: tokens.spacingHorizontalXS },
  form: { flex: 1, display: 'flex' },
  address: { flex: 1 },
});

export function Master() {
  const [address, setAddress] = useState(shown);
  const typing = useRef(false), styles = useStyles(), common = useCommonStyles();
  useEffect(() => { onShown = (url) => { if (!typing.current) setAddress(url); }; return () => { onShown = null; }; }, []);
  // The OS's hint, not Fluent's Tooltip: the window's top leaves it no room above the bar, and under it is the page, a
  // native view that would cover it (docs/ui.md, Tooltips).
  const tool = (label: string, Icon: FluentIcon, channel: 'master:back' | 'master:forward' | 'master:reload') =>
    <ToolbarButton icon={<Icon />} aria-label={label} title={label} onClick={() => void kulisa.invoke(channel)} />;
  return <FluentProvider theme={shade(query.get('theme') ?? 'dark') === 'dark' ? dark : light}><AriaLiveAnnouncer><Toolbar aria-label="Page" className={styles.bar}>
    {tool('Back', ArrowLeftRegular, 'master:back')}
    {tool('Forward', ArrowRightRegular, 'master:forward')}
    {tool('Reload', ArrowClockwiseRegular, 'master:reload')}
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); typing.current = false; const url = address.trim(); if (url) void kulisa.invoke('master:go', url); }}>
      <Input id="address" className={styles.address} autoFocus spellCheck={false} aria-label="Address" placeholder="The site to sign in to, e.g. github.com"
        value={address} onChange={(_, d) => { typing.current = true; setAddress(d.value); }} onBlur={() => { typing.current = false; }} />
    </form>
    <Text size={200} wrap={false} className={common.muted}>{what}</Text>
  </Toolbar></AriaLiveAnnouncer></FluentProvider>;
}
