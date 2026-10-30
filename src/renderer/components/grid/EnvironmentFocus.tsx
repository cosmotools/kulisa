// Dockview's temporary maximize/restore for a testing group (docs/window.md, The grid).
import { useEffect, useState } from 'react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { Maximize2Icon, Minimize2Icon } from 'lucide-react';
import { Button } from '@ui';
import type { MenuRow } from '../../lib/menu';

export function environmentFocusItem(api: IDockviewPanelHeaderProps['api']): MenuRow {
  const maximized = api.isMaximized();
  return {
    label: maximized ? 'Restore environment' : 'Maximize environment',
    run: () => { if (api.isMaximized()) api.exitMaximized(); else { api.setActive(); api.maximize(); } },
  };
}

export function EnvironmentFocus({ api, containerApi }: Pick<IDockviewPanelHeaderProps, 'api' | 'containerApi'>) {
  const [maximized, setMaximized] = useState(() => api.isMaximized());
  useEffect(() => {
    const update = () => setMaximized(api.isMaximized());
    const changed = containerApi.onDidMaximizedGroupChange(update), moved = api.onDidGroupChange(update);
    return () => { changed.dispose(); moved.dispose(); };
  }, [api, containerApi]);
  const item = environmentFocusItem(api);
  return <Button variant="ghost" size="icon-xs" aria-label={item.label} title={item.label} onClick={() => item.run?.()}>
    {maximized ? <Minimize2Icon /> : <Maximize2Icon />}
  </Button>;
}
