// A terminal shown in a page (src/terminal: its View, one xterm), in the colors of the Fluent theme shown: the place's
// background (a Fluent color token), its text, its font size. terminal: the key of the terminal to show, null none.
import { useContext, useEffect, useRef, useState } from 'react';
import { View } from '../../terminal/renderer';
import { termStyle as styleOf, ThemeShown, type ColorToken } from './theme';

export function Terminal({ terminal, background = 'colorNeutralBackground1', className }: { terminal: string | null; background?: ColorToken; className?: string }) {
  const theme = useContext(ThemeShown);
  const host = useRef<HTMLDivElement>(null);
  const [view] = useState(() => new View(styleOf(theme, background)));
  useEffect(() => { host.current!.append(view.el); return () => view.dispose(); }, [view]);
  useEffect(() => view.show(terminal), [view, terminal]);
  useEffect(() => view.restyle(styleOf(theme, background)), [view, theme, background]);
  return <div ref={host} className={className} data-terminal={terminal ?? undefined} />;
}
