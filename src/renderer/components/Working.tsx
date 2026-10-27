// Work under way: shadcn's Spinner with its label, the line a status (docs/ui.md, Notices).
import type { ReactNode } from 'react';
import { Spinner } from '@ui';

export function Working({ children }: { children: ReactNode }) {
  return <div role="status" className="flex items-center gap-2 text-muted-foreground"><Spinner role={undefined} aria-hidden />{children}</div>;
}
