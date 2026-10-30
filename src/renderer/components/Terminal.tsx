// A terminal shown in a page (src/terminal: its View, one xterm), in the colors of the theme shown (lib/theme.ts,
// termStyle): the card's background, its text, the font size. terminal: the key of the terminal to show, null none.
import { useEffect, useRef, useState } from 'react';
import { View } from '../../terminal/renderer';
import { termStyle, useShade } from '../lib/theme';

export function Terminal({ terminal, className }: { terminal: string | null; className?: string }) {
  const shade = useShade();
  const host = useRef<HTMLDivElement>(null);
  const [view] = useState(() => new View(termStyle()));
  useEffect(() => { host.current!.append(view.el); return () => view.dispose(); }, [view]);
  useEffect(() => view.show(terminal), [view, terminal]);
  useEffect(() => view.restyle(termStyle()), [view, shade]);
  return <div ref={host} className={className} data-terminal={terminal ?? undefined} />;
}
