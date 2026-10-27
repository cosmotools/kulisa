// An error not of a field: Fluent's MessageBar, its text selectable (docs/ui.md, Notices).
import type { ReactNode } from 'react';
import { MessageBar, MessageBarActions, MessageBarBody } from '@fluentui/react-components';
import common from './common.module.css';

export function ErrorBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <MessageBar intent="error">
    <MessageBarBody><span className={common.selectable}>{children}</span></MessageBarBody>
    {actions && <MessageBarActions>{actions}</MessageBarActions>}
  </MessageBar>;
}
