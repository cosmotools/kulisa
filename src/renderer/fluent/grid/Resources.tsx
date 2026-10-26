// The files the agent's tools kept of the task's pages (docs/window.md, Resources). The shell: their count.
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { useWindow } from '../../lib/store';

export function Resources() {
  const n = useWindow((s) => s.artifacts.list.length);
  return <div style={{ padding: 8 }}>{n}</div>;
}

export function ResourcesHeader({ api }: IDockviewPanelHeaderProps) {
  return <div data-panel={api.id} style={{ padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%' }}>{api.title}</div>;
}
