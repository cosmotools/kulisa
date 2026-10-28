// Settings (components/settings; docs/window.md, Settings): over the window's area under the title bar, at a page.
// Opened through the main process, which logs it and opens it for the macOS menu's Settings… too.
import { createStore, useStore } from 'zustand';
import type { SettingsAt } from '../../shared/ipc';

// The page asked for, a new object each time (asked again, it is shown again); null: Settings not shown.
const at = createStore<SettingsAt | null>()(() => null);
kulisa.on('settings:show', (a) => at.setState({ ...a }, true));
export const useSettings = () => useStore(at);

// At a project's page (none: the shown task's), a profile's (section 'profiles'), the log or About.
export const openSettings = (section: SettingsAt['section'] = 'projects', id?: string | null) => kulisa.send('settings:open', { section, id: id ?? null });

// Closed (its ×, Esc, the gear): Settings saves what is typed first, and may stay (an agent installing).
let leave: (() => Promise<void>) | null = null;
export const onLeaveSettings = (fn: typeof leave) => { leave = fn; };
export const leaveSettings = () => (leave ? leave() : closeSettings());
export const closeSettings = () => { if (at.getState()) { at.setState(null, true); kulisa.send('settings:close'); } };
