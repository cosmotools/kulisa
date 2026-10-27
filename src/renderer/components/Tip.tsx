// A tooltip on a control where it opens over no page (docs/ui.md, Tooltips): shadcn's, its text beside the control
// (side). Over or next to the pages, the native title instead: the OS draws it above them.
import type { ReactElement, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui';

export function Tip({ text, side, open, onOpenChange, children }: { text: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; open?: boolean;
  onOpenChange?: (open: boolean) => void; children: ReactElement }) {
  return <Tooltip open={open} onOpenChange={onOpenChange}>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={side}>{text}</TooltipContent>
  </Tooltip>;
}
