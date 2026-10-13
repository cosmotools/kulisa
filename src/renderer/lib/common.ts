// What several parts of the window use: what came in its URL (window.ts, load), the keys as this OS shows them,
// the pictures' and icons' names.
import { reactive } from 'vue';
import type { ProjectsInfo, Shortcut } from '../types';

const query = new URLSearchParams(location.search);
export const version: string = query.get('version') || '';
// The projects open in this window, before the first paint; later the main process sends them (store.ts).
export const initialProjects: ProjectsInfo | null = query.get('projects') ? JSON.parse(query.get('projects')!) : null;
// Kulisa's keyboard shortcuts (main/keys.ts), as this OS shows them. keyText(id): a command's first key, for menus
// and tooltips ("Reload (Ctrl+R)", as Chrome's toolbar says it: withKeys). Sent again when the human changes one.
export const shortcuts = reactive<Shortcut[]>(JSON.parse(query.get('keys') || '[]'));
kulisa.on<Shortcut[]>('keys', (keys) => shortcuts.splice(0, shortcuts.length, ...keys));
export const keyText = (id: string): string => shortcuts.find((s) => s.id === id)?.keys[0] || '';
export const withKeys = (title: string, id: string): string => (keyText(id) ? `${title} (${keyText(id)})` : title);

// A profile's picture (main/avatars.ts): its file, in public/avatars.
export const avatarSrc = (a: string): string => `avatars/${a}.svg`;

// The links in ☰; they open in the user's browser (window.ts).
export const LINKS = [
  { label: 'Documentation', href: 'https://github.com/cosmotools/kulisa#readme', icon: 'i-docs' },
  { label: 'GitHub', href: 'https://github.com/cosmotools/kulisa', icon: 'i-github' },
  { label: 'Report an issue', href: 'https://github.com/cosmotools/kulisa/issues', icon: 'i-bug' },
];

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
