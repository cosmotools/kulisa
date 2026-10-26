// A terminal shown in a page (src/terminal: its View, one xterm), in the colors of the Fluent theme shown: the place's
// background (a Fluent color token), its text, its font size. terminal: the key of the terminal to show, null none.
import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Theme } from '@fluentui/react-components';
import { View, type TermStyle } from '../../terminal/renderer';
import { ThemeShown } from './theme';

type ColorToken = Extract<keyof Theme, `color${string}`>;
const styleOf = (t: Theme, background: ColorToken): TermStyle => ({
  colors: { background: t[background], foreground: t.colorNeutralForeground1, selection: t.colorNeutralStroke1 },
  fontSize: parseFloat(t.fontSizeBase300),
});

export function Terminal({ terminal, background = 'colorNeutralBackground1', style }: { terminal: string | null; background?: ColorToken; style?: CSSProperties }) {
  const theme = useContext(ThemeShown);
  const host = useRef<HTMLDivElement>(null);
  const [view] = useState(() => new View(styleOf(theme, background)));
  useEffect(() => { host.current!.append(view.el); return () => view.dispose(); }, [view]);
  useEffect(() => view.show(terminal), [view, terminal]);
  useEffect(() => view.restyle(styleOf(theme, background)), [view, theme, background]);
  return <div ref={host} style={style} data-terminal={terminal ?? undefined} />;
}
