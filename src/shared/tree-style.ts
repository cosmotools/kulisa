// Trees host integration shared by Project and Diff (docs/ui.md).
import type { CSSProperties } from 'react';

export const treeStyle = {
  colorScheme: 'inherit',
  '--trees-font-family-override': 'var(--font-sans)',
  '--trees-font-size-override': 'var(--text-sm)',
  '--trees-padding-inline-override': 'calc(var(--spacing) * 2)',
  '--trees-fg-override': 'var(--sidebar-foreground)',
  '--trees-fg-muted-override': 'var(--muted-foreground)',
  '--trees-bg-override': 'var(--sidebar)',
  '--trees-bg-muted-override': 'var(--sidebar-accent)',
  '--trees-accent-override': 'var(--sidebar-ring)',
  '--trees-selected-bg-override': 'var(--sidebar-accent)',
  '--trees-selected-fg-override': 'var(--sidebar-accent-foreground)',
  '--trees-indent-guide-bg-override': 'transparent',
  '--trees-focus-ring-width-override': '0px',
} as CSSProperties;

// Keep keyboard focus visible without the row border (the author's choice).
export const treeFocusCSS = '[data-item-focused="true"]:not([data-item-selected="true"]) { background-color: var(--trees-bg-muted); --truncate-marker-background-overlay-color: var(--trees-bg-muted); }';
