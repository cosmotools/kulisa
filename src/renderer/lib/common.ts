// What several parts of the window use: what came in its URL (window.ts, load), the keys as this OS shows them,
// the profiles' pictures.
import { createStore, useStore } from 'zustand';
import type { ProjectsInfo, Shortcut } from '../../shared/types';

const query = new URLSearchParams(location.search);
// The projects open in this window, before the first paint; later the main process sends them (store.ts).
export const initialProjects: ProjectsInfo | null = query.get('projects') ? JSON.parse(query.get('projects')!) : null;
// Kulisa's keyboard shortcuts (main/keys.ts), as this OS shows them. keyText(id): a command's first key, for menus
// and tooltips ("Reload (Ctrl+R)", as Chrome's toolbar says it: withKeys). Sent again when the human changes one.
const shortcuts = createStore<Shortcut[]>()(() => JSON.parse(query.get('keys') || '[]'));
kulisa.on('keys:state', (keys) => shortcuts.setState(keys, true));
export const useShortcuts = () => useStore(shortcuts);
export const keyText = (id: string): string => shortcuts.getState().find((s) => s.id === id)?.keys[0] || '';
export const withKeys = (title: string, id: string): string => (keyText(id) ? `${title} (${keyText(id)})` : title);

// A profile's picture (shared/avatars.ts): its file, in public/avatars.
export const avatarSrc = (a: string): string => `avatars/${a}.svg`;

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
