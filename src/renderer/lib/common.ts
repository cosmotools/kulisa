// What several parts of the window use: what came in its URL (window.ts, load), the keys as this OS shows them,
// the pictures' and icons' names.
import { reactive } from 'vue';
import type { ProjectEntry, ProjectTask, ProjectsInfo, Shortcut } from '../../shared/types';

const query = new URLSearchParams(location.search);
// The projects open in this window, before the first paint; later the main process sends them (store.ts).
export const initialProjects: ProjectsInfo | null = query.get('projects') ? JSON.parse(query.get('projects')!) : null;
// Kulisa's keyboard shortcuts (main/keys.ts), as this OS shows them. keyText(id): a command's first key, for menus
// and tooltips ("Reload (Ctrl+R)", as Chrome's toolbar says it: withKeys). Sent again when the human changes one.
export const shortcuts = reactive<Shortcut[]>(JSON.parse(query.get('keys') || '[]'));
kulisa.on('keys', (keys) => shortcuts.splice(0, shortcuts.length, ...keys));
export const keyText = (id: string): string => shortcuts.find((s) => s.id === id)?.keys[0] || '';
export const withKeys = (title: string, id: string): string => (keyText(id) ? `${title} (${keyText(id)})` : title);

// A profile's picture (shared/avatars.ts): its file, in public/avatars.
export const avatarSrc = (a: string): string => `avatars/${a}.svg`;

// The links in ☰; they open in the user's browser (window.ts).
export const LINKS = [
  { label: 'Documentation', href: 'https://kulisa.app/docs', icon: 'i-docs' },
  { label: 'GitHub', href: 'https://github.com/cosmotools/kulisa', icon: 'i-github' },
];

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
// A project's sort key for "worked in last first" (NewTask.vue, Board.vue): an open task → Infinity, else its last close.
export const lastWorked = (p: ProjectEntry): number => (p.tasks.some((t) => !t.closed) ? Infinity : Math.max(0, ...p.tasks.map((t) => t.closedAt ?? 0)));
// When it was closed, as a person says it.
function ago(at?: number) {
  if (!at) return '';
  const m = Math.round((Date.now() - at) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 60 * 24 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 60 / 24)} days ago`;
}
// A task's line under its name (the board's rows, the bar's + menu): its branch when the name is not it, when it closed.
export const taskLine = (t: ProjectTask): string => [t.branch && t.branch !== t.name && t.branch, t.closed ? ago(t.closedAt) : ''].filter(Boolean).join(' · ');
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
