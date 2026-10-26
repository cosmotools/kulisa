// Over the grid while no profile is open and a terminal is (docs/window.md, The grid): the profiles' room folded to a
// row of buttons that open them, where the first one opens (above the terminal). With no terminal either, they are the
// big buttons' second row (Terminals.tsx). More than fit scroll, as a strip of tabs (lib/strip.ts).
import { useRef } from 'react';
import { Avatar, Button, tokens } from '@fluentui/react-components';
import { PlusIcon } from 'lucide-react';
import { useWindow } from '../../lib/store';
import { profileLaunchers } from '../../lib/profiles';
import { avatarSrc } from '../../lib/common';
import { useStrip } from '../../lib/strip';

export function ClosedProfiles() {
  const shown = useWindow((s) => !!s.current && !s.profiles.length && s.terminals.list.length > 0);
  return shown ? <Row /> : null;
}

function Row() {
  const closed = useWindow((s) => s.closedProfiles), row = useRef<HTMLElement>(null);
  useStrip(row, null); // no button is the active one
  return <nav ref={row} aria-label="Open a profile" data-testid="closed-profiles"
    style={{ display: 'flex', gap: tokens.spacingHorizontalS, flex: 'none', padding: tokens.spacingHorizontalS, overflowX: 'auto', scrollbarWidth: 'none' }}>
    {profileLaunchers(closed).map((p) => <Button key={p.id} data-profile={p.id} shape="circular" aria-label={p.name} title={p.title}
      icon={p.avatar ? <Avatar size={24} image={{ src: avatarSrc(p.avatar) }} aria-hidden /> : undefined}
      style={{ flex: 'none', maxWidth: '18em', minWidth: 0 }} onClick={() => void p.run()}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.name}</span>
      <PlusIcon style={{ marginInlineStart: 6 }} />
    </Button>)}
  </nav>;
}
