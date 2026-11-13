// Dockview's temporary maximize/restore for a testing group (../README.md, The grid).
import { useEffect, useState } from 'react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { Maximize2Icon, Minimize2Icon } from 'lucide-react';
import { Button } from '@ui';
import type { MenuRow } from '../../menus/renderer';

export function paneFocusItem(api: IDockviewPanelHeaderProps['api']) {
  const maximized = api.isMaximized();
  return {
    label: maximized ? 'Restore pane' : 'Maximize pane',
    run: () => { if (api.isMaximized()) api.exitMaximized(); else { api.setActive(); api.maximize(); } },
  } satisfies MenuRow;
}

export function PaneFocus({ api, containerApi }: Pick<IDockviewPanelHeaderProps, 'api' | 'containerApi'>) {
  const [maximized, setMaximized] = useState(() => api.isMaximized());
  useEffect(() => {
    const update = () => setMaximized(api.isMaximized());
    const changed = containerApi.onDidMaximizedGroupChange(update), moved = api.onDidGroupChange(update);
    return () => { changed.dispose(); moved.dispose(); };
  }, [api, containerApi]);
  const item = paneFocusItem(api);
  return <Button variant="ghost" size="icon-xs" aria-label={item.label} title={item.label} onClick={() => item.run?.()}>
    {maximized ? <Minimize2Icon /> : <Maximize2Icon />}
  </Button>;
}
