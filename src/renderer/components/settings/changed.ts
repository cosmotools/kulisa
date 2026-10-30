// The profiles changed elsewhere (a tasks' window, the agent; settings:changed): what Settings shows read again. One
// listener for every page and every time Settings is shown, as kulisa.on has no off.
import { useEffect } from 'react';

const changed = new Set<() => void>();
kulisa.on('settings:changed', () => { for (const f of changed) f(); });
export function useChanged(again: () => void) {
  useEffect(() => { changed.add(again); return () => { changed.delete(again); }; }, [again]);
}
