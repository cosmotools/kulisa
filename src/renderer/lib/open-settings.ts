// The shared handle for opening window Settings (docs/window.md).
import type { SettingsAt } from '../../shared/ipc';

// At a project's page (none: the shown task's), a profile's (section 'profiles'), the log or About.
export const openSettings = (section: SettingsAt['section'] = 'projects', id?: string | null) => kulisa.send('settings:open', { section, id: id ?? null });

