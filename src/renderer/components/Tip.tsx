// A tooltip on a control where it opens over no page (docs/ui.md, Tooltips): shadcn's, its text beside the control
// (side). Over or next to the pages, the native title instead: the OS draws it above them. Gone at once as it closes,
// not faded: a press that slides the grid would freeze it in the slide's picture, and a fading one is in the way. Its
// text is not hoverable: the pointer leaving onto a profile's page (a native view) moves on no more in the window, so
// Radix's grace area around it would keep it open.
import { useState, type ReactElement, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui';

export function Tip({ text, side, children }: { text: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={setOpen} disableHoverableContent>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    {open && <TooltipContent side={side}>{text}</TooltipContent>}
  </Tooltip>;
}
