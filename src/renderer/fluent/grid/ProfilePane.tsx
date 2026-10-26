// A profile's pane (docs/window.md, The grid): its header, its toolbar, and its page's place (a native view over it).
// The shell: the place alone, for the layout (lib/grid.ts, panes).
import { useEffect, useRef } from 'react';
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react';
import { panes, scheduleLayout } from '../../lib/grid';

const profileOf = (id: string) => id.slice('profile:'.length);

export function ProfilePane({ api }: IDockviewPanelProps) {
  const content = useRef<HTMLDivElement>(null), id = profileOf(api.id);
  useEffect(() => {
    panes.set(id, { content: content.current!, focusAddress() {}, newTab() {} });
    scheduleLayout();
    return () => { panes.delete(id); };
  }, [id]);
  return <div className="pane" data-profile={id} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div ref={content} style={{ flex: 1, minHeight: 0 }} />
  </div>;
}

export function ProfileHeader({ api }: IDockviewPanelHeaderProps) {
  return <div data-panel={api.id} style={{ padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%' }}>{api.title}</div>;
}
