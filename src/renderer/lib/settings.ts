// Settings (components/settings; docs/window.md, Settings): over the window's area under the title bar, at a page.
// Opened through the main process, which logs it and opens it for the macOS menu's Settings… too.
import { useSyncExternalStore } from 'react';
import type { SettingsAt } from '../../shared/ipc';

// The page asked for, a new object each time (asked again, it is shown again); null: Settings not shown.
let at: SettingsAt | null = null;
const listeners = new Set<() => void>();
const set = (v: SettingsAt | null) => { at = v; for (const l of listeners) l(); };
kulisa.on('settings:show', (a) => set({ ...a }));
export const useSettings = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => at);

// At a project's page (none: the shown task's), a profile's (section 'profiles'), the log or About.
export const openSettings = (section: SettingsAt['section'] = 'projects', id?: string | null) => kulisa.send('settings:open', { section, id: id ?? null });

// Closed (its ×, Esc, the gear): Settings saves what is typed first, and may stay (an agent installing).
let leave: (() => Promise<void>) | null = null;
export const onLeaveSettings = (fn: typeof leave) => { leave = fn; };
export const leaveSettings = () => (leave ? leave() : closeSettings());
export const closeSettings = () => { if (at) { set(null); kulisa.send('settings:close'); } };
