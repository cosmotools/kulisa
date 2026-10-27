// An error not of a field: shadcn's destructive Alert, its text selectable (docs/ui.md, Notices).
import type { ReactNode } from 'react';
import { CircleAlertIcon } from 'lucide-react';
import { Alert, AlertAction, AlertDescription } from '@ui';

export function ErrorBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <Alert variant="destructive">
    <CircleAlertIcon />
    <AlertDescription><span data-selectable>{children}</span></AlertDescription>
    {actions && <AlertAction>{actions}</AlertAction>}
  </Alert>;
}
