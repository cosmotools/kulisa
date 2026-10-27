// Browser tabs (docs/ui.md, Tabs), one look for the three strips (the tasks' bar, a pane's tabs, the terminals'): on
// shadcn's Tabs, which has no panels here and no ×. A tab is chosen on the press, as a browser's (Radix's own); the
// keyboard moves along them and Enter or Space chooses. Its × is on every tab, always, as Chrome's: inside the tab, its
// own click, never the tab's press. The strip scrolls when they do not fit (lib/strip.ts, useStrip on its ref).
import type { ComponentProps, ReactNode, Ref } from 'react';
import { XIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@ui';

export function TabStrip({ value, onChoose, label, stripRef, children, ...rest }: { value: string; onChoose?: (value: string) => void;
  label: string; stripRef?: Ref<HTMLDivElement>; children: ReactNode } & Omit<ComponentProps<typeof TabsList>, 'children'>) {
  return <Tabs value={value} onValueChange={onChoose} activationMode="manual" className="min-w-0">
    <TabsList ref={stripRef} aria-label={label} className="max-w-full justify-start" {...rest}>{children}</TabsList>
  </Tabs>;
}

// close: its × (its tooltip, what it does); icon and children: what the tab shows. Dragged (dragging), it is dimmed;
// drop: the side where a tab let go over it would go, marked.
export function BrowserTab({ icon, close, dragging, drop, children, ...rest }: { icon?: ReactNode; close?: { title: string; run: () => void };
  dragging?: boolean; drop?: 'before' | 'after'; children: ReactNode } & ComponentProps<typeof TabsTrigger>) {
  return <TabsTrigger data-dragging={dragging || undefined} data-drop={drop} {...rest}>
    {drop && <span aria-hidden className={drop === 'before' ? 'absolute inset-y-1 start-0 w-0.5 bg-ring' : 'absolute inset-y-1 end-0 w-0.5 bg-ring'} />}
    {icon && <span className={dragging ? 'flex items-center gap-1.5 opacity-50' : 'flex items-center gap-1.5'}>{icon}</span>}
    <span className={dragging ? 'min-w-0 flex-1 truncate text-start opacity-50' : 'min-w-0 flex-1 truncate text-start'}>{children}</span>
    {close && <span role="button" data-close aria-label="Close" title={close.title} tabIndex={-1}
      className="-me-0.5 inline-flex size-5 flex-none items-center justify-center rounded-sm hover:bg-foreground/10"
      onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); close.run(); }}><XIcon className="size-3.5" /></span>}
  </TabsTrigger>;
}
