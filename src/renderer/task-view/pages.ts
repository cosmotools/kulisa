// Browser-pane handles and native-page geometry (docs/window.md, The grid).
import type { DockviewApi } from 'dockview-react';
import type { PageLayout } from '../../shared/ipc';
import type { Profile } from '../../shared/types';
import { panelId } from './layout';
interface PaneHandle { content: HTMLElement; focusAddress(): void; cancelAddress(): void; newTab(): void; pick(): void }
export const panes = new Map<string, PaneHandle>();
export function pageRects(stage: DockviewApi | null, viewport: HTMLElement | null, profiles: Profile[]) {
  const rects: Record<string, PageLayout> = {};
  const v = viewport?.getBoundingClientRect();
  for (const p of profiles) {
    const panel = stage?.getPanel(panelId(p.id)), c = panes.get(p.id)?.content;
    if (!panel?.api.isVisible || !c?.isConnected || !c.checkVisibility() || !c.offsetWidth) { rects[p.id] = { shown: false }; continue; }
    const r = c.getBoundingClientRect();
    const x = Math.max(r.x, v?.x ?? r.x), y = Math.max(r.y, v?.y ?? r.y);
    const right = Math.min(r.right, v ? v.x + viewport!.clientWidth : r.right), bottom = Math.min(r.bottom, v ? v.y + viewport!.clientHeight : r.bottom);
    if (right <= x || bottom <= y) { rects[p.id] = { shown: false }; continue; }
    rects[p.id] = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height),
      ...(Math.round(x) > Math.round(r.x) || Math.round(y) > Math.round(r.y) || Math.round(right) < Math.round(r.right) || Math.round(bottom) < Math.round(r.bottom) ? { clip: { x: Math.round(x), y: Math.round(y), width: Math.round(right - x), height: Math.round(bottom - y) } } : {}) };
  }
  return rects;
}
