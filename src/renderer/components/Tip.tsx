// A tooltip on a control where it opens over no page (docs/ui.md, Tooltips): shadcn's, its text beside the control
// (side). Over or next to the pages, the native title instead: the OS draws it above them. Its text is not hoverable:
// the pointer leaving onto a profile's page (a native view) moves on no more in the window, so Radix's grace area
// around it would keep it open.
import type { ReactElement, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui';

export function Tip({ text, side, children }: { text: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; children: ReactElement }) {
  return <Tooltip disableHoverableContent>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={side}>{text}</TooltipContent>
  </Tooltip>;
}
