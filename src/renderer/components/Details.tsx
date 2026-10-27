// What is shown only when asked for (an installer's output, a sign-in's terminal): shadcn's Collapsible under a
// Details button, its content mounted only while open.
import type { ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from '@ui';

export function Details({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return <Collapsible open={open} onOpenChange={onOpenChange}>
    <CollapsibleTrigger asChild>
      <Button type="button" variant="ghost" size="sm"><ChevronRightIcon className={open ? 'rotate-90' : undefined} />Details</Button>
    </CollapsibleTrigger>
    <CollapsibleContent><div className="mt-1 overflow-hidden rounded-lg border p-2">{children}</div></CollapsibleContent>
  </Collapsible>;
}
