// An error not of a field: Fluent's MessageBar, its text selectable (docs/ui.md, Notices).
import type { ReactNode } from 'react';
import { MessageBar, MessageBarActions, MessageBarBody } from '@fluentui/react-components';
import { useCommonStyles } from './theme';

export function ErrorBar({ children, actions, className }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  const common = useCommonStyles();
  return <MessageBar intent="error" className={className}>
    <MessageBarBody className={common.selectable}>{children}</MessageBarBody>
    {actions && <MessageBarActions>{actions}</MessageBarActions>}
  </MessageBar>;
}
