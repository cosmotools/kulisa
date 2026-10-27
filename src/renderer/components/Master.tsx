// The bar of a master's window (docs/profiles.md), 44 px high (main/master.ts, BAR). While the human types an address,
// where the page goes does not overwrite it.
import { useEffect, useRef, useState } from 'react';
import { AriaLiveAnnouncer, FluentProvider, Input, Text, Toolbar, ToolbarButton, tokens } from '@fluentui/react-components';
import { ArrowLeftIcon, ArrowRightIcon, RotateCwIcon } from 'lucide-react';
import { dark, light, shade } from './theme';

const query = new URLSearchParams(location.search);
const what = `${query.get('name')}: signed in here, every new task's copy is too`;
let shown = '', onShown: ((url: string) => void) | null = null;
kulisa.on('master:url', (url) => { shown = url === 'about:blank' ? '' : url; onShown?.(shown); });

export function Master() {
  const [address, setAddress] = useState(shown);
  const typing = useRef(false);
  useEffect(() => { onShown = (url) => { if (!typing.current) setAddress(url); }; return () => { onShown = null; }; }, []);
  // The OS's hint, not Fluent's Tooltip: the window's top leaves it no room above the bar, and under it is the page, a
  // native view that would cover it (docs/ui.md, Tooltips).
  const tool = (label: string, Icon: typeof ArrowLeftIcon, channel: 'master:back' | 'master:forward' | 'master:reload') =>
    <ToolbarButton icon={<Icon />} aria-label={label} title={label} onClick={() => void kulisa.invoke(channel)} />;
  return <FluentProvider theme={shade(query.get('theme') ?? 'dark') === 'dark' ? dark : light}
    style={{ height: 44, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px' }}><AriaLiveAnnouncer>
    <Toolbar aria-label="Page" style={{ padding: 0 }}>
      {tool('Back', ArrowLeftIcon, 'master:back')}
      {tool('Forward', ArrowRightIcon, 'master:forward')}
      {tool('Reload', RotateCwIcon, 'master:reload')}
    </Toolbar>
    <form style={{ flex: 1, display: 'flex' }} onSubmit={(e) => { e.preventDefault(); typing.current = false; const url = address.trim(); if (url) void kulisa.invoke('master:go', url); }}>
      <Input id="address" style={{ flex: 1 }} autoFocus spellCheck={false} aria-label="Address" placeholder="The site to sign in to, e.g. github.com"
        value={address} onChange={(_, d) => { typing.current = true; setAddress(d.value); }} onBlur={() => { typing.current = false; }} />
    </form>
    <Text size={200} wrap={false} style={{ color: tokens.colorNeutralForeground3 }}>{what}</Text>
  </AriaLiveAnnouncer></FluentProvider>;
}
