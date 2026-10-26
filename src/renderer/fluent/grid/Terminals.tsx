// The shown task's terminals (docs/window.md, The terminal): its tabs, the one in front (lib/terminals.ts). The shell:
// the terminal in front alone.
import { useContext, useEffect, useRef } from 'react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { island } from '../../lib/terminals';
import { useWindow } from '../../lib/store';
import { ThemeShown, termStyle } from '../theme';

export function Terminals() {
  const host = useRef<HTMLDivElement>(null), theme = useContext(ThemeShown);
  const front = useWindow((s) => (s.current && s.terminals.front !== null ? `${s.current}#${s.terminals.front}` : null));
  useEffect(() => { host.current!.append(island.el); }, []);
  useEffect(() => island.show(front), [front]);
  useEffect(() => island.restyle(termStyle(theme, 'colorNeutralBackground1')), [theme]);
  return <div ref={host} style={{ height: '100%', padding: '4px 8px', boxSizing: 'border-box' }} />;
}

export function TerminalsHeader({ api }: IDockviewPanelHeaderProps) {
  return <div data-panel={api.id} style={{ padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%' }}>{api.title}</div>;
}
