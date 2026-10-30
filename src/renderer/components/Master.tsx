// The bar of a master's window (docs/profiles.md), 44 px high (main/master.ts, BAR). While the human types an address,
// where the page goes does not overwrite it.
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, RotateCwIcon } from 'lucide-react';
import { Button, Input } from '@ui';

const query = new URLSearchParams(location.search);
const what = `${query.get('name')}: signed in here, every new task's copy is too`;
let shown = '', onShown: ((url: string) => void) | null = null;
kulisa.on('master:url', (url) => { shown = url === 'about:blank' ? '' : url; onShown?.(shown); });

export function Master() {
  const [address, setAddress] = useState(shown);
  const typing = useRef(false);
  useEffect(() => { onShown = (url) => { if (!typing.current) setAddress(url); }; return () => { onShown = null; }; }, []);
  // The OS's hint, not a tooltip of the page: the window's top leaves it no room above the bar, and under it is the
  // page, a native view that would cover it (docs/ui.md, Tooltips).
  const tool = (label: string, Icon: ComponentType, channel: 'master:back' | 'master:forward' | 'master:reload') =>
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={() => void kulisa.invoke(channel)}><Icon /></Button>;
  return <div role="group" aria-label="Page" className="flex h-11 items-center gap-1 border-b bg-background px-2 text-sm text-foreground">
    {tool('Back', ArrowLeftIcon, 'master:back')}
    {tool('Forward', ArrowRightIcon, 'master:forward')}
    {tool('Reload', RotateCwIcon, 'master:reload')}
    <form className="mx-1 flex min-w-0 flex-1" onSubmit={(e) => { e.preventDefault(); typing.current = false; const url = address.trim(); if (url) void kulisa.invoke('master:go', url); }}>
      <Input id="address" autoFocus spellCheck={false} aria-label="Address" placeholder="The site to sign in to, e.g. github.com"
        value={address} onChange={(e) => { typing.current = true; setAddress(e.target.value); }} onBlur={() => { typing.current = false; }} />
    </form>
    <span className="truncate text-xs text-muted-foreground">{what}</span>
  </div>;
}
