// A card of a Settings page (docs/ui.md): its title, a line under it, its toolbar at its end; and a button of that
// toolbar, its label a tooltip.
import type { ReactElement, ReactNode } from 'react';
import { Card, CardHeader, Text, Toolbar, ToolbarButton, Tooltip } from '@fluentui/react-components';

export function Group({ title, hint, tools, children }: { title: string; hint: ReactNode; tools: ReactNode; children: ReactNode }) {
  return <Card appearance="outline" size="small">
    <CardHeader header={<Text weight="semibold">{title}</Text>} description={<Text size={200}>{hint}</Text>} action={<Toolbar size="small">{tools}</Toolbar>} />
    {children}
  </Card>;
}

// Disabled but focusable: a disabled button gets no pointer or focus events, so a tooltip shown as it was disabled under
// the pointer would stay, and take the next Esc.
export const Tool = ({ label, icon, disabled, ...rest }: { label: string; icon: ReactElement; disabled?: boolean; onClick?: () => void }) =>
  <Tooltip content={label} relationship="label"><ToolbarButton icon={icon} disabledFocusable={disabled} {...rest} /></Tooltip>;
